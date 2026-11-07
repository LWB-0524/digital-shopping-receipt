import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { CATEGORY_GROUPS, CATEGORIES } from "./categories";
import type { RecognizeResult, UploadImage } from "./types";
import { parseReceipt } from "./validate";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

const categoryGuide = CATEGORY_GROUPS.map((g) => `${g.group}：${g.categories.join("、")}`).join("\n");

const SYSTEM_PROMPT = `你是消费小票识别助手。用户会上传一张或多张图片，可能是超市/商店的购物小票，也可能是餐厅、咖啡店、外卖等外出就餐的小票（多张时是同一张长小票分段拍摄，按顺序拼接，注意去掉重叠部分的重复商品）。
没有小票时，用户也可能上传付款记录的截图：银行 App 里单笔交易的详情页、电子收据、订阅扣款邮件等。这类图片同样要识别，规则见下方"付款记录截图"。
请把小票整理成结构化数据：

- kind：小票类型。超市、商店购物填 "grocery"；餐厅、咖啡店、快餐店、奶茶店、外卖等餐饮消费填 "dining"；交通（公交充值、打车、加油、停车）、订阅会员、话费网费、水电燃气、医疗等其他支出填 "other"。
- store：商店或餐厅名称（含分店名），看不清就留空字符串。
- purchased_at：购买时间，格式 "YYYY-MM-DD HH:MM"。小票上没有年份时按用户给出的今天日期推断；完全没有时间时留空字符串。
- total：实际支付金额（应付/实付合计）。
- discount：整单层面的优惠合计（会员折扣、满减、优惠券等），为非负数；已经体现在单个商品金额里的优惠不要重复计入。
- items：每个商品一条。
  - raw_name：小票上印的原始品名。
  - name：整理后易读的商品名，补全明显的缩写，去掉条码和无意义编号，保留品牌和规格（如"伊利纯牛奶 250ml×12"）。
  - generic_name：通用名，即这件商品最常用的简短叫法，去掉品牌、规格和口味，用来把不同牌子、不同写法的同类商品归在一起，例如"鸡蛋"、"牛奶"、"薯片"、"卫生纸"、"西红柿"。
  - category：只能从给定品类中选择最合适的一个。
  - quantity：数量；称重商品填重量数值（如 0.536），unit 填 "kg"。
  - unit：单位，如 "个"、"袋"、"kg"，不确定就留空字符串。
  - unit_price：单价。
  - amount：该行实际金额（若该行有单品优惠，填优惠后的金额）。
  - 购物袋也算一条商品，归入"日用品"。不要把小计、合计、找零、支付方式、积分等当作商品。
  - 餐饮小票（kind 为 "dining"）：每道菜、每杯饮品各一条，品类从"外出就餐"大类里选（如越南粉、汉堡归"正餐"或"快餐小吃"，咖啡奶茶归"咖啡茶饮"）；name 用中文菜名，必要时保留原文菜名，如"牛肉河粉 Pho Bo"；generic_name 用菜品通用叫法，如"越南粉"、"拿铁"。
  - 其他支出小票（kind 为 "other"）：品类从"交通出行""生活服务"大类里选。
  - 付款记录截图（没有商品明细）：store 填整理后易读的收款方名称（如 "ANTHROPIC* CLAUDE SU" 整理为 "Anthropic"，"Laundromatic" 保持原样），purchased_at 用交易日期时间，total 用扣款金额（取正数）。items 只放一条：name 写这笔钱的用途（如"Claude 订阅"、"自助洗衣"、"AT HOP 充值"），raw_name 填截图上的收款方原文，quantity 为 1，unit_price 和 amount 都等于扣款金额，按收款方判断 kind 和品类（超市填 grocery、餐厅填 dining、其他填 other）。warnings 写"这是付款记录，没有商品明细"，判断不出用途时再补一句请用户确认品类。截图里的账号、卡号、Particulars、Code、Reference 等信息一律不要输出。
  - 周末/节假日附加费（surcharge）、刷卡手续费、服务费、小费（tip）如果计入了实付金额，各单独列一条，归入"服务费小费"。GST 等已含在价格里的税不要单独列。
- warnings：看不清、可能识别错或金额对不上的地方，用一两句中文说明；没有就留空字符串。
- is_receipt：图片既不是小票、也不是付款记录时设为 false，其他字段给空值即可。
- multiple_transactions：截图是包含多笔交易的列表（如银行流水列表页）时设为 true，其他字段给空值即可；单张小票或单笔交易时为 false。

可选品类（大类：小类）：
${categoryGuide}

不要输出小票上的会员卡号、手机号等个人信息。`;

const RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["is_receipt", "multiple_transactions", "kind", "store", "purchased_at", "total", "discount", "items", "warnings"],
  properties: {
    is_receipt: { type: "boolean" },
    multiple_transactions: { type: "boolean" },
    kind: { type: "string", enum: ["grocery", "dining", "other"] },
    store: { type: "string" },
    purchased_at: { type: "string", description: 'YYYY-MM-DD HH:MM，未知时为 ""' },
    total: { type: "number" },
    discount: { type: "number" },
    warnings: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["raw_name", "name", "generic_name", "category", "quantity", "unit", "unit_price", "amount"],
        properties: {
          raw_name: { type: "string" },
          name: { type: "string" },
          generic_name: { type: "string" },
          category: { type: "string", enum: CATEGORIES },
          quantity: { type: "number" },
          unit: { type: "string" },
          unit_price: { type: "number" },
          amount: { type: "number" },
        },
      },
    },
  },
} as const;

export class RecognizeError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

let client: Anthropic | undefined;
export function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new RecognizeError("服务器没有配置 ANTHROPIC_API_KEY，无法识别小票", 500);
  }
  client ??= new Anthropic({ maxRetries: 2 });
  return client;
}

export async function recognizeReceipt(
  images: UploadImage[],
  today: string,
  knownStores: string[] = [],
): Promise<RecognizeResult> {
  if (process.env.RECOGNIZE_MOCK === "1") return mockResult(today);
  if (process.env.RECOGNIZE_MOCK === "dining") return mockDining(today);
  if (process.env.RECOGNIZE_MOCK === "payment") return mockPayment(today);

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // 被安全策略误拒时，由服务端自动换用推荐的备用模型重试
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: RESULT_SCHEMA },
      },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            ...images.map((img) => ({
              type: "image" as const,
              source: { type: "base64" as const, media_type: img.media_type, data: img.data },
            })),
            {
              type: "text",
              text: [
                `今天是 ${today}。请识别这张小票。`,
                knownStores.length > 0
                  ? `我以前去过这些店铺：${knownStores.join("；")}。如果这张小票来自其中某一家（哪怕小票上的写法、语言或分店名不同），store 请直接使用这里的写法。`
                  : "",
              ]
                .filter(Boolean)
                .join("\n"),
            },
          ],
        },
      ],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new RecognizeError("服务器的 Anthropic API Key 无效", 500);
    } else if (err instanceof Anthropic.RateLimitError) {
      throw new RecognizeError("识别服务繁忙，请稍后再试", 429);
    } else if (err instanceof Anthropic.BadRequestError) {
      throw new RecognizeError(`识别请求被拒绝：${err.message}`, 400);
    } else if (err instanceof Anthropic.APIConnectionError) {
      throw new RecognizeError("连接识别服务失败，请检查服务器网络");
    } else if (err instanceof Anthropic.APIError) {
      throw new RecognizeError(`识别服务出错（${err.status ?? "未知"}），请重试`);
    }
    throw err;
  }

  if (response.stop_reason === "refusal") {
    throw new RecognizeError("这张图片无法识别，请换一张清晰的小票照片", 422);
  }
  if (response.stop_reason === "max_tokens") {
    throw new RecognizeError("小票内容太长，请分段拍摄后再试", 422);
  }

  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new RecognizeError("识别结果解析失败，请重试");
  }

  if (data.multiple_transactions === true) {
    throw new RecognizeError("这张截图里有多笔交易。请在银行 App 里点开其中一笔，对交易详情页截图后再上传", 422);
  }
  if (data.is_receipt === false) {
    throw new RecognizeError("没有在图片里找到小票或付款记录", 422);
  }

  // 时间缺失时先用当前时间，确认页里可以修改
  const purchasedAt = typeof data.purchased_at === "string" && data.purchased_at ? data.purchased_at : today;
  const parsed = parseReceipt({ ...data, purchased_at: purchasedAt, note: "" });
  if (typeof parsed === "string") {
    const fallback = parseReceipt({ ...data, purchased_at: today, note: "" });
    if (typeof fallback === "string") throw new RecognizeError(`识别结果不完整：${fallback}`);
    return { ...fallback, is_receipt: true, warnings: joinWarnings(data.warnings, "购买时间没有识别出来，请手动确认") };
  }
  return { ...parsed, is_receipt: true, warnings: joinWarnings(data.warnings) };
}

