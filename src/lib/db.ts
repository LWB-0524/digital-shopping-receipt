import "server-only";
import { createClient, type Client } from "@libsql/client";

// 本地开发默认用项目目录下的 SQLite 文件；部署时指向 Turso 云数据库。
// 在 Vercel 里添加 Turso 集成会自动注入 TURSO_* 变量，也可以手动填 DATABASE_*。
const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "file:local.db";
const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || undefined;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    store TEXT NOT NULL DEFAULT '',
    purchased_at TEXT NOT NULL,
    total REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_receipts_user_date ON receipts(user_id, purchased_at)`,
  `CREATE TABLE IF NOT EXISTS receipt_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_id INTEGER NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    position INTEGER NOT NULL DEFAULT 0,
    name TEXT NOT NULL,
    raw_name TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1,
    unit TEXT NOT NULL DEFAULT '',
    unit_price REAL NOT NULL DEFAULT 0,
    amount REAL NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS idx_items_receipt ON receipt_items(receipt_id)`,
  `CREATE INDEX IF NOT EXISTS idx_items_user_category ON receipt_items(user_id, category)`,
  `CREATE TABLE IF NOT EXISTS receipt_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_id INTEGER NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    media_type TEXT NOT NULL,
    data BLOB NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_images_receipt ON receipt_images(receipt_id)`,
  // 记住用户确认过的"商品名 → 品类"，下次识别到同名商品时直接套用。
  `CREATE TABLE IF NOT EXISTS category_rules (
    user_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, name)
  )`,
];

// 后来新增的列。只做 ADD COLUMN，不改动已有数据；已存在的列会跳过。
const ADDED_COLUMNS: { table: string; column: string; definition: string }[] = [
  // 通用名：把不同品牌、不同叫法的同类商品归到一起（如"鸡蛋"），用于搜索和比价
  { table: "receipt_items", column: "generic_name", definition: "TEXT NOT NULL DEFAULT ''" },
  { table: "category_rules", column: "generic_name", definition: "TEXT NOT NULL DEFAULT ''" },
];

async function addMissingColumns(db: Client) {
  for (const { table, column, definition } of ADDED_COLUMNS) {
    const info = await db.execute(`PRAGMA table_info(${table})`);
    if (info.rows.some((r) => r.name === column)) continue;
    try {
      await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    } catch (err) {
      // 多个服务器实例同时启动时，可能已被另一个实例加上
      const again = await db.execute(`PRAGMA table_info(${table})`);
      if (!again.rows.some((r) => r.name === column)) throw err;
    }
  }
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_items_user_generic ON receipt_items(user_id, generic_name)",
  );
}

const globalForDb = globalThis as unknown as {
  receiptDb?: Client;
  receiptDbReady?: Promise<void>;
};

function client(): Client {
  if (!globalForDb.receiptDb) {
    globalForDb.receiptDb = createClient({ url, authToken });
  }
  return globalForDb.receiptDb;
}

// 首次访问时自动建表，部署后不需要手动跑迁移。
export async function getDb(): Promise<Client> {
  const db = client();
  if (!globalForDb.receiptDbReady) {
    globalForDb.receiptDbReady = (async () => {
      await db.execute("PRAGMA foreign_keys = ON");
      await db.batch(SCHEMA, "write");
      await addMissingColumns(db);
    })().catch((err) => {
      globalForDb.receiptDbReady = undefined;
      throw err;
    });
  }
  await globalForDb.receiptDbReady;
  return db;
}
