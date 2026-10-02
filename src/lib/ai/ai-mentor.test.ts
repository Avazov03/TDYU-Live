import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aiAudienceAllows,
  aiHiddenOnPath,
  buildSystemPrompt,
  isKnownAppHref,
  isSafeInternalHref,
  normalizeHistory,
  parsePageContext,
  toAiRole,
} from "./policy";
import { AI_TOOL_NAMES, runTool, toolRoles, toolsForRole } from "./tools";
import { runMentor, type MentorEvent } from "./mentor";
import { aiSubjectKey, allowBurst, dailyLimit } from "./usage";
import type { GeminiContent, GeminiStreamEvent } from "./gemini";

const LESSON = "11111111-2222-4333-8444-555555555555";

test("ai role: unknown roles fall back to guest", () => {
  assert.equal(toAiRole("student"), "student");
  assert.equal(toAiRole("teacher"), "teacher");
  assert.equal(toAiRole("admin"), "admin");
  assert.equal(toAiRole("superuser"), "guest");
  assert.equal(toAiRole(undefined), "guest");
});

test("ai audience rollout: admin → staff → students → all", () => {
  assert.equal(aiAudienceAllows("admin", "admin"), true);
  assert.equal(aiAudienceAllows("admin", "teacher"), false);
  assert.equal(aiAudienceAllows("admin", "student"), false);
  assert.equal(aiAudienceAllows("staff", "teacher"), true);
  assert.equal(aiAudienceAllows("staff", "student"), false);
  assert.equal(aiAudienceAllows("students", "student"), true);
  assert.equal(aiAudienceAllows("students", "guest"), false);
  assert.equal(aiAudienceAllows("all", "guest"), true);
});

test("page context: lesson, course, catalog, sections", () => {
  assert.deepEqual(parsePageContext(`/learn/${LESSON}`), { kind: "lesson", id: LESSON });
  assert.deepEqual(parsePageContext(`/courses/${LESSON.toUpperCase()}?x=1`), { kind: "course", id: LESSON });
  assert.deepEqual(parsePageContext("/"), { kind: "catalog" });
  assert.deepEqual(parsePageContext("/my-courses/"), { kind: "my-courses" });
  assert.deepEqual(parsePageContext("/certificates/abc"), { kind: "certificates" });
  assert.deepEqual(parsePageContext("/teacher/group"), { kind: "teacher" });
  assert.deepEqual(parsePageContext("/learn/not-a-uuid"), { kind: "other" });
  assert.deepEqual(parsePageContext(undefined), { kind: "catalog" });
});

test("assistant hidden on auth / onboarding pages", () => {
  assert.equal(aiHiddenOnPath("/login"), true);
  assert.equal(aiHiddenOnPath("/reset-password/token"), true);
  assert.equal(aiHiddenOnPath("/invite/x"), true);
  assert.equal(aiHiddenOnPath("/loginx"), false);
  assert.equal(aiHiddenOnPath("/courses"), false);
});

test("system prompt carries role, page and safety rules", () => {
  const s = buildSystemPrompt({ role: "student", firstName: "Ali", page: { kind: "lesson", id: LESSON }, nowLabel: "X" });
  assert.match(s, /talaba/);
  assert.match(s, /Ali/);
  assert.match(s, new RegExp(LESSON));
  assert.match(s, /Lex\.uz/);
  assert.match(s, /qaror qabul qilmaysan/);
});

test("history normalized for Gemini: user-first, alternating, no empties, ends with model", () => {
  assert.deepEqual(
    normalizeHistory([
      { role: "model", text: "orphan" },
      { role: "user", text: "a" },
      { role: "user", text: "b" },
      { role: "model", text: "  " },
      { role: "model", text: "c" },
      { role: "user", text: "dangling" },
    ]),
    [
      { role: "user", text: "a\n\nb" },
      { role: "model", text: "c" },
    ],
  );
  const long = Array.from({ length: 30 }, (_, i) => ({ role: (i % 2 ? "model" : "user") as "user" | "model", text: `t${i}` }));
  const n = normalizeHistory(long);
  assert.ok(n.length <= 12);
  assert.equal(n[0].role, "user");
  assert.equal(n[n.length - 1].role, "model");
});

test("rendered links: internal only", () => {
  assert.equal(isSafeInternalHref("/courses/abc"), true);
  assert.equal(isSafeInternalHref("/learn/x?tab=1#a"), true);
  assert.equal(isSafeInternalHref("//evil.com"), false);
  assert.equal(isSafeInternalHref("https://evil.com"), false);
  assert.equal(isSafeInternalHref("javascript:alert(1)"), false);
  assert.equal(isSafeInternalHref("/x\"onmouseover=1"), false);
});

test("clickable links: only real pages and entity urls", () => {
  assert.equal(isKnownAppHref(`/courses/${LESSON}`), true);
  assert.equal(isKnownAppHref(`/learn/${LESSON}?t=1`), true);
  assert.equal(isKnownAppHref("/my-courses/"), true);
  assert.equal(isKnownAppHref("/"), true);
  assert.equal(isKnownAppHref("/courses"), false, "no such page");
  assert.equal(isKnownAppHref("/courses/ID"), false);
  assert.equal(isKnownAppHref("/admin/users"), false);
  assert.equal(isKnownAppHref("https://lex.uz"), false);
});

