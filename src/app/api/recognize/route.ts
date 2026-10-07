import { NextResponse } from "next/server";
import { jsonError, requireSession } from "@/lib/auth";
import { RecognizeError, recognizeReceipt } from "@/lib/recognize";
import { applyCategoryRules, listStores, loadStoreAliases } from "@/lib/receipts";
import { parseImages } from "@/lib/validate";

// 大模型读图一般需要十几到几十秒
export const maxDuration = 120;

export async function POST(request: Request) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const body = await request.json().catch(() => null);
  const images = parseImages(body?.images);
  if (typeof images === "string") return jsonError(images, 400);
  if (images.length === 0) return jsonError("请先拍照或选择小票图片", 400);
  const today = typeof body?.today === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(body.today) ? body.today : "";

  try {
    // 告诉模型用户去过哪些店，尽量沿用已有店名，避免同一家店出现多种写法
    const [stores, aliases] = await Promise.all([listStores(session.userId, {}), loadStoreAliases(session.userId)]);
    const knownStores = stores
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 40)
      .map((s) => s.store);
    const result = await recognizeReceipt(
      images,
      today || new Date().toISOString().slice(0, 16).replace("T", " "),
      knownStores,
    );
    result.store = aliases.get(result.store) ?? result.store;
    result.items = await applyCategoryRules(session.userId, result.items);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof RecognizeError) return jsonError(err.message, err.status);
    console.error("recognize failed", err);
    return jsonError("识别失败，请重试", 500);
  }
}
