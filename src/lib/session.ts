import { SignJWT, jwtVerify } from "jose";

// 这个文件不依赖 Node 专有模块，proxy.ts 和路由处理器都可以引用。
export const SESSION_COOKIE = "receipt_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 天

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("缺少环境变量 SESSION_SECRET");
    }
    return new TextEncoder().encode("dev-only-insecure-session-secret-change-me");
  }
  return new TextEncoder().encode(secret);
}

export type Session = { userId: number; username: string };

export async function signSession(session: Session): Promise<string> {
  return new SignJWT({ username: session.username })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(session.userId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || typeof payload.username !== "string") return null;
    return { userId, username: payload.username };
  } catch {
    return null;
  }
}
