"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api } from "@/lib/format";

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
