import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Block direct static serving of protected media under /uploads/recordings/*.
 * Clients must use /api/media/recording/[lessonId] (Enrollment-gated).
 *
 * Lesson materials use /uploads/lessons/[filename] App Route (also gated).
 * Assignment uploads remain under public/ for teacher download — documented
 * as a remaining legacy dependency (not student lesson content).
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/uploads/recordings/")) {
    return NextResponse.json(
      { error: "Ruxsat yo'q — /api/media/recording orqali oching" },
      { status: 403 },
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/uploads/recordings/:path*"],
};
