import "server-only";
import type { InArgs, Transaction } from "@libsql/client";
import { categoriesInGroup } from "./categories";
import { getDb } from "./db";
import { resolveStoreNames } from "./stores";
import type {
  ItemRow,
  MonthlyStats,
  ReceiptDetail,
  ReceiptInput,
  ReceiptSummary,
  StoreSummary,
  UploadImage,
} from "./types";

export type Filters = {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  q?: string;
  group?: string;
  category?: string;
  store?: string; // 合并后的店铺名，见 resolveStoreNames
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function filtersFromSearchParams(params: URLSearchParams): Filters {
  const pick = (k: string) => params.get(k)?.trim() || undefined;
  const from = pick("from");
  const to = pick("to");
  return {
    from: from && DATE_RE.test(from) ? from : undefined,
    to: to && DATE_RE.test(to) ? to : undefined,
    q: pick("q")?.slice(0, 50),
    group: pick("group"),
    category: pick("category"),
    store: pick("store")?.slice(0, 100),
  };
}

// 店铺筛选：找出这个店铺在小票上出现过的所有写法
async function storeCondition(userId: number, store: string | undefined, args: InArgs & unknown[]): Promise<string[]> {
  if (!store) return [];
  const { names } = await storeNames(userId);
  const variants = [...names].filter(([, display]) => display === store).map(([raw]) => raw);
  if (variants.length === 0) return ["0"];
  args.push(...variants);
  return [`r.store IN (${variants.map(() => "?").join(",")})`];
}

// 把筛选条件转换为针对 receipt_items 别名 i、receipts 别名 r 的 SQL 片段
function itemConditions(f: Filters, args: InArgs & unknown[]): string[] {
  const where: string[] = [];
  if (f.from) {
    where.push("r.purchased_at >= ?");
    args.push(f.from);
  }
  if (f.to) {
    // purchased_at 形如 "2026-10-05 18:32"，加一个比任何时间都大的后缀包含当天
    where.push("r.purchased_at <= ?");
    args.push(`${f.to} 99:99`);
  }
  if (f.category) {
    where.push("i.category = ?");
    args.push(f.category);
  } else if (f.group) {
    const cats = categoriesInGroup(f.group);
    if (cats.length > 0) {
      where.push(`i.category IN (${cats.map(() => "?").join(",")})`);
      args.push(...cats);
    }
  }
  if (f.q) {
    where.push(
      "(i.name LIKE ? ESCAPE '\\' OR i.raw_name LIKE ? ESCAPE '\\' OR i.generic_name LIKE ? ESCAPE '\\' OR r.store LIKE ? ESCAPE '\\')",
    );
    const like = `%${f.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    args.push(like, like, like, like);
  }
  return where;
}

export async function listReceipts(userId: number, f: Filters): Promise<ReceiptSummary[]> {
  const db = await getDb();
  const args: unknown[] & InArgs = [userId];
  const where = ["r.user_id = ?"];
  const itemWhere = itemConditions({ ...f, from: undefined, to: undefined }, args);
  if (itemWhere.length > 0) {
    // 小票里至少有一个商品满足条件（店名搜索也走这里）
    where.push(`EXISTS (SELECT 1 FROM receipt_items i WHERE i.receipt_id = r.id AND ${itemWhere.join(" AND ")})`);
  }
  if (f.from) {
    where.push("r.purchased_at >= ?");
    args.push(f.from);
  }
  if (f.to) {
    where.push("r.purchased_at <= ?");
    args.push(`${f.to} 99:99`);
  }
  where.push(...(await storeCondition(userId, f.store, args)));
  const rs = await db.execute({
    sql: `SELECT r.id, r.store, r.purchased_at, r.total,
            (SELECT COUNT(*) FROM receipt_items i WHERE i.receipt_id = r.id) AS item_count,
            (SELECT group_concat(name, '、') FROM (
               SELECT name FROM receipt_items i WHERE i.receipt_id = r.id ORDER BY position LIMIT 4)) AS preview
          FROM receipts r
          WHERE ${where.join(" AND ")}
          ORDER BY r.purchased_at DESC, r.id DESC
          LIMIT 500`,
    args,
  });
  return rs.rows.map((row) => ({
    id: Number(row.id),
    store: String(row.store ?? ""),
    purchased_at: String(row.purchased_at),
    total: Number(row.total),
    item_count: Number(row.item_count),
    preview: String(row.preview ?? ""),
  }));
}

export async function listItems(userId: number, f: Filters): Promise<ItemRow[]> {
  const db = await getDb();
  const args: unknown[] & InArgs = [userId];
  const where = ["i.user_id = ?", ...itemConditions(f, args)];
  where.push(...(await storeCondition(userId, f.store, args)));
  const rs = await db.execute({
    sql: `SELECT i.id, i.receipt_id, i.name, i.raw_name, i.generic_name, i.category, i.quantity, i.unit, i.unit_price, i.amount,
                 r.store, r.purchased_at
          FROM receipt_items i JOIN receipts r ON r.id = i.receipt_id
          WHERE ${where.join(" AND ")}
          ORDER BY r.purchased_at DESC, i.receipt_id DESC, i.position
          LIMIT 2000`,
    args,
  });
  return rs.rows.map((row) => ({
    id: Number(row.id),
    receipt_id: Number(row.receipt_id),
    name: String(row.name),
    raw_name: String(row.raw_name ?? ""),
    generic_name: String(row.generic_name ?? ""),
    category: String(row.category),
    quantity: Number(row.quantity),
    unit: String(row.unit ?? ""),
    unit_price: Number(row.unit_price),
    amount: Number(row.amount),
    store: String(row.store ?? ""),
    purchased_at: String(row.purchased_at),
  }));
}

export async function getReceipt(userId: number, id: number): Promise<ReceiptDetail | null> {
  const db = await getDb();
  const [r, items, images] = await Promise.all([
    db.execute({ sql: "SELECT * FROM receipts WHERE id = ? AND user_id = ?", args: [id, userId] }),
    db.execute({
      sql: "SELECT * FROM receipt_items WHERE receipt_id = ? AND user_id = ? ORDER BY position",
      args: [id, userId],
    }),
    db.execute({ sql: "SELECT COUNT(*) AS n FROM receipt_images WHERE receipt_id = ?", args: [id] }),
  ]);
  const row = r.rows[0];
  if (!row) return null;
  return {
    id,
    store: String(row.store ?? ""),
    purchased_at: String(row.purchased_at),
    total: Number(row.total),
    discount: Number(row.discount),
    note: String(row.note ?? ""),
    image_count: Number(images.rows[0]?.n ?? 0),
    items: items.rows.map((it) => ({
      id: Number(it.id),
      name: String(it.name),
      raw_name: String(it.raw_name ?? ""),
      generic_name: String(it.generic_name ?? ""),
      category: String(it.category),
      quantity: Number(it.quantity),
      unit: String(it.unit ?? ""),
      unit_price: Number(it.unit_price),
      amount: Number(it.amount),
    })),
  };
}

async function insertItems(tx: Transaction, userId: number, receiptId: number, input: ReceiptInput) {
  for (const [position, it] of input.items.entries()) {
    await tx.execute({
      sql: `INSERT INTO receipt_items (receipt_id, user_id, position, name, raw_name, generic_name, category, quantity, unit, unit_price, amount)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        receiptId,
        userId,
        position,
        it.name,
        it.raw_name,
        it.generic_name,
        it.category,
        it.quantity,
        it.unit,
        it.unit_price,
        it.amount,
      ],
    });
  }
}

