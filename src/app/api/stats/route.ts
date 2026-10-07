import { NextResponse, type NextRequest } from "next/server";
import { jsonError, requireSession } from "@/lib/auth";
import { monthlyStats } from "@/lib/receipts";

export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;
  const params = request.nextUrl.searchParams;
  const stats = await monthlyStats(session.userId, params.get("month") ?? "", params.get("end") ?? "");
  if (typeof stats === "string") return jsonError(stats, 400);
  return NextResponse.json(stats);
}
