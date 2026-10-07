import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { filtersFromSearchParams, listStores } from "@/lib/receipts";

export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;
  const stores = await listStores(session.userId, filtersFromSearchParams(request.nextUrl.searchParams));
  return NextResponse.json({ stores });
}
