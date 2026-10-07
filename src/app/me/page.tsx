"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import Link from "next/link";
import { api, dateLabel, localDate, money } from "@/lib/format";

export default function MePage() {
  const router = useRouter();
  const [username, setUsername] = useState("");

  useEffect(() => {
    api<{ username: string }>("/api/me")
      .then((d) => setUsername(d.username))
      .catch(() => {});
  }, []);

  return (
    <AppShell title="我的">
      <div className="space-y-4">
        <div className="rounded-xl border border-line bg-card px-4 py-3">
          <p className="text-sm text-muted">当前账号</p>
          <p className="mt-0.5 font-medium">{username || "…"}</p>
        </div>

        <GenericNameTool />
        <DuplicateTool />
        <ExportCard />

        <button
          type="button"
          className="w-full rounded-lg border border-line bg-card py-2.5 text-danger"
          onClick={async () => {
            if (!confirm("确定退出登录？")) return;
            await api("/api/auth/logout", { method: "POST" });
            router.replace("/login");
            router.refresh();
          }}
        >
          退出登录
        </button>
      </div>
    </AppShell>
  );
}

// 给以前上传的商品补上通用名，分批调用直到全部完成
function GenericNameTool() {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ remaining: number }>("/api/generic-names")
      .then((d) => setRemaining(d.remaining))
      .catch((err: Error) => setError(err.message));
  }, []);

  async function run() {
    setRunning(true);
    setError("");
    try {
      let left = remaining ?? 1;
      while (left > 0) {
        const res = await api<{ updated: number; remaining: number }>("/api/generic-names", { method: "POST" });
        setDone((n) => n + res.updated);
        left = res.remaining;
        setRemaining(left);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <h2 className="font-medium">整理商品通用名</h2>
      <p className="mt-1 text-sm text-muted">
        给每种商品加一个通用叫法（比如不同牌子的鸡蛋都归为「鸡蛋」），方便搜索和比价。新拍的小票会自动生成，以前上传的商品需要在这里整理一次。只会补充通用名，不会改动其他内容。
      </p>
      {remaining === null && !error && <p className="mt-3 text-sm text-muted">检查中…</p>}
      {remaining === 0 && !running && (
        <p className="mt-3 text-sm text-accent">{done > 0 ? `已整理 ${done} 种商品，全部完成 ✓` : "所有商品都已有通用名 ✓"}</p>
      )}
      {remaining !== null && remaining > 0 && (
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="mt-3 w-full rounded-lg bg-accent py-2.5 font-medium text-white disabled:opacity-60"
        >
          {running ? `整理中…已完成 ${done} 种，还剩 ${remaining} 种` : `开始整理（${remaining} 种商品）`}
        </button>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

type DuplicateRow = { id: number; store: string; purchased_at: string; total: number; item_count: number };

// 列出可能重复的小票（同一天、金额相同），由用户自己点进去确认、删除
function DuplicateTool() {
  const [groups, setGroups] = useState<DuplicateRow[][] | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  async function check() {
    setChecking(true);
    setError("");
    try {
      const data = await api<{ groups: DuplicateRow[][] }>("/api/receipts/duplicates");
      setGroups(data.groups);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <h2 className="font-medium">检查重复小票</h2>
      <p className="mt-1 text-sm text-muted">
        找出同一天、金额相同的小票，它们很可能是同一张拍了两次。点进去核对后，在详情页删除多余的那张。保存新小票时也会自动提醒。
      </p>
      <button
        type="button"
        onClick={check}
        disabled={checking}
        className="mt-3 w-full rounded-lg border border-accent py-2.5 font-medium text-accent disabled:opacity-60"
      >
        {checking ? "检查中…" : groups ? "重新检查" : "开始检查"}
      </button>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {groups && groups.length === 0 && <p className="mt-3 text-sm text-accent">没有发现重复的小票 ✓</p>}
      {groups && groups.length > 0 && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-warn">发现 {groups.length} 组可能重复的小票：</p>
          {groups.map((g) => (
            <ul key={g[0].id} className="divide-y divide-line overflow-hidden rounded-lg border border-line">
              {g.map((r) => (
                <li key={r.id}>
                  <Link href={`/receipts/${r.id}`} className="flex items-center gap-3 px-3 py-2 text-sm active:bg-bg">
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{r.store || "未命名商店"}</p>
                      <p className="text-xs text-muted">
                        {dateLabel(r.purchased_at.slice(0, 10))} {r.purchased_at.slice(11)} · {r.item_count} 件
                      </p>
                    </div>
                    <span className="tabular shrink-0">{money(r.total)}</span>
                    <span className="shrink-0 text-accent">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        </div>
      )}
    </div>
  );
}

function ExportCard() {
  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <h2 className="font-medium">导出 Excel</h2>
      <p className="mt-1 text-sm text-muted">
        下载全部记录（商品明细和小票两张表），可以当作备份，也方便自己用表格分析。小票照片不包含在内。
      </p>
      <a
        href="/api/export"
        download={`小票记账-${localDate()}.xlsx`}
        className="mt-3 block w-full rounded-lg border border-accent py-2.5 text-center font-medium text-accent"
      >
        下载 Excel 文件
      </a>
    </div>
  );
}
