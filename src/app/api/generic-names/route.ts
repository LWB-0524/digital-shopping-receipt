import { NextResponse } from "next/server";
import { jsonError, requireSession } from "@/lib/auth";
import { countMissingGenericNames, fillGenericNamesBatch } from "@/lib/genericNames";
import { RecognizeError } from "@/lib/recognize";

export const maxDuration = 120;

export async function GET() {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;
  return NextResponse.json({ remaining: await countMissingGenericNames(session.userId) });
}

export async function POST() {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;
  try {
    return NextResponse.json(await fillGenericNamesBatch(session.userId));
  } catch (err) {
    if (err instanceof RecognizeError) return jsonError(err.message, err.status);
    console.error("fill generic names failed", err);
    return jsonError("整理失败，请重试", 500);
  }
}
