type Stroke = { id: string; d: string; color: string; size: number; tool: "pen" | "erase" };

const g = globalThis as typeof globalThis & {
  __lexifyBoard?: Map<string, Stroke[]>;
  __lexifyCapture?: Map<string, boolean>;
};

const boards = g.__lexifyBoard ?? new Map<string, Stroke[]>();
g.__lexifyBoard = boards;
const captures = g.__lexifyCapture ?? new Map<string, boolean>();
g.__lexifyCapture = captures;

export function setLessonCapture(lessonId: string, on: boolean) {
  captures.set(lessonId, on);
}

export function lessonCapture(lessonId: string) {
  return captures.get(lessonId) === true;
}

export function whiteboardStrokes(lessonId: string): Stroke[] {
  return boards.get(lessonId) ?? [];
}

export function pushWhiteboardStroke(lessonId: string, stroke: Stroke) {
  const list = boards.get(lessonId) ?? [];
  list.push(stroke);
  if (list.length > 400) list.splice(0, list.length - 400);
  boards.set(lessonId, list);
  return list;
}

export function undoWhiteboard(lessonId: string) {
  const list = boards.get(lessonId) ?? [];
  list.pop();
  boards.set(lessonId, list);
  return list;
}

export function clearWhiteboard(lessonId: string) {
  boards.set(lessonId, []);
  return [];
}
