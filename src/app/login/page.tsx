"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/format";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify({ username, password, inviteCode }),
      });
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const input = "w-full rounded-lg border border-line bg-card px-3 py-2.5 outline-none focus:border-accent";

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">小票记账</h1>
      <p className="mt-1 text-sm text-muted">拍一下购物小票，自动整理成消费记录</p>

      <form onSubmit={submit} className="mt-8 space-y-3">
        <input
          className={input}
          placeholder="用户名"
          autoComplete="username"
          autoCapitalize="none"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          className={input}
          type="password"
          placeholder={mode === "register" ? "密码（至少 8 位）" : "密码"}
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {mode === "register" && (
          <input
            className={input}
            placeholder="邀请码"
            autoCapitalize="none"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            required
          />
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-accent py-2.5 font-medium text-white disabled:opacity-60"
        >
          {busy ? "请稍候…" : mode === "login" ? "登录" : "注册并登录"}
        </button>
      </form>

      <button
        type="button"
        className="mt-4 text-sm text-accent"
        onClick={() => {
          setMode(mode === "login" ? "register" : "login");
          setError("");
        }}
      >
        {mode === "login" ? "没有账号？用邀请码注册" : "已有账号，去登录"}
      </button>
    </main>
  );
}
