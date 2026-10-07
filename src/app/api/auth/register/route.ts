import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { jsonError, startSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

const USERNAME_RE = /^[\p{L}\p{N}_.-]{2,32}$/u;

export async function POST(request: Request) {
  const inviteCode = process.env.INVITE_CODE;
  if (!inviteCode) return jsonError("注册未开放：服务器没有设置邀请码 INVITE_CODE", 403);

  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (body?.inviteCode !== inviteCode) return jsonError("邀请码不正确", 403);
  if (!USERNAME_RE.test(username)) return jsonError("用户名需为 2～32 位字母、数字、汉字或 _ . -", 400);
  if (password.length < 8 || password.length > 72) return jsonError("密码长度需为 8～72 位", 400);

  const db = await getDb();
  const exists = await db.execute({ sql: "SELECT 1 FROM users WHERE username = ?", args: [username] });
  if (exists.rows.length > 0) return jsonError("用户名已被使用", 409);

  const hash = await bcrypt.hash(password, 10);
  const rs = await db.execute({
    sql: "INSERT INTO users (username, password_hash) VALUES (?, ?)",
    args: [username, hash],
  });
  await startSession({ userId: Number(rs.lastInsertRowid), username });
  return NextResponse.json({ ok: true });
}
