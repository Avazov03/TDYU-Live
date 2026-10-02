import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware runs before public/ static serving, so protected uploads never reach it:
 * - /uploads/recordings/* → 403 (use /api/media/recording/[lessonId])
 * - /uploads/lessons/:file, /uploads/assignments/:file → rewritten to gated /api/files routes
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/uploads/recordings/")) {
    return NextResponse.json(
      { error: "Ruxsat yo'q — /api/media/recording orqali oching" },
      { status: 403 },
    );
  }

  const match = /^\/uploads\/(lessons|assignments)\/([^/]+)$/.exec(pathname);
  if (match) {
    const url = req.nextUrl.clone();
    url.pathname = `/api/files/${match[1]}/${match[2]}`;
    return NextResponse.rewrite(url);
  }
  if (pathname.startsWith("/uploads/lessons/") || pathname.startsWith("/uploads/assignments/")) {
    return NextResponse.json({ error: "Fayl topilmadi" }, { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/uploads/recordings/:path*", "/uploads/lessons/:path*", "/uploads/assignments/:path*"],
};
