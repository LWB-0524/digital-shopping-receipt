import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { listDuplicateGroups } from "@/lib/receipts";

export async function GET() {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;
  return NextResponse.json({ groups: await listDuplicateGroups(session.userId) });
}
