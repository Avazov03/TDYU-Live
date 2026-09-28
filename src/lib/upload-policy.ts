/**
 * Files under public/uploads are served with a Content-Type derived from the extension
 * (nginx for /uploads/lessons, Next static for the rest), so anything the browser would
 * render as a document or script (html, svg, xml, js…) must never be written there.
 */
const SAFE_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "odt", "odp", "ods", "rtf", "txt", "csv",
  "png", "jpg", "jpeg", "gif", "webp",
  "mp4", "webm", "mov", "mp3", "m4a", "wav", "ogg",
  "zip", "rar", "7z",
]);

/** Lower-cased extension when it is on the allowlist, otherwise null. */
export function safeUploadExtension(fileName: string): string | null {
  const m = /\.([a-z0-9]{1,5})$/i.exec(fileName.trim());
  const ext = m?.[1]?.toLowerCase();
  return ext && SAFE_EXTENSIONS.has(ext) ? ext : null;
}

export const UNSAFE_UPLOAD_MESSAGE =
  "Bu fayl turiga ruxsat yo‘q. PDF, Office hujjati, rasm, audio/video yoki arxiv yuklang.";
