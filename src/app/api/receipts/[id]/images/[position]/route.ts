import { NextResponse } from "next/server";
import { jsonError, requireSession } from "@/lib/auth";
import { getImage } from "@/lib/receipts";

export async function GET(_req: Request, ctx: RouteContext<"/api/receipts/[id]/images/[position]">) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;
  const { id, position } = await ctx.params;
  const image = await getImage(session.userId, Number(id), Number(position));
  if (!image) return jsonError("图片不存在", 404);
  return new Response(image.data, {
    headers: {
      "Content-Type": image.media_type,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
