import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { NextResponse } from "next/server";

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  txt: "text/plain",
};

function uploadPath(dir: "lessons" | "assignments", filename: string) {
  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return null;
  }
  const root = path.resolve(process.cwd(), "public", "uploads", dir);
  const resolved = path.resolve(root, filename);
  if (!resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

export function lessonUploadPath(filename: string) {
  return uploadPath("lessons", filename);
}

export function assignmentUploadPath(filename: string) {
  return uploadPath("assignments", filename);
}

export function lessonFileMime(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return MIME[ext] || "application/octet-stream";
}

/** Streams an authorized upload; callers must run the access check first. */
export async function streamUploadFile(filePath: string, filename: string) {
  let fileStat;
  try {
    fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error("not file");
  } catch {
    return NextResponse.json({ error: "Fayl topilmadi" }, { status: 404 });
  }

  const web = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new NextResponse(web, {
    headers: {
      "Content-Type": lessonFileMime(filename),
      "Content-Length": String(fileStat.size),
      "Cache-Control": "private, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
