"use client";

import { CATEGORY_GROUPS } from "@/lib/categories";
import { firstDayOfMonth, localDate } from "@/lib/format";

export type FilterState = {
  from: string;
  to: string;
  q: string;
  group: string;
  category: string;
};

export function defaultFilters(): FilterState {
  return { from: firstDayOfMonth(), to: localDate(), q: "", group: "", category: "" };
}

export function filterQuery(f: FilterState): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) params.set(k, v);
  return params.toString();
}

function presets(): { label: string; from: string; to: string }[] {
  const now = new Date();
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  return [
    { label: "本月", from: firstDayOfMonth(now), to: localDate(now) },
    { label: "上月", from: firstDayOfMonth(lastMonthEnd), to: localDate(lastMonthEnd) },
    { label: "近三个月", from: localDate(threeMonthsAgo), to: localDate(now) },
    { label: "今年", from: `${now.getFullYear()}-01-01`, to: localDate(now) },
    { label: "全部", from: "", to: "" },
  ];
}

export function FilterBar({
  value,
  onChange,
  showCategory = true,
}: {
  value: FilterState;
  onChange: (next: FilterState) => void;
  showCategory?: boolean;
}) {
  const set = (patch: Partial<FilterState>) => onChange({ ...value, ...patch });
  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1 text-sm ${
      active ? "border-accent bg-accent-soft text-accent" : "border-line bg-card text-ink"
    }`;
  const field = "min-w-0 rounded-lg border border-line bg-card px-2 py-1.5 outline-none focus:border-accent";

  return (
    <div className="space-y-2.5">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5">
        {presets().map((p) => (
          <button
            key={p.label}
            type="button"
            className={chip(value.from === p.from && value.to === p.to)}
            onClick={() => set({ from: p.from, to: p.to })}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 text-sm">
        <input type="date" className={`${field} flex-1`} value={value.from} onChange={(e) => set({ from: e.target.value })} aria-label="开始日期" />
        <span className="text-muted">至</span>
        <input type="date" className={`${field} flex-1`} value={value.to} onChange={(e) => set({ to: e.target.value })} aria-label="结束日期" />
      </div>
      <div className="flex gap-2">
        <input
          type="search"
          className={`${field} flex-1`}
          placeholder="搜索商品或店名"
          value={value.q}
          onChange={(e) => set({ q: e.target.value })}
        />
        {showCategory && (
          <select
            className={`${field} w-32`}
            value={value.category ? `c:${value.category}` : value.group ? `g:${value.group}` : ""}
            onChange={(e) => {
              const v = e.target.value;
              if (v.startsWith("c:")) set({ category: v.slice(2), group: "" });
              else if (v.startsWith("g:")) set({ group: v.slice(2), category: "" });
              else set({ group: "", category: "" });
            }}
            aria-label="品类"
          >
            <option value="">全部品类</option>
            {CATEGORY_GROUPS.map((g) => (
              <optgroup key={g.group} label={g.group}>
                <option value={`g:${g.group}`}>全部{g.group}</option>
                {g.categories.map((c) => (
                  <option key={c} value={`c:${c}`}>
                    {c}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

const STORAGE_PREFIX = "receipt-filters:";

// 筛选条件存在 sessionStorage 里，从详情页返回时不会丢
export function loadFilters(key: string): FilterState {
  try {
    const saved = sessionStorage.getItem(STORAGE_PREFIX + key);
    if (saved) return { ...defaultFilters(), ...JSON.parse(saved) };
  } catch {
    // 隐私模式等情况下无法读取，忽略即可
  }
  return defaultFilters();
}

export function saveFilters(key: string, f: FilterState) {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(f));
  } catch {
    // 同上
  }
}
