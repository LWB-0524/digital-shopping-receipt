"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ClientOnly } from "@/components/ClientOnly";
import { FilterBar, filterQuery, loadFilters, saveFilters, type FilterState } from "@/components/FilterBar";
import { useDebounced } from "@/components/useDebounced";
import { CATEGORY_GROUPS, groupOf } from "@/lib/categories";
import { api, money, trimNumber } from "@/lib/format";
import type { ItemRow } from "@/lib/types";

export default function ItemsPage() {
  return (
    <AppShell title="按品类查看">
      <ClientOnly>
        <ItemsView />
      </ClientOnly>
    </AppShell>
  );
}

function ItemsView() {
  const [filters, setFilters] = useState<FilterState>(() => loadFilters("items"));
  const query = useDebounced(filterQuery(filters));
  const [result, setResult] = useState<{ query: string; items: ItemRow[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api<{ items: ItemRow[] }>(`/api/items?${query}`)
      .then((data) => !cancelled && (setResult({ query, items: data.items }), setError("")))
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [query]);

  const update = (next: FilterState) => {
    setFilters(next);
    saveFilters("items", next);
  };

  const items = useMemo(() => result?.items ?? [], [result]);
  const total = items.reduce((s, it) => s + it.amount, 0);

  // 按 大类 → 小类 汇总金额
  const breakdown = useMemo(() => {
    const byCategory = new Map<string, number>();
    for (const it of items) byCategory.set(it.category, (byCategory.get(it.category) ?? 0) + it.amount);
    return CATEGORY_GROUPS.map((g) => {
      const cats = g.categories
        .map((c) => ({ category: c as string, amount: byCategory.get(c) ?? 0 }))
        .filter((c) => c.amount !== 0)
        .sort((a, b) => b.amount - a.amount);
      // 历史数据里可能有已不在列表中的品类，归入"其他"
      if (g.group === "其他") {
        for (const [c, amount] of byCategory) {
          if (groupOf(c) === "其他" && !cats.some((x) => x.category === c)) cats.push({ category: c, amount });
        }
      }
      return { group: g.group as string, amount: cats.reduce((s, c) => s + c.amount, 0), cats };
    })
      .filter((g) => g.cats.length > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [items]);
  const max = Math.max(...breakdown.flatMap((g) => g.cats.map((c) => c.amount)), 1);

  return (
    <div className="space-y-4">
      <FilterBar value={filters} onChange={update} />

      <div className="rounded-xl border border-line bg-card p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted">
            {filters.category || filters.group || "全部品类"} · {items.length} 件商品
          </span>
          <span className="tabular text-xl font-semibold">{money(total)}</span>
        </div>

        {breakdown.length > 0 && (
          <div className="mt-4 space-y-4">
            {breakdown.map((g) => (
              <div key={g.group}>
                <button
                  type="button"
                  className="flex w-full items-baseline justify-between text-sm font-medium"
                  onClick={() => update({ ...filters, group: g.group, category: "" })}
                >
                  <span>{g.group}</span>
                  <span className="tabular">
                    {money(g.amount)}
                    <span className="ml-1.5 text-xs font-normal text-muted">
                      {percent(g.amount, total)}
                    </span>
                  </span>
                </button>
                <div className="mt-1.5 space-y-1.5">
                  {g.cats.map((c) => (
                    <button
                      key={c.category}
                      type="button"
                      className="grid w-full grid-cols-[4.5rem_1fr_auto] items-center gap-2 text-left text-sm"
                      onClick={() => update({ ...filters, category: c.category, group: "" })}
                    >
                      <span className={`truncate ${filters.category === c.category ? "text-accent" : "text-muted"}`}>
                        {c.category}
                      </span>
                      <span className="h-2 overflow-hidden rounded-full bg-bg">
                        <span
                          className="block h-full rounded-full bg-accent"
                          style={{ width: `${Math.max(2, (c.amount / max) * 100)}%` }}
                        />
                      </span>
                      <span className="tabular w-16 text-right">{money(c.amount)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {(filters.group || filters.category) && (
          <button
            type="button"
            className="mt-4 text-sm text-accent"
            onClick={() => update({ ...filters, group: "", category: "" })}
          >
            查看全部品类
          </button>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {!result && !error && <p className="py-10 text-center text-sm text-muted">加载中…</p>}
      {result && items.length === 0 && <p className="py-10 text-center text-sm text-muted">没有符合条件的商品</p>}

      {items.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
          {items.map((it) => (
            <li key={it.id}>
              <Link href={`/receipts/${it.receipt_id}`} className="flex items-center gap-3 px-4 py-2.5 active:bg-bg">
                <div className="min-w-0 flex-1">
                  <p className="truncate">{it.name}</p>
                  <p className="truncate text-xs text-muted">
                    {it.purchased_at.slice(0, 10)} · {it.store || "未命名商店"} · {it.category}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tabular font-medium">{money(it.amount)}</p>
                  <p className="tabular text-xs text-muted">
                    {trimNumber(it.quantity)}
                    {it.unit} × {money(it.unit_price)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function percent(part: number, total: number): string {
  if (total <= 0) return "";
  const p = (part / total) * 100;
  return p > 0 && p < 1 ? "<1%" : `${Math.round(p)}%`;
}
