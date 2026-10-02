const BASE = "https://generativelanguage.googleapis.com/v1beta";
const TIMEOUT_MS = 45_000;
const RETRIES = 2;

export type GeminiPart = {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string;
  functionCall?: { id?: string; name: string; args?: Record<string, unknown> };
  functionResponse?: { id?: string; name: string; response: Record<string, unknown> };
};

export type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

export type GeminiFunctionDeclaration = {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
};

export type GeminiStreamEvent = { type: "part"; part: GeminiPart } | { type: "usage"; tokens: number };

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

/** Streams one model turn (SSE). Parts are yielded as received; usage arrives with the last chunk. */
export async function* streamGeminiTurn(input: {
  system: string;
  contents: GeminiContent[];
  tools: GeminiFunctionDeclaration[];
  signal?: AbortSignal;
}): AsyncGenerator<GeminiStreamEvent> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new GeminiError("GEMINI_API_KEY missing", 503);
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-flash-latest";

  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const signal = input.signal ? AbortSignal.any([input.signal, timeout]) : timeout;

  const fallback = process.env.GEMINI_FALLBACK_MODEL?.trim() || "gemini-flash-lite-latest";
  const request = (attempt: number) =>
    fetch(`${BASE}/models/${encodeURIComponent(attempt < RETRIES ? model : fallback)}:streamGenerateContent?alt=sse`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.system }] },
        contents: input.contents,
        ...(input.tools.length ? { tools: [{ functionDeclarations: input.tools }] } : {}),
        generationConfig: { temperature: 0.4, maxOutputTokens: 1200 },
      }),
      signal,
    });
  let res = await request(0);
  for (let attempt = 1; attempt <= RETRIES && (res.status === 503 || res.status === 429 || res.status === 500); attempt += 1) {
    await res.body?.cancel();
    await new Promise((r) => setTimeout(r, 700 * attempt));
    if (signal.aborted) break;
    res = await request(attempt);
  }
  if (!res.ok || !res.body) {
    throw new GeminiError(`Gemini HTTP ${res.status}`, res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let tokens = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      let chunk: {
        candidates?: { content?: { parts?: GeminiPart[] } }[];
        usageMetadata?: { totalTokenCount?: number };
      };
      try {
        chunk = JSON.parse(payload);
      } catch {
        continue;
      }
      for (const part of chunk.candidates?.[0]?.content?.parts ?? []) yield { type: "part", part };
      if (chunk.usageMetadata?.totalTokenCount) tokens = chunk.usageMetadata.totalTokenCount;
    }
  }
  yield { type: "usage", tokens };
}
