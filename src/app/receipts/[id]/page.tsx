"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ReceiptEditor } from "@/components/ReceiptEditor";
import { groupOf } from "@/lib/categories";
import { api, dateLabel, money, trimNumber } from "@/lib/format";
import type { ReceiptDetail, ReceiptInput } from "@/lib/types";

export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    api<ReceiptDetail>(`/api/receipts/${id}`)
      .then(setReceipt)
      .catch((err: Error) => setError(err.message));
  }, [id]);

  async function save(input: ReceiptInput) {
    await api(`/api/receipts/${id}`, { method: "PUT", body: JSON.stringify({ receipt: input }) });
    setReceipt(await api<ReceiptDetail>(`/api/receipts/${id}`));
    setEditing(false);
  }

  async function remove() {
    if (!confirm("确定删除这张小票？删除后无法恢复。")) return;
    try {
      await api(`/api/receipts/${id}`, { method: "DELETE" });
      router.replace("/");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const back = (
    <Link href="/" className="text-sm text-accent">
      返回列表
    </Link>
  );

  if (!receipt) {
    return (
      <AppShell title="小票详情" action={back}>
        <p className="py-10 text-center text-sm text-muted">{error || "加载中…"}</p>
      </AppShell>
    );
  }

  if (editing) {
    return (
      <AppShell title="编辑小票">
        <ReceiptEditor initial={receipt} submitLabel="保存修改" onSubmit={save} onCancel={() => setEditing(false)} />
      </AppShell>
    );
  }

  const itemsSum = receipt.items.reduce((s, it) => s + it.amount, 0);

  return (
    <AppShell title="小票详情" action={back}>
      <div className="space-y-4">
        <div className="rounded-xl border border-line bg-card p-4">
          <h2 className="text-lg font-semibold">{receipt.store || "未命名商店"}</h2>
          <p className="mt-0.5 text-sm text-muted">
            {dateLabel(receipt.purchased_at.slice(0, 10))} {receipt.purchased_at.slice(11)}
          </p>
          <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
            <span className="text-sm text-muted">
              {receipt.items.length} 件商品{receipt.discount > 0 && ` · 优惠 ${money(receipt.discount)}`}
            </span>
            <span className="tabular text-2xl font-semibold">{money(receipt.total)}</span>
          </div>
          {Math.abs(itemsSum - receipt.discount - receipt.total) > 0.05 && receipt.items.length > 0 && (
            <p className="mt-2 text-xs text-warn">
              商品合计 {money(itemsSum)} 与实付金额对不上，可以点「编辑」核对一下
            </p>
          )}
          {receipt.note && <p className="mt-2 text-sm">备注：{receipt.note}</p>}
        </div>

        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
          {receipt.items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate">{it.name}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                  <span className="rounded bg-accent-soft px-1.5 py-px text-accent">{it.category}</span>
                  <span>{groupOf(it.category)}</span>
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="tabular font-medium">{money(it.amount)}</p>
                <p className="tabular text-xs text-muted">
                  {trimNumber(it.quantity)}
                  {it.unit} × {money(it.unit_price)}
                </p>
              </div>
            </li>
          ))}
        </ul>

        {receipt.image_count > 0 && (
          <div>
            <h3 className="mb-2 px-1 text-sm text-muted">小票原图</h3>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
              {Array.from({ length: receipt.image_count }, (_, i) => (
                <a key={i} href={`/api/receipts/${receipt.id}/images/${i}`} target="_blank" rel="noreferrer" className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element -- 需要登录才能访问的图片，不走 next/image */}
                  <img
                    src={`/api/receipts/${receipt.id}/images/${i}`}
                    alt={`小票原图 ${i + 1}`}
                    className="h-40 rounded-lg border border-line object-cover object-top"
                  />
                </a>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex gap-3">
          <button type="button" className="flex-1 rounded-lg border border-line bg-card py-2.5 text-danger" onClick={remove}>
            删除
          </button>
          <button type="button" className="flex-[2] rounded-lg bg-accent py-2.5 font-medium text-white" onClick={() => setEditing(true)}>
            编辑
          </button>
        </div>
      </div>
    </AppShell>
  );
}
