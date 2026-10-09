import { NextResponse } from "next/server";
import { jsonError, requireSession } from "@/lib/auth";
import { RecognizeError } from "@/lib/recognize";
import { recognizeForUser } from "@/lib/recognizeForUser";
import { getReceiptImages } from "@/lib/receipts";

export const maxDuration = 120;

// 用已保存的照片重新识别，只返回识别结果，不保存；用户确认后再走 PUT 更新
export async function POST(request: Request, ctx: RouteContext<"/api/receipts/[id]/recognize">) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return jsonError("小票不存在", 404);

  const images = await getReceiptImages(session.userId, id);
  if (images.length === 0) return jsonError("这张小票没有保存照片，无法重新识别", 400);

  const body = await request.json().catch(() => null);
  const today = typeof body?.today === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(body.today) ? body.today : "";
  try {
    return NextResponse.json(await recognizeForUser(session.userId, images, today));
  } catch (err) {
    if (err instanceof RecognizeError) return jsonError(err.message, err.status);
    console.error("re-recognize failed", err);
    return jsonError("识别失败，请重试", 500);
  }
}
