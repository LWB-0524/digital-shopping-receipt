"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ClientOnly } from "@/components/ClientOnly";
import { FilterBar, filterQuery, loadFilters, saveFilters, type FilterState } from "@/components/FilterBar";
import { useDebounced } from "@/components/useDebounced";
import { api, dateLabel, money, trimNumber } from "@/lib/format";
import type { ItemRow, ReceiptSummary } from "@/lib/types";

export default function ReceiptsPage() {
  return (
    <AppShell title="我的小票">
      <ClientOnly>
        <ReceiptList />
      </ClientOnly>
    </AppShell>
  );
}

type Result =
  | { query: string; mode: "receipts"; receipts: ReceiptSummary[] }
  | { query: string; mode: "items"; items: ItemRow[] };

function ReceiptList() {
  const [filters, setFilters] = useState<FilterState>(() => loadFilters("receipts"));
  const query = useDebounced(filterQuery(filters));
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    // 有关键词或品类条件时直接列出匹配的商品，否则按小票列出
    const params = new URLSearchParams(query);
    const itemMode = params.has("q") || params.has("group") || params.has("category");
    const request: Promise<Result> = itemMode
      ? api<{ items: ItemRow[] }>(`/api/items?${query}`).then((d) => ({ query, mode: "items", items: d.items }))
      : api<{ receipts: ReceiptSummary[] }>(`/api/receipts?${query}`).then((d) => ({
          query,
          mode: "receipts",
          receipts: d.receipts,
        }));
    request
      .then((data) => !cancelled && (setResult(data), setError("")))
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [query]);

  const loading = result?.query !== query;

  return (
    <div className="space-y-4">
      <FilterBar
        value={filters}
        onChange={(next) => {
          setFilters(next);
          saveFilters("receipts", next);
        }}
      />

      {error && <p className="text-sm text-danger">{error}</p>}
      {!result && !error && <p className="py-10 text-center text-sm text-muted">加载中…</p>}

      <div className={`space-y-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
        {result?.mode === "receipts" && <ReceiptGroups receipts={result.receipts} />}
        {result?.mode === "items" && <ItemMatches items={result.items} showPrices={new URLSearchParams(result.query).has("q")} />}
      </div>
    </div>
  );
}

function groupByDay<T extends { purchased_at: string }>(rows: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const day = r.purchased_at.slice(0, 10);
    map.set(day, [...(map.get(day) ?? []), r]);
  }
  return [...map.entries()];
}

function SummaryBar({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-baseline justify-between rounded-xl bg-accent px-4 py-3 text-white">
      <span className="text-sm opacity-90">{label}</span>
      <span className="tabular text-xl font-semibold">{money(amount)}</span>
    </div>
  );
}

function ReceiptGroups({ receipts }: { receipts: ReceiptSummary[] }) {
  const days = useMemo(() => groupByDay(receipts), [receipts]);
  return (
    <>
      <SummaryBar label={`${receipts.length} 张小票`} amount={receipts.reduce((s, r) => s + r.total, 0)} />
      {receipts.length === 0 && (
        <div className="py-12 text-center text-sm text-muted">
          <p>这段时间还没有小票</p>
          <Link href="/scan" className="mt-3 inline-block rounded-lg bg-accent px-4 py-2 text-white">
            拍第一张小票
          </Link>
        </div>
      )}
      {days.map(([day, list]) => (
        <section key={day}>
          <div className="mb-1.5 flex items-baseline justify-between px-1 text-sm text-muted">
            <span>{dateLabel(day)}</span>
            <span className="tabular">{money(list.reduce((s, r) => s + r.total, 0))}</span>
          </div>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
            {list.map((r) => (
              <li key={r.id}>
                <Link href={`/receipts/${r.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-bg">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate font-medium">{r.store || "未命名商店"}</span>
                      <span className="shrink-0 text-xs text-muted">{r.purchased_at.slice(11)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted">
                      {r.item_count} 件 · {r.preview}
                    </p>
                  </div>
                  <span className="tabular shrink-0 font-semibold">{money(r.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

// 搜索结果：匹配到的商品，按所属小票分组
function ItemMatches({ items, showPrices }: { items: ItemRow[]; showPrices: boolean }) {
  const receipts = useMemo(() => {
    const map = new Map<number, ItemRow[]>();
    for (const it of items) map.set(it.receipt_id, [...(map.get(it.receipt_id) ?? []), it]);
    return [...map.values()].map((list) => ({
      id: list[0].receipt_id,
      store: list[0].store,
      purchased_at: list[0].purchased_at,
      items: list,
    }));
  }, [items]);
  const days = useMemo(() => groupByDay(receipts), [receipts]);

  return (
    <>
      <SummaryBar
        label={`${items.length} 件商品 · 来自 ${receipts.length} 张小票`}
        amount={items.reduce((s, it) => s + it.amount, 0)}
      />
      {items.length === 0 && <p className="py-12 text-center text-sm text-muted">没有找到符合条件的商品</p>}
      {showPrices && items.length >= 2 && <PriceCompare items={items} />}
      {days.map(([day, list]) => (
        <section key={day} className="space-y-2">
          <div className="px-1 text-sm text-muted">{dateLabel(day)}</div>
          {list.map((r) => (
            <div key={r.id} className="overflow-hidden rounded-xl border border-line bg-card">
              <Link
                href={`/receipts/${r.id}`}
                className="flex items-center justify-between gap-2 border-b border-line bg-bg/60 px-4 py-2 text-sm active:bg-bg"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium">{r.store || "未命名商店"}</span>
                  <span className="ml-2 text-xs text-muted">{r.purchased_at.slice(11)}</span>
                </span>
                <span className="shrink-0 text-xs text-accent">查看小票 ›</span>
              </Link>
              <ul className="divide-y divide-line">
                {r.items.map((it) => (
                  <li key={it.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{it.name}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs">
                        <span className="rounded bg-accent-soft px-1.5 py-px text-accent">{it.category}</span>
                        {it.generic_name && <span className="text-muted">{it.generic_name}</span>}
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
            </div>
          ))}
        </section>
      ))}
    </>
  );
}

function unitPrice(it: ItemRow): number {
  if (it.unit_price > 0) return it.unit_price;
  return it.quantity > 0 ? it.amount / it.quantity : it.amount;
}

type ProductStats = {
  name: string;
  unit: string;
  count: number;
  min: ItemRow;
  max: ItemRow;
};

// 价格对比：按通用名分组，组内每个具体商品列出买过几次、最低价和最高价（在哪家店、哪天）
function PriceCompare({ items }: { items: ItemRow[] }) {
  const groups = useMemo(() => {
    const byGeneric = new Map<string, Map<string, ItemRow[]>>();
    for (const it of items) {
      const generic = it.generic_name || it.name;
      const products = byGeneric.get(generic) ?? new Map<string, ItemRow[]>();
      products.set(it.name, [...(products.get(it.name) ?? []), it]);
      byGeneric.set(generic, products);
    }
    return [...byGeneric.entries()]
      .map(([generic, products]) => {
        const list: ProductStats[] = [...products.entries()].map(([name, rows]) => {
          const sorted = [...rows].sort((a, b) => unitPrice(a) - unitPrice(b));
          return { name, unit: rows[0].unit, count: rows.length, min: sorted[0], max: sorted[sorted.length - 1] };
        });
        list.sort((a, b) => b.count - a.count || unitPrice(a.min) - unitPrice(b.min));
        return { generic, count: list.reduce((s, p) => s + p.count, 0), products: list };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [items]);

  const where = (it: ItemRow) => `${it.store || "未命名商店"} · ${it.purchased_at.slice(5, 10).replace("-", "/")}`;

  return (
    <section className="rounded-xl border border-line bg-card p-4">
      <h2 className="font-medium">价格对比</h2>
      <div className="mt-2 space-y-4">
        {groups.map((g) => (
          <div key={g.generic}>
            <p className="text-sm text-muted">
              {g.generic} · 共买过 {g.count} 次{g.products.length > 1 && `，${g.products.length} 种商品`}
            </p>
            <ul className="mt-1.5 divide-y divide-line">
              {g.products.slice(0, 4).map((p) => (
                <li key={p.name} className="py-2 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate">{p.name}</span>
                    <span className="shrink-0 text-xs text-muted">{p.count} 次</span>
                  </div>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs">
                    <span>
                      <span className="text-accent">最低 {money(unitPrice(p.min))}</span>
                      {p.unit && `/${p.unit}`} <span className="text-muted">{where(p.min)}</span>
                    </span>
                    {unitPrice(p.max) > unitPrice(p.min) && (
                      <span>
                        <span className="text-warn">最高 {money(unitPrice(p.max))}</span>
                        {p.unit && `/${p.unit}`} <span className="text-muted">{where(p.max)}</span>
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
            {g.products.length > 4 && <p className="text-xs text-muted">还有 {g.products.length - 4} 种，见下方列表</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
