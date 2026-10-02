import {
  streamGeminiTurn,
  type GeminiContent,
  type GeminiFunctionDeclaration,
  type GeminiPart,
  type GeminiStreamEvent,
} from "@/lib/ai/gemini";
import { AI_TOOL_ROUNDS_MAX } from "@/lib/ai/policy";
import { runTool, type ToolContext } from "@/lib/ai/tools";

export type MentorEvent = { type: "text"; t: string } | { type: "tool"; name: string } | { type: "usage"; tokens: number };

type TurnFn = (input: {
  system: string;
  contents: GeminiContent[];
  tools: GeminiFunctionDeclaration[];
  signal?: AbortSignal;
}) => AsyncGenerator<GeminiStreamEvent>;

/** Offline stand-in for staging/e2e (AI_MENTOR_FAKE=1): exercises the same tool path, no API cost. */
export async function* fakeGeminiTurn(input: {
  contents: GeminiContent[];
  tools: GeminiFunctionDeclaration[];
}): AsyncGenerator<GeminiStreamEvent> {
  const last = input.contents[input.contents.length - 1];
  const fnResp = last?.parts.find((p) => p.functionResponse)?.functionResponse;
  if (fnResp) {
    const body = JSON.stringify(fnResp.response).slice(0, 1500);
    yield { type: "part", part: { text: `FAKE(${fnResp.name}): ` } };
    yield { type: "part", part: { text: body } };
    yield { type: "usage", tokens: 10 };
    return;
  }
  const text = (last?.parts.map((p) => p.text ?? "").join(" ") ?? "").toLowerCase();
  const has = (n: string) => input.tools.some((t) => t.name === n);
  const call =
    text.includes("kurslarim") && has("get_my_courses")
      ? "get_my_courses"
      : text.includes("topshiriq") && has("get_my_assignments")
        ? "get_my_assignments"
        : text.includes("o‘qituvchi") && has("list_teachers")
          ? "list_teachers"
          : text.includes("kurs") && has("search_courses")
            ? "search_courses"
            : null;
  if (call) {
    yield { type: "part", part: { functionCall: { name: call, args: {} } } };
    yield { type: "usage", tokens: 5 };
    return;
  }
  yield { type: "part", part: { text: "FAKE javob: **salom**, men AI mentorman." } };
  yield { type: "usage", tokens: 5 };
}

export function isFakeGemini(): boolean {
  if (process.env.AI_MENTOR_FAKE !== "1") return false;
  return process.env.LEXIFY_ENV === "staging" || process.env.NODE_ENV !== "production";
}

export async function* runMentor(input: {
  ctx: ToolContext;
  system: string;
  contents: GeminiContent[];
  tools: GeminiFunctionDeclaration[];
  signal?: AbortSignal;
  turn?: TurnFn;
}): AsyncGenerator<MentorEvent> {
  const turn: TurnFn = input.turn ?? (isFakeGemini() ? fakeGeminiTurn : streamGeminiTurn);
  const contents = [...input.contents];
  let tokens = 0;

  for (let round = 0; round < AI_TOOL_ROUNDS_MAX; round += 1) {
    const parts: GeminiPart[] = [];
    for await (const ev of turn({ system: input.system, contents, tools: input.tools, signal: input.signal })) {
      if (ev.type === "usage") {
        tokens += ev.tokens;
        continue;
      }
      parts.push(ev.part);
      if (ev.part.text && !ev.part.thought) yield { type: "text", t: ev.part.text };
    }
    const calls = parts.filter((p) => p.functionCall).map((p) => p.functionCall!);
    if (calls.length === 0) break;

    contents.push({ role: "model", parts });
    const responses: GeminiPart[] = [];
    for (const call of calls.slice(0, 4)) {
      yield { type: "tool", name: call.name };
      const result = await runTool(input.ctx, call.name, call.args);
      responses.push({
        functionResponse: { ...(call.id ? { id: call.id } : {}), name: call.name, response: { result } },
      });
    }
    contents.push({ role: "user", parts: responses });
  }
  yield { type: "usage", tokens };
}
