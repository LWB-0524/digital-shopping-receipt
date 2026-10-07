import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession, type Session } from "./session";

export async function currentSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

export async function startSession(session: Session): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// 路由处理器里统一用这个：未登录直接返回 401。
export async function requireSession(): Promise<Session | NextResponse> {
  const session = await currentSession();
  return session ?? jsonError("请先登录", 401);
}
