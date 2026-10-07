import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { filtersFromSearchParams, listItems } from "@/lib/receipts";

export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;
  const items = await listItems(session.userId, filtersFromSearchParams(request.nextUrl.searchParams));
  return NextResponse.json({ items });
}
