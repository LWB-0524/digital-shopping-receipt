import { NextResponse } from "next/server";
import { jsonError, requireSession } from "@/lib/auth";
import { RecognizeError, recognizeReceipt } from "@/lib/recognize";
import { applyCategoryRules } from "@/lib/receipts";
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
    const result = await recognizeReceipt(images, today || new Date().toISOString().slice(0, 16).replace("T", " "));
    result.items = await applyCategoryRules(session.userId, result.items);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof RecognizeError) return jsonError(err.message, err.status);
    console.error("recognize failed", err);
    return jsonError("识别失败，请重试", 500);
  }
}
