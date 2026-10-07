import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";

export async function GET() {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;
  return NextResponse.json({ username: session.username });
}
