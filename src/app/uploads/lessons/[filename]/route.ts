import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { lessonFileMime, lessonUploadPath } from "@/lib/lesson-file";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  const filePath = lessonUploadPath(filename);
  if (!filePath) {
    return NextResponse.json({ error: "Fayl topilmadi" }, { status: 404 });
  }

  let fileStat;
  try {
    fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error("not file");
  } catch {
    return NextResponse.json({ error: "Fayl topilmadi" }, { status: 404 });
  }

  const stream = createReadStream(filePath);
  const web = Readable.toWeb(stream) as ReadableStream;
  return new NextResponse(web, {
    headers: {
      "Content-Type": lessonFileMime(filename),
      "Content-Length": String(fileStat.size),
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
