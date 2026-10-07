import { NextResponse } from "next/server";
import { jsonError, requireSession } from "@/lib/auth";
import { deleteReceipt, getReceipt, updateReceipt } from "@/lib/receipts";
import { parseReceipt } from "@/lib/validate";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_req: Request, ctx: RouteContext<"/api/receipts/[id]">) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;
  const id = parseId((await ctx.params).id);
  const receipt = id ? await getReceipt(session.userId, id) : null;
  if (!receipt) return jsonError("小票不存在", 404);
  return NextResponse.json(receipt);
}

export async function PUT(request: Request, ctx: RouteContext<"/api/receipts/[id]">) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;
  const id = parseId((await ctx.params).id);
  if (!id) return jsonError("小票不存在", 404);

  const body = await request.json().catch(() => null);
  const receipt = parseReceipt(body?.receipt);
  if (typeof receipt === "string") return jsonError(receipt, 400);
  if (!(await updateReceipt(session.userId, id, receipt))) return jsonError("小票不存在", 404);
  return NextResponse.json({ id });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/receipts/[id]">) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;
  const id = parseId((await ctx.params).id);
  if (!id || !(await deleteReceipt(session.userId, id))) return jsonError("小票不存在", 404);
  return NextResponse.json({ ok: true });
}
