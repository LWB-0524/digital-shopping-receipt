"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FilterBar, filterQuery, loadFilters, saveFilters, type FilterState } from "@/components/FilterBar";
import { api, dateLabel, money } from "@/lib/format";
import { suggestStoreMerges } from "@/lib/stores";
import type { StoreSummary } from "@/lib/types";

// 按店铺查看：每家店去过几次、花了多少；点击后到首页查看这家店的小票
export function StoresView() {
  const router = useRouter();
  const [filters, setFilters] = useState<FilterState>(() => loadFilters("stores"));
  // 店铺列表只按日期范围查询，搜索框在本地过滤店名
  const query = filterQuery({ ...filters, q: "", group: "", category: "", store: "" });
  const [result, setResult] = useState<{ query: string; stores: StoreSummary[] } | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [merging, setMerging] = useState<string[] | null>(null); // 正在确认合并的店铺
  const [ignored, setIgnored] = useState<string[]>(() => loadIgnored());

  useEffect(() => {
    let cancelled = false;
    api<{ stores: StoreSummary[] }>(`/api/stores?${query}`)
      .then((data) => !cancelled && (setResult({ query, stores: data.stores }), setError("")))
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [query, reload]);

  const stores = useMemo(() => {
    const all = result?.stores ?? [];
    const q = filters.q.trim().toLowerCase();
    return q ? all.filter((s) => s.names.some((n) => n.toLowerCase().includes(q))) : all;
  }, [result, filters.q]);
  const total = stores.reduce((s, x) => s + x.total, 0);
  const max = Math.max(...stores.map((s) => s.total), 1);

  const suggestions = useMemo(
    () => suggestStoreMerges(result?.stores ?? []).filter((g) => !ignored.includes(g.join("|"))),
    [result, ignored],
  );

  function toggle(store: string) {
    setSelected((cur) => (cur.includes(store) ? cur.filter((s) => s !== store) : [...cur, store]));
  }

  async function unmerge(store: string) {
    if (!confirm(`取消「${store}」的手动合并？各种写法会恢复成分开显示。`)) return;
    try {
      await api("/api/stores/merge", { method: "DELETE", body: JSON.stringify({ store }) });
      setReload((n) => n + 1);
    } catch (err) {
      setError((err as Error).message);
    }
  }

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

      {!selecting && suggestions.length > 0 && (
        <div className="space-y-2 rounded-xl border border-warn/30 bg-warn-soft p-3 text-sm">
          <p className="font-medium text-warn">这些可能是同一家店：</p>
          {suggestions.map((g) => (
            <div key={g.join("|")} className="rounded-lg bg-card px-3 py-2">
              <p className="text-ink">{g.join("、")}</p>
              <div className="mt-1.5 flex justify-end gap-4">
                <button
                  type="button"
                  className="text-muted"
                  onClick={() => {
                    const next = [...ignored, g.join("|")];
                    setIgnored(next);
                    saveIgnored(next);
                  }}
                >
                  不是同一家
                </button>
                <button type="button" className="font-medium text-accent" onClick={() => setMerging(g)}>
                  合并…
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {stores.length > 1 && (
        <div className="flex justify-end">
          <button
            type="button"
            className="text-sm text-accent"
            onClick={() => {
              setSelecting(!selecting);
              setSelected([]);
            }}
          >
            {selecting ? "取消选择" : "合并店铺"}
          </button>
        </div>
      )}
      {selecting && <p className="text-sm text-muted">勾选属于同一家的店铺，然后点下方的「合并」。</p>}

      {error && <p className="text-sm text-danger">{error}</p>}
      {!result && !error && <p className="py-10 text-center text-sm text-muted">加载中…</p>}
      {result && stores.length === 0 && <p className="py-10 text-center text-sm text-muted">这段时间没有购物记录</p>}

      {stores.length > 0 && (
        <ul className={`divide-y divide-line overflow-hidden rounded-xl border border-line bg-card ${result?.query !== query ? "opacity-60" : ""}`}>
          {stores.map((s) => (
            <li key={s.store} className={selecting && selected.includes(s.store) ? "bg-accent-soft" : ""}>
              <button
                type="button"
                onClick={() => (selecting ? toggle(s.store) : open(s.store))}
                className="block w-full px-4 py-3 text-left active:bg-bg"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-baseline gap-2">
                    {selecting && (
                      <span
                        className={`flex size-4 shrink-0 translate-y-0.5 items-center justify-center rounded border text-[10px] ${
                          selected.includes(s.store) ? "border-accent bg-accent text-white" : "border-muted"
                        }`}
                        aria-hidden
                      >
                        {selected.includes(s.store) ? "✓" : ""}
                      </span>
                    )}
                    <span className="truncate font-medium">{s.store}</span>
                  </span>
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
              {s.custom && !selecting && (
                <div className="-mt-2 px-4 pb-2 text-right">
                  <button type="button" className="text-xs text-muted underline" onClick={() => unmerge(s.store)}>
                    取消合并
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {selecting && (
        <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 px-4">
          <div className="mx-auto flex max-w-xl items-center justify-between gap-3 rounded-xl bg-ink px-4 py-3 text-white shadow-lg">
            <span className="text-sm">已选 {selected.length} 家</span>
            <button
              type="button"
              disabled={selected.length < 2}
              onClick={() => setMerging(selected)}
              className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium disabled:opacity-40"
            >
              合并
            </button>
          </div>
        </div>
      )}

      {merging && (
        <MergeDialog
          stores={(result?.stores ?? []).filter((s) => merging.includes(s.store))}
          onCancel={() => setMerging(null)}
          onDone={() => {
            setMerging(null);
            setSelecting(false);
            setSelected([]);
            setReload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

// 选择合并后保留的店名（默认去得最多的那家），也可以自己填
function MergeDialog({
  stores,
  onCancel,
  onDone,
}: {
  stores: StoreSummary[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const sorted = [...stores].sort((a, b) => b.visits - a.visits);
  const [choice, setChoice] = useState(sorted[0]?.store ?? "");
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const canonical = choice === "__custom" ? custom.trim() : choice;

  async function submit() {
    setSaving(true);
    setError("");
    try {
      await api("/api/stores/merge", {
        method: "POST",
        body: JSON.stringify({ stores: stores.map((s) => s.store), canonical }),
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center" onClick={onCancel}>
      <div
        className="w-full max-w-xl rounded-t-2xl bg-card p-4 pb-[max(env(safe-area-inset-bottom),1rem)] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-medium">合并 {stores.length} 家店</h2>
        <p className="mt-1 text-sm text-muted">合并后按一家店统计。只影响显示，小票上的原始店名不会改，随时可以取消合并。</p>
        <p className="mt-4 text-sm text-muted">合并后显示为：</p>
        <div className="mt-2 space-y-1">
          {sorted.map((s) => (
            <label key={s.store} className="flex items-center gap-3 rounded-lg px-2 py-2 active:bg-bg">
              <input type="radio" name="canonical" checked={choice === s.store} onChange={() => setChoice(s.store)} />
              <span className="min-w-0 flex-1 truncate">{s.store}</span>
              <span className="shrink-0 text-xs text-muted">{s.visits} 次</span>
            </label>
          ))}
          <label className="flex items-center gap-3 rounded-lg px-2 py-2">
            <input type="radio" name="canonical" checked={choice === "__custom"} onChange={() => setChoice("__custom")} />
            <input
              className="min-w-0 flex-1 rounded-lg border border-line px-2.5 py-1.5 outline-none focus:border-accent"
              placeholder="自己填一个名字"
              value={custom}
              onFocus={() => setChoice("__custom")}
              onChange={(e) => setCustom(e.target.value)}
            />
          </label>
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <div className="mt-4 flex gap-3">
          <button type="button" className="flex-1 rounded-lg border border-line py-2.5" onClick={onCancel} disabled={saving}>
            取消
          </button>
          <button
            type="button"
            className="flex-[2] rounded-lg bg-accent py-2.5 font-medium text-white disabled:opacity-60"
            onClick={submit}
            disabled={saving || !canonical}
          >
            {saving ? "合并中…" : "确认合并"}
          </button>
        </div>
      </div>
    </div>
  );
}

const IGNORED_KEY = "receipt-store-merge-ignored";

// "不是同一家"的提示记在本机，不再重复提示
function loadIgnored(): string[] {
  try {
    const raw = localStorage.getItem(IGNORED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveIgnored(list: string[]) {
  try {
    localStorage.setItem(IGNORED_KEY, JSON.stringify(list));
  } catch {
    // 无法保存时下次还会提示，不影响使用
  }
}
