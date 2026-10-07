"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ClientOnly } from "@/components/ClientOnly";
import { FilterBar, filterQuery, loadFilters, saveFilters, type FilterState } from "@/components/FilterBar";
import { useDebounced } from "@/components/useDebounced";
import { api, dateLabel, money } from "@/lib/format";
import type { ReceiptSummary } from "@/lib/types";

export default function ReceiptsPage() {
  return (
    <AppShell title="我的小票" action={<LogoutButton />}>
      <ClientOnly>
        <ReceiptList />
      </ClientOnly>
    </AppShell>
  );
}

function ReceiptList() {
  const [filters, setFilters] = useState<FilterState>(() => loadFilters("receipts"));
  const query = useDebounced(filterQuery(filters));
  const [result, setResult] = useState<{ query: string; receipts: ReceiptSummary[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api<{ receipts: ReceiptSummary[] }>(`/api/receipts?${query}`)
      .then((data) => !cancelled && (setResult({ query, receipts: data.receipts }), setError("")))
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [query]);

  const loading = result?.query !== query;
  const receipts = useMemo(() => result?.receipts ?? [], [result]);
  const days = useMemo(() => {
    const map = new Map<string, ReceiptSummary[]>();
    for (const r of receipts) {
      const day = r.purchased_at.slice(0, 10);
      map.set(day, [...(map.get(day) ?? []), r]);
    }
    return [...map.entries()];
  }, [receipts]);
  const total = receipts.reduce((sum, r) => sum + r.total, 0);

  return (
    <div className="space-y-4">
      <FilterBar
        value={filters}
        onChange={(next) => {
          setFilters(next);
          saveFilters("receipts", next);
        }}
      />

      <div className="flex items-baseline justify-between rounded-xl bg-accent px-4 py-3 text-white">
        <span className="text-sm opacity-90">{receipts.length} 张小票</span>
        <span className="tabular text-xl font-semibold">{money(total)}</span>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {!result && !error && <p className="py-10 text-center text-sm text-muted">加载中…</p>}
      {result && receipts.length === 0 && (
        <div className="py-12 text-center text-sm text-muted">
          <p>这段时间还没有小票</p>
          <Link href="/scan" className="mt-3 inline-block rounded-lg bg-accent px-4 py-2 text-white">
            拍第一张小票
          </Link>
        </div>
      )}

      <div className={`space-y-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
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
      </div>
    </div>
  );
}

function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-sm text-muted"
      onClick={async () => {
        if (!confirm("确定退出登录？")) return;
        await api("/api/auth/logout", { method: "POST" });
        router.replace("/login");
        router.refresh();
      }}
    >
      退出
    </button>
  );
}
