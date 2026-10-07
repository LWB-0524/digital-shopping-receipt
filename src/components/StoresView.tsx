"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FilterBar, filterQuery, loadFilters, saveFilters, type FilterState } from "@/components/FilterBar";
import { dateLabel, api, money } from "@/lib/format";
import type { StoreSummary } from "@/lib/types";

// 按店铺查看：每家店去过几次、花了多少；点击后到首页查看这家店的小票
export function StoresView() {
  const router = useRouter();
  const [filters, setFilters] = useState<FilterState>(() => loadFilters("stores"));
  // 店铺列表只按日期范围查询，搜索框在本地过滤店名
  const query = filterQuery({ ...filters, q: "", group: "", category: "", store: "" });
  const [result, setResult] = useState<{ query: string; stores: StoreSummary[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api<{ stores: StoreSummary[] }>(`/api/stores?${query}`)
      .then((data) => !cancelled && (setResult({ query, stores: data.stores }), setError("")))
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [query]);

  const stores = useMemo(() => {
    const all = result?.stores ?? [];
    const q = filters.q.trim().toLowerCase();
    return q ? all.filter((s) => s.names.some((n) => n.toLowerCase().includes(q))) : all;
  }, [result, filters.q]);
  const total = stores.reduce((s, x) => s + x.total, 0);
  const max = Math.max(...stores.map((s) => s.total), 1);

  function open(store: string) {
    // 带着当前日期范围跳到首页，只看这家店的小票
    saveFilters("receipts", { ...loadFilters("receipts"), from: filters.from, to: filters.to, q: "", group: "", category: "", store });
    router.push("/");
  }

  return (
    <div className="space-y-4">
      <FilterBar
        value={filters}
        showCategory={false}
        onChange={(next) => {
          setFilters(next);
          saveFilters("stores", next);
        }}
      />

      <div className="flex items-baseline justify-between rounded-xl bg-accent px-4 py-3 text-white">
        <span className="text-sm opacity-90">{stores.length} 家店</span>
        <span className="tabular text-xl font-semibold">{money(total)}</span>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {!result && !error && <p className="py-10 text-center text-sm text-muted">加载中…</p>}
      {result && stores.length === 0 && <p className="py-10 text-center text-sm text-muted">这段时间没有购物记录</p>}

      {stores.length > 0 && (
        <ul className={`divide-y divide-line overflow-hidden rounded-xl border border-line bg-card ${result?.query !== query ? "opacity-60" : ""}`}>
          {stores.map((s) => (
            <li key={s.store}>
              <button type="button" onClick={() => open(s.store)} className="block w-full px-4 py-3 text-left active:bg-bg">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate font-medium">{s.store}</span>
                  <span className="tabular shrink-0 font-semibold">{money(s.total)}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, (s.total / max) * 100)}%` }} />
                </div>
                <p className="mt-1.5 flex justify-between gap-2 text-xs text-muted">
                  <span>
                    去过 {s.visits} 次 · 平均每次 {money(s.total / s.visits)}
                  </span>
                  <span className="shrink-0">最近 {dateLabel(s.last.slice(0, 10))}</span>
                </p>
                {s.names.length > 1 && (
                  <p className="mt-1 truncate text-xs text-muted">已合并：{s.names.join("、")}</p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