test("tool exposure per role: guests get catalog only, teachers no student tools", () => {
  const names = (r: Parameters<typeof toolsForRole>[0]) => toolsForRole(r).map((t) => t.name).sort();
  assert.deepEqual(names("guest"), ["get_course_details", "list_teachers", "search_courses"]);
  assert.ok(names("student").includes("get_my_assignments"));
  assert.ok(!names("student").includes("get_my_teaching_courses"));
  assert.ok(names("teacher").includes("get_my_teaching_courses"));
  assert.ok(!names("teacher").includes("get_my_courses"));
  for (const n of AI_TOOL_NAMES) {
    if (n.startsWith("get_my_") && n !== "get_my_teaching_courses") assert.deepEqual(toolRoles(n), ["student"], n);
  }
});

test("runTool refuses tools outside the role without touching data", async () => {
  assert.deepEqual(await runTool({ userId: null, role: "guest" }, "get_my_courses", {}), { error: "Bu amal mavjud emas" });
  assert.deepEqual(await runTool({ userId: "u", role: "teacher" }, "get_my_assignments", {}), { error: "Bu amal mavjud emas" });
  assert.deepEqual(await runTool({ userId: "u", role: "student" }, "drop_tables", {}), { error: "Bu amal mavjud emas" });
  assert.deepEqual(await runTool({ userId: null, role: "student" }, "get_my_courses", {}), { error: "Kirish kerak" });
});

test("burst limiter: 8 per minute per subject", () => {
  const key = `test:${Math.random()}`;
  const t0 = 1_000_000;
  for (let i = 0; i < 8; i += 1) assert.equal(allowBurst(key, t0 + i), true);
  assert.equal(allowBurst(key, t0 + 10), false);
  assert.equal(allowBurst(`${key}:other`, t0 + 10), true);
  assert.equal(allowBurst(key, t0 + 61_000), true);
});

test("guest key: hashed, ignores the client-controlled first X-Forwarded-For hop", () => {
  const req = (xff: string) => new Request("http://x/", { headers: { "x-forwarded-for": xff } });
  const a = aiSubjectKey(null, req("1.1.1.1, 203.0.113.7"));
  const b = aiSubjectKey(null, req("9.9.9.9, 203.0.113.7"));
  assert.equal(a, b);
  assert.match(a, /^anon:[0-9a-f]{24}$/);
  assert.ok(!a.includes("203.0.113.7"));
  assert.notEqual(a, aiSubjectKey(null, req("1.1.1.1, 203.0.113.8")));
  assert.equal(aiSubjectKey("u1", req("1.1.1.1")), "user:u1");
});

test("daily limits: role defaults, env override only for positive integers", () => {
  const prev = process.env.AI_DAILY_LIMIT_GUEST;
  try {
    delete process.env.AI_DAILY_LIMIT_GUEST;
    assert.equal(dailyLimit("guest"), 10);
    assert.equal(dailyLimit("student"), 50);
    process.env.AI_DAILY_LIMIT_GUEST = "500";
    assert.equal(dailyLimit("guest"), 500);
    process.env.AI_DAILY_LIMIT_GUEST = "-1";
    assert.equal(dailyLimit("guest"), 10);
    process.env.AI_DAILY_LIMIT_GUEST = "abc";
    assert.equal(dailyLimit("guest"), 10);
  } finally {
    if (prev === undefined) delete process.env.AI_DAILY_LIMIT_GUEST;
    else process.env.AI_DAILY_LIMIT_GUEST = prev;
  }
});

test("mentor loop: tool call round-trips model parts (thoughtSignature) and blocks foreign tools", async () => {
  const seen: GeminiContent[][] = [];
  async function* turn(input: { contents: GeminiContent[] }): AsyncGenerator<GeminiStreamEvent> {
    seen.push(structuredClone(input.contents));
    if (seen.length === 1) {
      yield { type: "part", part: { text: "o‘ylayapman", thought: true } };
      yield { type: "part", part: { functionCall: { name: "get_my_courses", args: {} }, thoughtSignature: "sig" } };
      yield { type: "usage", tokens: 7 };
      return;
    }
    yield { type: "part", part: { text: "Javob" } };
    yield { type: "usage", tokens: 3 };
  }
  const events: MentorEvent[] = [];
  for await (const ev of runMentor({
    ctx: { userId: null, role: "guest" },
    system: "s",
    contents: [{ role: "user", parts: [{ text: "kurslarim" }] }],
    tools: [],
    turn,
  })) {
    events.push(ev);
  }
  assert.deepEqual(events, [
    { type: "tool", name: "get_my_courses" },
    { type: "text", t: "Javob" },
    { type: "usage", tokens: 10 },
  ]);
  const second = seen[1];
  assert.equal(second.length, 3);
  assert.equal(second[1].role, "model");
  assert.equal(second[1].parts[1].thoughtSignature, "sig");
  assert.deepEqual(second[2].parts[0].functionResponse?.response, { result: { error: "Bu amal mavjud emas" } });
});

test("mentor loop: stops after the tool-round cap", async () => {
  let calls = 0;
  async function* turn(): AsyncGenerator<GeminiStreamEvent> {
    calls += 1;
    yield { type: "part", part: { functionCall: { name: "nope", args: {} } } };
  }
  const out: MentorEvent[] = [];
  for await (const ev of runMentor({ ctx: { userId: null, role: "guest" }, system: "s", contents: [], tools: [], turn })) out.push(ev);
  assert.equal(calls, 4);
  assert.equal(out.filter((e) => e.type === "text").length, 0);
});
