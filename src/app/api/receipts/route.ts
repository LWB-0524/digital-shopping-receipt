import { NextResponse, type NextRequest } from "next/server";
import { jsonError, requireSession } from "@/lib/auth";
import { createReceipt, filtersFromSearchParams, listReceipts } from "@/lib/receipts";
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

  const id = await createReceipt(session.userId, receipt, images);
  return NextResponse.json({ id }, { status: 201 });
}
