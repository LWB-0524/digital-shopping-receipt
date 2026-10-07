import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "./db";
import { getClient, MODEL, RecognizeError } from "./recognize";

// 给以前上传、还没有通用名的商品补上通用名。只写入 generic_name 这一列，且只处理为空的行。

const BATCH_SIZE = 80;

const SYSTEM_PROMPT = `你会收到一组超市购物小票上的商品名。请为每个商品给出"通用名"：这件商品最常用的简短中文叫法，去掉品牌、规格、口味和包装，用来把不同牌子、不同写法的同类商品归在一起。
例如："Farmer Brown 谷仓鸡蛋 7号 18枚" → "鸡蛋"；"伊利纯牛奶 250ml×12" → "牛奶"；"乐事薯片 原味 70g" → "薯片"；"维达抽纸 3层" → "抽纸"。
如果给了"已有通用名"，意思相同时优先沿用已有的写法，保持一致。每个输入的商品名都要原样返回一条。`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "generic_name"],
        properties: { name: { type: "string" }, generic_name: { type: "string" } },
      },
    },
  },
} as const;

export async function countMissingGenericNames(userId: number): Promise<number> {
  const db = await getDb();
  const rs = await db.execute({
    sql: "SELECT COUNT(DISTINCT name) AS n FROM receipt_items WHERE user_id = ? AND generic_name = ''",
    args: [userId],
  });
  return Number(rs.rows[0]?.n ?? 0);
}

// 处理一批，返回本批更新的商品名数量和剩余数量。前端循环调用直到剩余为 0。
export async function fillGenericNamesBatch(userId: number): Promise<{ updated: number; remaining: number }> {
  const db = await getDb();
  const pending = await db.execute({
    sql: `SELECT name, COUNT(*) AS n FROM receipt_items WHERE user_id = ? AND generic_name = ''
          GROUP BY name ORDER BY n DESC LIMIT ?`,
    args: [userId, BATCH_SIZE],
  });
  const names = pending.rows.map((r) => String(r.name));
  if (names.length === 0) return { updated: 0, remaining: 0 };

  const existing = await db.execute({
    sql: `SELECT generic_name, COUNT(*) AS n FROM receipt_items WHERE user_id = ? AND generic_name != ''
          GROUP BY generic_name ORDER BY n DESC LIMIT 300`,
    args: [userId],
  });
  const known = existing.rows.map((r) => String(r.generic_name));

  const mapping =
    process.env.RECOGNIZE_MOCK === "1" ? mockMapping(names) : await askClaude(names, known);

  let updated = 0;
  const statements = [];
  for (const name of names) {
    const generic = mapping.get(name)?.trim().slice(0, 30);
    if (!generic) continue;
    updated++;
    statements.push(
      {
        sql: "UPDATE receipt_items SET generic_name = ? WHERE user_id = ? AND name = ? AND generic_name = ''",
        args: [generic, userId, name],
      },
      {
        // 规则既按整理后的商品名记，也按小票原文记，两种都补上
        sql: `UPDATE category_rules SET generic_name = ?
              WHERE user_id = ? AND generic_name = '' AND (name = ? OR name IN (
                SELECT raw_name FROM receipt_items WHERE user_id = ? AND name = ? AND raw_name != ''))`,
        args: [generic, userId, name, userId, name],
      },
    );
  }
  if (statements.length > 0) await db.batch(statements, "write");
  if (updated === 0) {
    throw new RecognizeError("没能整理出通用名，请稍后再试");
  }
  return { updated, remaining: await countMissingGenericNames(userId) };
}

async function askClaude(names: string[], known: string[]): Promise<Map<string, string>> {
  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `已有通用名：${known.length > 0 ? known.join("、") : "（无）"}\n\n商品名：\n${names.map((n) => `- ${n}`).join("\n")}`,
        },
      ],
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      throw new RecognizeError(`调用整理服务失败（${err.status ?? "网络错误"}），请稍后再试`);
    }
    throw err;
  }
  if (response.stop_reason !== "end_turn") {
    throw new RecognizeError("整理通用名没有完成，请重试");
  }
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  try {
    const data = JSON.parse(text) as { items: { name: string; generic_name: string }[] };
    return new Map(data.items.map((it) => [it.name, it.generic_name]));
  } catch {
    throw new RecognizeError("整理结果解析失败，请重试");
  }
}

function mockMapping(names: string[]): Map<string, string> {
  return new Map(names.map((n) => [n, n.replace(/[\sA-Za-z0-9×*.]+/g, "").slice(0, 4) || n]));
}
