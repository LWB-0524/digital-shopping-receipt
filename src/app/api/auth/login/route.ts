import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { jsonError, startSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!username || !password) return jsonError("请输入用户名和密码", 400);

  const db = await getDb();
  const rs = await db.execute({ sql: "SELECT id, password_hash FROM users WHERE username = ?", args: [username] });
  const row = rs.rows[0];
  const ok = row ? await bcrypt.compare(password, String(row.password_hash)) : false;
  if (!row || !ok) return jsonError("用户名或密码错误", 401);

  await startSession({ userId: Number(row.id), username });
  return NextResponse.json({ ok: true });
}