// 用户确认保存时记住每个商品的品类和通用名，下次识别同名商品直接套用
async function rememberCategories(tx: Transaction, userId: number, input: ReceiptInput) {
  for (const it of input.items) {
    for (const name of new Set([it.name, it.raw_name].filter(Boolean))) {
      await tx.execute({
        sql: `INSERT INTO category_rules (user_id, name, category, generic_name) VALUES (?, ?, ?, ?)
              ON CONFLICT(user_id, name) DO UPDATE SET category = excluded.category,
                generic_name = excluded.generic_name, updated_at = datetime('now')`,
        args: [userId, name, it.category, it.generic_name],
      });
    }
  }
}

export async function createReceipt(userId: number, input: ReceiptInput, images: UploadImage[]): Promise<number> {
  const db = await getDb();
  const tx = await db.transaction("write");
  try {
    const rs = await tx.execute({
      sql: `INSERT INTO receipts (user_id, store, purchased_at, total, discount, note) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [userId, input.store, input.purchased_at, input.total, input.discount, input.note],
    });
    const receiptId = Number(rs.lastInsertRowid);
    await insertItems(tx, userId, receiptId, input);
    for (const [position, img] of images.entries()) {
      await tx.execute({
        sql: "INSERT INTO receipt_images (receipt_id, position, media_type, data) VALUES (?, ?, ?, ?)",
        args: [receiptId, position, img.media_type, Buffer.from(img.data, "base64")],
      });
    }
    await rememberCategories(tx, userId, input);
    await tx.commit();
    return receiptId;
  } finally {
    tx.close();
  }
}

export async function updateReceipt(userId: number, id: number, input: ReceiptInput): Promise<boolean> {
  const db = await getDb();
  const tx = await db.transaction("write");
  try {
    const rs = await tx.execute({
      sql: `UPDATE receipts SET store = ?, purchased_at = ?, total = ?, discount = ?, note = ? WHERE id = ? AND user_id = ?`,
      args: [input.store, input.purchased_at, input.total, input.discount, input.note, id, userId],
    });
    if (rs.rowsAffected === 0) return false;
    await tx.execute({ sql: "DELETE FROM receipt_items WHERE receipt_id = ? AND user_id = ?", args: [id, userId] });
    await insertItems(tx, userId, id, input);
    await rememberCategories(tx, userId, input);
    await tx.commit();
    return true;
  } finally {
    tx.close();
  }
}

export async function deleteReceipt(userId: number, id: number): Promise<boolean> {
  const db = await getDb();
  const owned = await db.execute({ sql: "SELECT 1 FROM receipts WHERE id = ? AND user_id = ?", args: [id, userId] });
  if (owned.rows.length === 0) return false;
  await db.batch(
    [
      { sql: "DELETE FROM receipt_items WHERE receipt_id = ?", args: [id] },
      { sql: "DELETE FROM receipt_images WHERE receipt_id = ?", args: [id] },
      { sql: "DELETE FROM receipts WHERE id = ? AND user_id = ?", args: [id, userId] },
    ],
    "write",
  );
  return true;
}

export async function getImage(
  userId: number,
  receiptId: number,
  position: number,
): Promise<{ media_type: string; data: ArrayBuffer } | null> {
  const db = await getDb();
  const rs = await db.execute({
    sql: `SELECT img.media_type, img.data FROM receipt_images img
          JOIN receipts r ON r.id = img.receipt_id
          WHERE img.receipt_id = ? AND img.position = ? AND r.user_id = ?`,
    args: [receiptId, position, userId],
  });
  const row = rs.rows[0];
  if (!row) return null;
  return { media_type: String(row.media_type), data: row.data as ArrayBuffer };
}

// 识别结果按用户以前确认过的品类修正
export async function applyCategoryRules<
  T extends { name: string; raw_name: string; category: string; generic_name: string },
>(
  userId: number,
  items: T[],
): Promise<T[]> {
  const names = [...new Set(items.flatMap((it) => [it.name, it.raw_name]).filter(Boolean))];
  if (names.length === 0) return items;
  const db = await getDb();
  const rs = await db.execute({
    sql: `SELECT name, category, generic_name FROM category_rules WHERE user_id = ? AND name IN (${names.map(() => "?").join(",")})`,
    args: [userId, ...names],
  });
  const rules = new Map(
    rs.rows.map((r) => [String(r.name), { category: String(r.category), generic_name: String(r.generic_name ?? "") }]),
  );
  return items.map((it) => {
    const byRaw = rules.get(it.raw_name);
    const byName = rules.get(it.name);
    const rule = byRaw ?? byName;
    if (!rule) return it;
    const generic = byRaw?.generic_name || byName?.generic_name || it.generic_name;
    return { ...it, category: rule.category, generic_name: generic };
  });
}

const MONTH_RE = /^\d{4}-\d{2}$/;

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function monthlyStats(userId: number, month: string, end: string): Promise<MonthlyStats | string> {
  if (!MONTH_RE.test(month) || !MONTH_RE.test(end)) return "月份格式应为 YYYY-MM";
  const db = await getDb();
  const start = shiftMonth(end, -11);
  const [trend, cats, stores] = await Promise.all([
    db.execute({
      sql: `SELECT substr(purchased_at, 1, 7) AS month, SUM(total) AS total, COUNT(*) AS n
            FROM receipts WHERE user_id = ? AND substr(purchased_at, 1, 7) BETWEEN ? AND ?
            GROUP BY month`,
      args: [userId, start, end],
    }),
    db.execute({
      sql: `SELECT i.category, SUM(i.amount) AS amount
            FROM receipt_items i JOIN receipts r ON r.id = i.receipt_id
            WHERE i.user_id = ? AND substr(r.purchased_at, 1, 7) = ?
            GROUP BY i.category ORDER BY amount DESC`,
      args: [userId, month],
    }),
    db.execute({
      sql: `SELECT store, COUNT(*) AS visits, SUM(total) AS total, MAX(purchased_at) AS last
            FROM receipts WHERE user_id = ? AND substr(purchased_at, 1, 7) = ? GROUP BY store`,
      args: [userId, month],
    }),
  ]);
  const byMonth = new Map(trend.rows.map((r) => [String(r.month), { total: Number(r.total), receipts: Number(r.n) }]));
  // 选中的月份可能不在趋势范围内，单独查一次
  let selected = byMonth.get(month);
  if (!selected) {
    const rs = await db.execute({
      sql: `SELECT SUM(total) AS total, COUNT(*) AS n FROM receipts WHERE user_id = ? AND substr(purchased_at, 1, 7) = ?`,
      args: [userId, month],
    });
    selected = { total: Number(rs.rows[0]?.total ?? 0), receipts: Number(rs.rows[0]?.n ?? 0) };
  }
  return {
    months: Array.from({ length: 12 }, (_, i) => {
      const m = shiftMonth(start, i);
      return { month: m, ...(byMonth.get(m) ?? { total: 0, receipts: 0 }) };
    }),
    month,
    total: selected.total,
    receipts: selected.receipts,
    categories: cats.rows.map((r) => ({ category: String(r.category), amount: Number(r.amount) })),
    stores: mergeStores(
      await storeNames(userId),
      stores.rows.map((r) => ({
        name: String(r.store ?? ""),
        visits: Number(r.visits),
        total: Number(r.total),
        last: String(r.last),
      })),
    ).map(({ store, visits, total }) => ({ store, visits, total })),
  };
}

export type DuplicateCandidate = { id: number; store: string; purchased_at: string; total: number };

// 同一天、金额相同的小票视为可能重复（拍了两次、或者识别时间有一两分钟偏差）
export async function findDuplicate(
  userId: number,
  input: { purchased_at: string; total: number },
  excludeId?: number,
): Promise<DuplicateCandidate | null> {
  const db = await getDb();
  const rs = await db.execute({
    sql: `SELECT id, store, purchased_at, total FROM receipts
          WHERE user_id = ? AND substr(purchased_at, 1, 10) = ? AND abs(total - ?) < 0.005 AND id != ?
          ORDER BY abs(julianday(purchased_at) - julianday(?)) LIMIT 1`,
    args: [userId, input.purchased_at.slice(0, 10), input.total, excludeId ?? 0, input.purchased_at],
  });
  const row = rs.rows[0];
  return row
    ? { id: Number(row.id), store: String(row.store ?? ""), purchased_at: String(row.purchased_at), total: Number(row.total) }
    : null;
}

// 查找现有数据里可能重复的小票，按 日期 + 金额 分组
export async function listDuplicateGroups(userId: number): Promise<(DuplicateCandidate & { item_count: number })[][]> {
  const db = await getDb();
  const rs = await db.execute({
    sql: `SELECT r.id, r.store, r.purchased_at, r.total,
            (SELECT COUNT(*) FROM receipt_items i WHERE i.receipt_id = r.id) AS item_count,
            substr(r.purchased_at, 1, 10) || '|' || CAST(round(r.total * 100) AS INTEGER) AS k
          FROM receipts r
          WHERE r.user_id = ? AND (substr(r.purchased_at, 1, 10) || '|' || CAST(round(r.total * 100) AS INTEGER)) IN (
            SELECT substr(purchased_at, 1, 10) || '|' || CAST(round(total * 100) AS INTEGER) AS k2
            FROM receipts WHERE user_id = ? GROUP BY k2 HAVING COUNT(*) > 1)
          ORDER BY r.purchased_at DESC, r.id`,
    args: [userId, userId],
  });
  const groups = new Map<string, (DuplicateCandidate & { item_count: number })[]>();
  for (const row of rs.rows) {
    const k = String(row.k);
    groups.set(k, [
      ...(groups.get(k) ?? []),
      {
        id: Number(row.id),
        store: String(row.store ?? ""),
        purchased_at: String(row.purchased_at),
        total: Number(row.total),
        item_count: Number(row.item_count),
      },
    ]);
  }
  return [...groups.values()];
}

// 按店铺汇总：去过几次、花了多少、最近一次
export async function listStores(userId: number, f: Filters): Promise<StoreSummary[]> {
  const db = await getDb();
  const args: unknown[] & InArgs = [userId];
  const where = ["user_id = ?"];
  if (f.from) {
    where.push("purchased_at >= ?");
    args.push(f.from);
  }
  if (f.to) {
    where.push("purchased_at <= ?");
    args.push(`${f.to} 99:99`);
  }
  const rs = await db.execute({
    sql: `SELECT store, COUNT(*) AS visits, SUM(total) AS total, MAX(purchased_at) AS last
          FROM receipts WHERE ${where.join(" AND ")} GROUP BY store`,
    args,
  });
  return mergeStores(
    await storeNames(userId),
    rs.rows.map((r) => ({
      name: String(r.store ?? ""),
      visits: Number(r.visits),
      total: Number(r.total),
      last: String(r.last),
    })),
  );
}

// 店名解析：基于该用户全部小票计算，保证不同日期范围下同一家店的名字一致
async function storeNames(userId: number): Promise<{ names: Map<string, string>; aliases: Map<string, string> }> {
  const db = await getDb();
  const [rs, aliases] = await Promise.all([
    db.execute({ sql: "SELECT DISTINCT store FROM receipts WHERE user_id = ?", args: [userId] }),
    loadStoreAliases(userId),
  ]);
  return { names: resolveStoreNames(rs.rows.map((r) => String(r.store ?? "")), aliases), aliases };
}

function mergeStores(
  { names, aliases }: { names: Map<string, string>; aliases: Map<string, string> },
  rows: { name: string; visits: number; total: number; last: string }[],
): StoreSummary[] {
  const merged = new Map<string, StoreSummary>();
  for (const r of rows) {
    const key = names.get(r.name) ?? r.name;
    const cur = merged.get(key) ?? { store: key, visits: 0, total: 0, last: "", names: [], custom: false };
    if (aliases.has(r.name)) cur.custom = true;
    cur.visits += r.visits;
    cur.total += r.total;
    if (r.last > cur.last) cur.last = r.last;
    cur.names.push(r.name);
    merged.set(key, cur);
  }
  return [...merged.values()].sort((a, b) => b.total - a.total);
}

export async function loadStoreAliases(userId: number): Promise<Map<string, string>> {
  const db = await getDb();
  const rs = await db.execute({ sql: "SELECT name, canonical FROM store_aliases WHERE user_id = ?", args: [userId] });
  return new Map(rs.rows.map((r) => [String(r.name), String(r.canonical)]));
}

// 把若干家店合并成一家：这些店（含它们已合并的各种写法）的原始店名都指向 canonical
export async function mergeStoreNames(userId: number, stores: string[], canonical: string): Promise<number> {
  const db = await getDb();
  const wanted = new Set(stores);
  const names = [...(await storeNames(userId)).names].filter(([, display]) => wanted.has(display)).map(([raw]) => raw);
  if (names.length === 0) return 0;
  await db.batch(
    names.map((name) => ({
      sql: `INSERT INTO store_aliases (user_id, name, canonical) VALUES (?, ?, ?)
            ON CONFLICT(user_id, name) DO UPDATE SET canonical = excluded.canonical`,
      args: [userId, name, canonical],
    })),
    "write",
  );
  return names.length;
}

// 取消手动合并，恢复按自动规则显示
export async function unmergeStore(userId: number, canonical: string): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: "DELETE FROM store_aliases WHERE user_id = ? AND canonical = ?", args: [userId, canonical] });
}
