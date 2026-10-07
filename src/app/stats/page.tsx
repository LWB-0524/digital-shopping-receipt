"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { loadFilters, saveFilters } from "@/components/FilterBar";
import { ClientOnly } from "@/components/ClientOnly";
import { CATEGORY_GROUPS, groupOf } from "@/lib/categories";
import { api, money } from "@/lib/format";
import type { MonthlyStats } from "@/lib/types";

// 每个大类固定一个颜色（颜色跟着品类走，不随排名变化），已通过色盲区分度校验。
// 黄、青两色对白底对比度不足 3:1，所以图例里始终显示名称和金额。
const GROUP_COLORS: Record<string, string> = {
  食品: "#2a78d6",
  零食饮料: "#eb6834",
  日用百货: "#1baf7a",
  其他: "#eda100",
};
const BAR = "#2a78d6";
const BAR_MUTED = "#b7d3f6";

const pad = (n: number) => String(n).padStart(2, "0");
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${y}年${m}月`;
}

export default function StatsPage() {
  return (
    <AppShell title="消费统计">
      <ClientOnly>
        <StatsView />
      </ClientOnly>
    </AppShell>
  );
}

function StatsView() {
  const [end] = useState(currentMonth);
  const [month, setMonth] = useState(end);
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api<MonthlyStats>(`/api/stats?month=${month}&end=${end}`)
      .then((data) => !cancelled && (setStats(data), setError("")))
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [month, end]);

  const loading = stats?.month !== month;
  const prev = stats?.months.find((m) => m.month === shiftMonth(month, -1));
  const change = stats && prev && prev.total > 0 ? (stats.total - prev.total) / prev.total : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button type="button" className="px-3 py-1 text-xl text-accent" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="上个月">
          ‹
        </button>
        <span className="font-medium">{monthLabel(month)}</span>
        <button
          type="button"
          className="px-3 py-1 text-xl text-accent disabled:text-line"
          onClick={() => setMonth(shiftMonth(month, 1))}
          disabled={month >= end}
          aria-label="下个月"
        >
          ›
        </button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {!stats && !error && <p className="py-10 text-center text-sm text-muted">加载中…</p>}

      {stats && (
        <div className={`space-y-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <div className="rounded-xl bg-accent px-4 py-4 text-white">
            <p className="text-sm opacity-90">{Number(month.slice(5))}月总支出</p>
            <p className="tabular mt-1 text-3xl font-semibold">{money(stats.total)}</p>
            <p className="mt-1 text-sm opacity-90">
              {stats.receipts} 张小票
              {change !== null && ` · 比上月${change >= 0 ? "多" : "少"} ${Math.abs(Math.round(change * 100))}%`}
            </p>
          </div>

          <CategoryCard stats={stats} />
          <StoreCard stats={stats} />
          <TrendCard stats={stats} selected={month} onSelect={setMonth} />
        </div>
      )}
    </div>
  );
}

