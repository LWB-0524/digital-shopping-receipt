"use client";

import { useState } from "react";
import { CATEGORY_GROUPS } from "@/lib/categories";
import { money, trimNumber } from "@/lib/format";
import type { ReceiptInput } from "@/lib/types";

// 编辑时数字先按字符串保存，方便输入 "0." 这类中间状态
type DraftItem = {
  key: number;
  name: string;
  raw_name: string;
  generic_name: string;
  category: string;
  quantity: string;
  unit: string;
  unit_price: string;
  amount: string;
};

let nextKey = 1;

function toDraft(input: ReceiptInput) {
  return {
    store: input.store,
    datetime: input.purchased_at.replace(" ", "T"),
    total: trimNumber(input.total),
    discount: trimNumber(input.discount),
    note: input.note,
    items: input.items.map(
      (it): DraftItem => ({
        key: nextKey++,
        name: it.name,
        raw_name: it.raw_name,
        generic_name: it.generic_name,
        category: it.category,
        quantity: trimNumber(it.quantity),
        unit: it.unit,
        unit_price: trimNumber(it.unit_price),
        amount: trimNumber(it.amount),
      }),
    ),
  };
}

const toNum = (s: string) => {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

export function ReceiptEditor({
  initial,
  warnings,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: ReceiptInput;
  warnings?: string;
  submitLabel: string;
  onSubmit: (input: ReceiptInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState(() => toDraft(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setItem = (key: number, patch: Partial<DraftItem>) =>
    setDraft((d) => ({
      ...d,
      items: d.items.map((it) => {
        if (it.key !== key) return it;
        const next = { ...it, ...patch };
        // 改了数量或单价时自动算出金额
        if (("quantity" in patch || "unit_price" in patch) && next.quantity && next.unit_price) {
          next.amount = trimNumber(Math.round(toNum(next.quantity) * toNum(next.unit_price) * 100) / 100);
        }
        return next;
      }),
    }));

  const itemsSum = draft.items.reduce((s, it) => s + toNum(it.amount), 0);
  const expected = itemsSum - toNum(draft.discount);
  const mismatch = draft.items.length > 0 && Math.abs(expected - toNum(draft.total)) > 0.05;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(draft.datetime)) {
      setError("请填写购买时间");
      return;
    }
    if (draft.items.some((it) => !it.name.trim())) {
      setError("有商品没有填写名称");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        store: draft.store.trim(),
        purchased_at: draft.datetime.slice(0, 16).replace("T", " "),
        total: toNum(draft.total),
        discount: toNum(draft.discount),
        note: draft.note.trim(),
        items: draft.items.map((it) => ({
          name: it.name.trim(),
          raw_name: it.raw_name,
          generic_name: it.generic_name.trim(),
          category: it.category,
          quantity: toNum(it.quantity),
          unit: it.unit.trim(),
          unit_price: toNum(it.unit_price),
          amount: toNum(it.amount),
        })),
      });
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  const field = "w-full min-w-0 rounded-lg border border-line bg-card px-2.5 py-2 outline-none focus:border-accent";
  const label = "mb-1 block text-xs text-muted";

  return (
    <form onSubmit={submit} className="space-y-4">
      {warnings && (
        <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">识别提示：{warnings}</p>
      )}

      <div className="space-y-3 rounded-xl border border-line bg-card p-4">
        <div>
          <label className={label}>商店</label>
          <input className={field} value={draft.store} onChange={(e) => setDraft({ ...draft, store: e.target.value })} placeholder="商店名称" />
        </div>
        <div>
          <label className={label}>购买时间</label>
          <input
            type="datetime-local"
            className={field}
            value={draft.datetime}
            onChange={(e) => setDraft({ ...draft, datetime: e.target.value })}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>实付合计（元）</label>
            <input className={field} inputMode="decimal" value={draft.total} onChange={(e) => setDraft({ ...draft, total: e.target.value })} />
          </div>
          <div>
            <label className={label}>整单优惠（元）</label>
            <input className={field} inputMode="decimal" value={draft.discount} onChange={(e) => setDraft({ ...draft, discount: e.target.value })} />
          </div>
        </div>
        <p className={`text-xs ${mismatch ? "text-warn" : "text-muted"}`}>
          商品合计 {money(itemsSum)} − 优惠 {money(toNum(draft.discount))} = {money(expected)}
          {mismatch ? "，与实付合计不一致，请核对" : " ✓"}
        </p>
      </div>

      <div>
        <h2 className="mb-2 px-1 text-sm font-medium text-muted">商品（{draft.items.length}）</h2>
        <ul className="space-y-2">
          {draft.items.map((it) => (
            <li key={it.key} className="space-y-2 rounded-xl border border-line bg-card p-3">
              <div className="flex gap-2">
                <input
                  className={`${field} flex-1`}
                  value={it.name}
                  onChange={(e) => setItem(it.key, { name: e.target.value })}
                  placeholder="商品名称"
                  aria-label="商品名称"
                />
                <input
                  className={`${field} w-20 shrink-0`}
                  value={it.generic_name}
                  onChange={(e) => setItem(it.key, { generic_name: e.target.value })}
                  placeholder="通用名"
                  aria-label="通用名（如 鸡蛋）"
                />
                <button
                  type="button"
                  className="shrink-0 px-2 text-sm text-danger"
                  onClick={() => setDraft({ ...draft, items: draft.items.filter((x) => x.key !== it.key) })}
                  aria-label="删除这个商品"
                >
                  删除
                </button>
              </div>
              {it.raw_name && it.raw_name !== it.name && <p className="text-xs text-muted">小票原文：{it.raw_name}</p>}
              <div className="grid grid-cols-[1.3fr_1fr_0.8fr] gap-2">
                <select className={field} value={it.category} onChange={(e) => setItem(it.key, { category: e.target.value })} aria-label="品类">
                  {CATEGORY_GROUPS.map((g) => (
                    <optgroup key={g.group} label={g.group}>
                      {g.categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <input className={field} inputMode="decimal" value={it.quantity} onChange={(e) => setItem(it.key, { quantity: e.target.value })} aria-label="数量" placeholder="数量" />
                <input className={field} value={it.unit} onChange={(e) => setItem(it.key, { unit: e.target.value })} aria-label="单位" placeholder="单位" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-1.5 text-xs whitespace-nowrap text-muted">
                  单价
                  <input className={field} inputMode="decimal" value={it.unit_price} onChange={(e) => setItem(it.key, { unit_price: e.target.value })} />
                </label>
                <label className="flex items-center gap-1.5 text-xs whitespace-nowrap text-muted">
                  金额
                  <input className={field} inputMode="decimal" value={it.amount} onChange={(e) => setItem(it.key, { amount: e.target.value })} />
                </label>
              </div>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-2 w-full rounded-xl border border-dashed border-line py-2.5 text-sm text-accent"
          onClick={() =>
            setDraft({
              ...draft,
              items: [
                ...draft.items,
                { key: nextKey++, name: "", raw_name: "", generic_name: "", category: "其他", quantity: "1", unit: "", unit_price: "", amount: "" },
              ],
            })
          }
        >
          + 添加商品
        </button>
      </div>

      <div>
        <label className={label}>备注</label>
        <textarea className={field} rows={2} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-3">
        {onCancel && (
          <button type="button" className="flex-1 rounded-lg border border-line bg-card py-2.5" onClick={onCancel} disabled={saving}>
            取消
          </button>
        )}
        <button type="submit" className="flex-[2] rounded-lg bg-accent py-2.5 font-medium text-white disabled:opacity-60" disabled={saving}>
          {saving ? "保存中…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
