import { NextResponse, type NextRequest } from "next/server";
import { jsonError, requireSession } from "@/lib/auth";
import { createReceipt, filtersFromSearchParams, findDuplicate, listReceipts } from "@/lib/receipts";
import { parseImages, parseReceipt } from "@/lib/validate";

export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;
  const receipts = await listReceipts(session.userId, filtersFromSearchParams(request.nextUrl.searchParams));
  return NextResponse.json({ receipts });
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const body = await request.json().catch(() => null);
  const receipt = parseReceipt(body?.receipt);
  if (typeof receipt === "string") return jsonError(receipt, 400);
  const images = parseImages(body?.images);
  if (typeof images === "string") return jsonError(images, 400);

  // 疑似重复时先提醒，用户确认后带 force 再保存
  if (body?.force !== true) {
    const duplicate = await findDuplicate(session.userId, receipt);
    if (duplicate) {
      return NextResponse.json({ error: "可能是重复的小票", duplicate }, { status: 409 });
    }
  }

  const id = await createReceipt(session.userId, receipt, images);
  return NextResponse.json({ id }, { status: 201 });
}
