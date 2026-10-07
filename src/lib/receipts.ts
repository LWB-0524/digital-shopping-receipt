import "server-only";
import type { InArgs, Transaction } from "@libsql/client";
import { categoriesInGroup } from "./categories";
import { getDb } from "./db";
import type { ItemRow, ReceiptDetail, ReceiptInput, ReceiptSummary, UploadImage } from "./types";

export type Filters = {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  q?: string;
  group?: string;
  category?: string;
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
  };
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
    where.push("(i.name LIKE ? ESCAPE '\\' OR i.raw_name LIKE ? ESCAPE '\\' OR r.store LIKE ? ESCAPE '\\')");
    const like = `%${f.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    args.push(like, like, like);
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
  const rs = await db.execute({
    sql: `SELECT i.id, i.receipt_id, i.name, i.raw_name, i.category, i.quantity, i.unit, i.unit_price, i.amount,
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
      sql: `INSERT INTO receipt_items (receipt_id, user_id, position, name, raw_name, category, quantity, unit, unit_price, amount)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [receiptId, userId, position, it.name, it.raw_name, it.category, it.quantity, it.unit, it.unit_price, it.amount],
    });
  }
}

// 用户确认保存时记住每个商品的品类，下次识别同名商品直接套用
async function rememberCategories(tx: Transaction, userId: number, input: ReceiptInput) {
  for (const it of input.items) {
    for (const name of new Set([it.name, it.raw_name].filter(Boolean))) {
      await tx.execute({
        sql: `INSERT INTO category_rules (user_id, name, category) VALUES (?, ?, ?)
              ON CONFLICT(user_id, name) DO UPDATE SET category = excluded.category, updated_at = datetime('now')`,
        args: [userId, name, it.category],
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
export async function applyCategoryRules<T extends { name: string; raw_name: string; category: string }>(
  userId: number,
  items: T[],
): Promise<T[]> {
  const names = [...new Set(items.flatMap((it) => [it.name, it.raw_name]).filter(Boolean))];
  if (names.length === 0) return items;
  const db = await getDb();
  const rs = await db.execute({
    sql: `SELECT name, category FROM category_rules WHERE user_id = ? AND name IN (${names.map(() => "?").join(",")})`,
    args: [userId, ...names],
  });
  const rules = new Map(rs.rows.map((r) => [String(r.name), String(r.category)]));
  return items.map((it) => {
    const category = rules.get(it.raw_name) ?? rules.get(it.name);
    return category ? { ...it, category } : it;
  });
}
