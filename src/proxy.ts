import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// 未登录访问页面时跳到登录页；接口的鉴权在各个路由里单独做（返回 401）。
export async function proxy(request: NextRequest) {
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  const isLoginPage = request.nextUrl.pathname === "/login";
  if (!session && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (session && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest).*)"],
};
