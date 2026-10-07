import { NextResponse } from "next/server";
import { jsonError, requireSession } from "@/lib/auth";
import { mergeStoreNames, unmergeStore } from "@/lib/receipts";

// 合并店铺：{ stores: 要合并的店铺名, canonical: 合并后显示的名称 }
export async function POST(request: Request) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;
  const body = await request.json().catch(() => null);
  const stores = Array.isArray(body?.stores)
    ? body.stores.filter((s: unknown): s is string => typeof s === "string" && s.trim() !== "")
    : [];
  const canonical = typeof body?.canonical === "string" ? body.canonical.trim().slice(0, 100) : "";
  if (stores.length < 2 || stores.length > 50) return jsonError("请至少选择两家店", 400);
  if (!canonical) return jsonError("请填写合并后的店名", 400);
  const merged = await mergeStoreNames(session.userId, stores, canonical);
  if (merged === 0) return jsonError("没有找到这些店铺", 404);
  return NextResponse.json({ merged });
}

// 取消合并：{ store: 合并后的店铺名 }
export async function DELETE(request: Request) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;
  const body = await request.json().catch(() => null);
  const store = typeof body?.store === "string" ? body.store : "";
  if (!store) return jsonError("缺少店铺名", 400);
  await unmergeStore(session.userId, store);
  return NextResponse.json({ ok: true });
}
