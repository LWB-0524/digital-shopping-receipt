import { CATEGORIES, isCategory } from "./categories";
import type { ReceiptInput, ReceiptItemInput, UploadImage } from "./types";

// 校验并清洗客户端提交的数据。返回 string 表示错误信息。

const DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
const MAX_ITEMS = 300;
export const MAX_IMAGES = 4;
const MAX_IMAGE_BASE64_LENGTH = 3_000_000; // 约 2.2MB 原始图片

function num(value: unknown, fallback = 0): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n * 1000) / 1000 : fallback;
}

function str(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parseItem(raw: unknown): ReceiptItemInput | string {
  if (!raw || typeof raw !== "object") return "商品数据格式错误";
  const r = raw as Record<string, unknown>;
  const name = str(r.name) || str(r.raw_name);
  if (!name) return "商品名称不能为空";
  return {
    name,
    raw_name: str(r.raw_name),
    category: isCategory(r.category) ? r.category : CATEGORIES[CATEGORIES.length - 1],
    quantity: num(r.quantity, 1),
    unit: str(r.unit, 20),
    unit_price: num(r.unit_price),
    amount: num(r.amount),
  };
}

export function parseReceipt(raw: unknown): ReceiptInput | string {
  if (!raw || typeof raw !== "object") return "数据格式错误";
  const r = raw as Record<string, unknown>;
  const purchased_at = str(r.purchased_at, 16);
  if (!DATETIME_RE.test(purchased_at)) return "购买时间格式应为 YYYY-MM-DD HH:MM";
  if (!Array.isArray(r.items)) return "缺少商品列表";
  if (r.items.length > MAX_ITEMS) return `一张小票最多 ${MAX_ITEMS} 个商品`;
  const items: ReceiptItemInput[] = [];
  for (const it of r.items) {
    const parsed = parseItem(it);
    if (typeof parsed === "string") return parsed;
    items.push(parsed);
  }
  return {
    store: str(r.store, 100),
    purchased_at,
    total: num(r.total),
    discount: num(r.discount),
    note: str(r.note, 500),
    items,
  };
}

export function parseImages(raw: unknown): UploadImage[] | string {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return "图片数据格式错误";
  if (raw.length > MAX_IMAGES) return `最多上传 ${MAX_IMAGES} 张图片`;
  const images: UploadImage[] = [];
  for (const img of raw) {
    const r = (img ?? {}) as Record<string, unknown>;
    const media_type = r.media_type;
    if (media_type !== "image/jpeg" && media_type !== "image/png" && media_type !== "image/webp") {
      return "只支持 JPEG / PNG / WebP 图片";
    }
    if (typeof r.data !== "string" || r.data.length === 0) return "图片内容为空";
    if (r.data.length > MAX_IMAGE_BASE64_LENGTH) return "图片太大，请重新拍摄";
    images.push({ media_type, data: r.data });
  }
  return images;
}