function CategoryCard({ stats }: { stats: MonthlyStats }) {
  const groups = useMemo(() => {
    const totals = new Map<string, number>();
    for (const c of stats.categories) {
      const g = groupOf(c.category);
      totals.set(g, (totals.get(g) ?? 0) + c.amount);
    }
    // 按固定顺序排列，保证颜色和位置稳定
    return CATEGORY_GROUPS.map((g) => ({ group: g.group as string, amount: totals.get(g.group) ?? 0 })).filter(
      (g) => g.amount > 0,
    );
  }, [stats]);
  const sum = groups.reduce((s, g) => s + g.amount, 0);
  const maxCat = Math.max(...stats.categories.map((c) => c.amount), 1);

  return (
    <section className="rounded-xl border border-line bg-card p-4">
      <h2 className="font-medium">品类占比</h2>
      {sum <= 0 ? (
        <p className="py-8 text-center text-sm text-muted">这个月还没有记录</p>
      ) : (
        <>
          <div className="mt-3 flex justify-center">
            <Donut groups={groups} sum={sum} />
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {groups.map((g) => (
              <li key={g.group} className="flex items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: GROUP_COLORS[g.group] }} />
                <span className="flex-1 whitespace-nowrap">{g.group}</span>
                <span className="tabular text-muted">{percent(g.amount, sum)}</span>
                <span className="tabular w-24 text-right">{money(g.amount)}</span>
              </li>
            ))}
          </ul>

          <h3 className="mt-5 mb-2 text-sm text-muted">小类明细</h3>
          <ul className="space-y-1.5">
            {stats.categories.map((c) => (
              <li key={c.category} className="grid grid-cols-[4.5rem_1fr_6rem] items-center gap-2 text-sm">
                <span className="truncate text-muted">{c.category}</span>
                <span className="h-2 overflow-hidden rounded-full bg-bg">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${Math.max(2, (c.amount / maxCat) * 100)}%`,
                      background: GROUP_COLORS[groupOf(c.category)],
                    }}
                  />
                </span>
                <span className="tabular text-right">{money(c.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">品类金额按商品金额统计，未扣除整单优惠，合计可能略高于实付。</p>
        </>
      )}
    </section>
  );
}

function Donut({ groups, sum }: { groups: { group: string; amount: number }[]; sum: number }) {
  const size = 150;
  const r = 70;
  const inner = 46;
  const c = size / 2;
  const point = (angle: number, radius: number) =>
    `${c + radius * Math.sin(angle)} ${c - radius * Math.cos(angle)}`;

  const slices = groups.map((g, i) => {
    const before = groups.slice(0, i).reduce((s, x) => s + x.amount, 0);
    const start = (before / sum) * Math.PI * 2;
    return { ...g, start, end: start + (g.amount / sum) * Math.PI * 2 };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" role="img" aria-label="各大类支出占比">
      {slices.length === 1 ? (
        <circle cx={c} cy={c} r={(r + inner) / 2} fill="none" stroke={GROUP_COLORS[slices[0].group]} strokeWidth={r - inner} />
      ) : (
        slices.map((s) => {
          const large = s.end - s.start > Math.PI ? 1 : 0;
          const d = [
            `M ${point(s.start, r)}`,
            `A ${r} ${r} 0 ${large} 1 ${point(s.end, r)}`,
            `L ${point(s.end, inner)}`,
            `A ${inner} ${inner} 0 ${large} 0 ${point(s.start, inner)}`,
            "Z",
          ].join(" ");
          // 白色描边在相邻扇区之间留出 2px 间隙
          return (
            <path key={s.group} d={d} fill={GROUP_COLORS[s.group]} stroke="#ffffff" strokeWidth={2} strokeLinejoin="round">
              <title>
                {s.group} {money(s.amount)}（{Math.round((s.amount / sum) * 100)}%）
              </title>
            </path>
          );
        })
      )}
      <text x={c} y={c - 4} textAnchor="middle" fontSize={11} fill="#6a7065">
        品类合计
      </text>
      <text x={c} y={c + 14} textAnchor="middle" fontSize={15} fontWeight={600} fill="#1d211b">
        {money(sum)}
      </text>
    </svg>
  );
}

function percent(part: number, total: number): string {
  const p = (part / total) * 100;
  return p > 0 && p < 1 ? "<1%" : `${Math.round(p)}%`;
}

function lastDayOfMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${pad(new Date(y, m, 0).getDate())}`;
}

// 当月在每家店花了多少；点一家店到首页看这家店当月的小票
function StoreCard({ stats }: { stats: MonthlyStats }) {
  const router = useRouter();
  if (stats.stores.length === 0) return null;
  const max = Math.max(...stats.stores.map((s) => s.total), 1);
  const open = (store: string) => {
    saveFilters("receipts", {
      ...loadFilters("receipts"),
      from: `${stats.month}-01`,
      to: lastDayOfMonth(stats.month),
      q: "",
      group: "",
      category: "",
      store,
    });
    router.push("/");
  };
  return (
    <section className="rounded-xl border border-line bg-card p-4">
      <h2 className="font-medium">按店铺</h2>
      <ul className="mt-3 space-y-2.5">
        {stats.stores.map((s) => (
          <li key={s.store}>
            <button type="button" className="block w-full text-left text-sm" onClick={() => open(s.store)}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">{s.store}</span>
                <span className="tabular shrink-0">
                  <span className="mr-2 text-xs text-muted">{s.visits} 次</span>
                  {money(s.total)}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-bg">
                <div className="h-full rounded-full" style={{ width: `${Math.max(2, (s.total / max) * 100)}%`, background: BAR }} />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TrendCard({
  stats,
  selected,
  onSelect,
}: {
  stats: MonthlyStats;
  selected: string;
  onSelect: (month: string) => void;
}) {
  const width = 340;
  const height = 150;
  const top = 22;
  const bottom = 20;
  const plot = height - top - bottom;
  const max = Math.max(...stats.months.map((m) => m.total), 1);
  const slot = width / stats.months.length;
  const barW = Math.min(18, slot - 6);
  const avg = stats.months.filter((m) => m.total > 0);
  const average = avg.length > 0 ? avg.reduce((s, m) => s + m.total, 0) / avg.length : 0;

  return (
    <section className="rounded-xl border border-line bg-card p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-medium">近 12 个月趋势</h2>
        {average > 0 && <span className="text-xs text-muted">有记录月份平均 {money(average)}</span>}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 w-full" role="img" aria-label="近 12 个月每月支出">
        <line x1={0} x2={width} y1={top + plot} y2={top + plot} stroke="#e3e6df" strokeWidth={1} />
        {stats.months.map((m, i) => {
          const h = m.total > 0 ? Math.max(3, (m.total / max) * plot) : 0;
          const x = i * slot + (slot - barW) / 2;
          const y = top + plot - h;
          const isSel = m.month === selected;
          const rad = Math.min(4, h / 2, barW / 2);
          const label = `${Number(m.month.slice(5))}月`;
          return (
            <g key={m.month} onClick={() => onSelect(m.month)} className="cursor-pointer">
              {/* 透明的大点击区域，比柱子本身更容易点中 */}
              <rect x={i * slot} y={0} width={slot} height={height} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M ${x} ${top + plot} V ${y + rad} Q ${x} ${y} ${x + rad} ${y} H ${x + barW - rad} Q ${x + barW} ${y} ${x + barW} ${y + rad} V ${top + plot} Z`}
                  fill={isSel ? BAR : BAR_MUTED}
                />
              )}
              {isSel && m.total > 0 && (
                <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize={11} fill="#1d211b" className="tabular">
                  {Math.round(m.total)}
                </text>
              )}
              <text
                x={i * slot + slot / 2}
                y={height - 5}
                textAnchor="middle"
                fontSize={10}
                fill={isSel ? "#1d211b" : "#6a7065"}
                fontWeight={isSel ? 600 : 400}
              >
                {label}
              </text>
              <title>
                {monthLabel(m.month)}：{money(m.total)}，{m.receipts} 张小票
              </title>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-xs text-muted">点柱子可以切换到那个月</p>
    </section>
  );
}