function joinWarnings(...parts: unknown[]): string {
  return parts.filter((p): p is string => typeof p === "string" && p.trim() !== "").join("；");
}

// 本地开发时设置 RECOGNIZE_MOCK=1，可以不调用 API 走通整个流程
function mockResult(today: string): RecognizeResult {
  return {
    is_receipt: true,
    kind: "grocery",
    store: "示例超市（演示数据）",
    purchased_at: today,
    total: 60.53,
    discount: 3,
    note: "",
    warnings: "这是 RECOGNIZE_MOCK 生成的演示数据",
    items: [
      { raw_name: "伊利纯牛奶250ML*12", generic_name: "牛奶", name: "伊利纯牛奶 250ml×12", category: "乳制品", quantity: 1, unit: "箱", unit_price: 39.9, amount: 39.9 },
      { raw_name: "乐事薯片原味70G", generic_name: "薯片", name: "乐事薯片 原味 70g", category: "零食", quantity: 2, unit: "袋", unit_price: 7.5, amount: 15 },
      { raw_name: "西红柿", generic_name: "西红柿", name: "西红柿", category: "蔬菜水果", quantity: 0.85, unit: "kg", unit_price: 9.8, amount: 8.33 },
      { raw_name: "购物袋", generic_name: "购物袋", name: "购物袋", category: "日用品", quantity: 1, unit: "个", unit_price: 0.3, amount: 0.3 },
    ],
  };
}

function mockDining(today: string): RecognizeResult {
  return {
    is_receipt: true,
    kind: "dining",
    store: "Pho Vietnam（演示数据）",
    purchased_at: today,
    total: 27.6,
    discount: 0,
    note: "",
    warnings: "这是 RECOGNIZE_MOCK=dining 生成的演示数据",
    items: [
      { raw_name: "Pho Bo (L)", generic_name: "越南粉", name: "牛肉河粉 Pho Bo（大）", category: "正餐", quantity: 1, unit: "份", unit_price: 19.5, amount: 19.5 },
      { raw_name: "Vietnamese Iced Coffee", generic_name: "越南咖啡", name: "越南冰咖啡", category: "咖啡茶饮", quantity: 1, unit: "杯", unit_price: 6.5, amount: 6.5 },
      { raw_name: "Card Surcharge", generic_name: "刷卡手续费", name: "刷卡手续费", category: "服务费小费", quantity: 1, unit: "", unit_price: 1.6, amount: 1.6 },
    ],
  };
}

function mockPayment(today: string): RecognizeResult {
  return {
    is_receipt: true,
    kind: "other",
    store: "Laundromatic（演示数据）",
    purchased_at: today,
    total: 4.04,
    discount: 0,
    note: "",
    warnings: "这是付款记录，没有商品明细",
    items: [
      { raw_name: "Laundromatic", generic_name: "洗衣", name: "自助洗衣", category: "洗衣家政", quantity: 1, unit: "", unit_price: 4.04, amount: 4.04 },
    ],
  };
}
