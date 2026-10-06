import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AlertThrottle,
  alertHtmlToText,
  formatRequestErrorAlert,
  isIgnorableRequestError,
  redactSecrets,
  requestErrorFingerprint,
} from "./ops-alert-policy";

const base = {
  message: "boom",
  method: "GET",
  path: "/learn/x?token=abc",
  routePath: "/learn/[lessonId]",
  routeType: "render",
};

test("redacts connection strings, bot tokens, bearer and key=value secrets", () => {
  const out = redactSecrets(
    "connect postgresql://u:p@db:5432/x failed; bot123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsawz; Authorization: Bearer eyJhbGciOi.abc; password=hunter2",
  );
  assert.doesNotMatch(out, /u:p@db|AAHdqTcv|eyJhbGciOi|hunter2/);
  assert.match(out, /postgresql:\/\/\[redacted\]/);
});

test("alert hides the query string, escapes HTML and includes route + digest", () => {
  const text = formatRequestErrorAlert({ ...base, message: "<script>x</script>", digest: "123" }, "lexify.zonic.fit", 2);
  assert.match(text, /<code>\/learn\/x<\/code>/);
  assert.doesNotMatch(text, /token=abc/);
  assert.match(text, /&lt;script&gt;/);
  assert.match(text, /digest: <code>123<\/code>/);
  assert.match(text, /\+2 ta/);
});

test("email text drops tags and restores escaped characters", () => {
  const html = formatRequestErrorAlert({ ...base, message: "a < b && c" }, "lexify.zonic.fit");
  const text = alertHtmlToText(html);
  assert.doesNotMatch(text, /<\/?(b|code|pre)>/);
  assert.match(text, /a < b && c/);
  assert.match(text, /GET \/learn\/x/);
});

test("Next control-flow errors are ignored", () => {
  assert.equal(isIgnorableRequestError({ message: "NEXT_REDIRECT", digest: "NEXT_REDIRECT;replace;/login;307;" }), true);
  assert.equal(isIgnorableRequestError({ message: "x", digest: "NEXT_HTTP_ERROR_FALLBACK;404" }), true);
  assert.equal(isIgnorableRequestError({ message: "TypeError: x is undefined", digest: "2741" }), false);
});

test("fingerprint ignores ids so one incident is one key", () => {
  const a = requestErrorFingerprint({ routePath: "/r", message: "Lesson 6f1c2a3b-1111-4222-8333-444455556666 missing" });
  const b = requestErrorFingerprint({ routePath: "/r", message: "Lesson 0a0b0c0d-aaaa-4bbb-8ccc-ddddeeeeffff missing" });
  assert.equal(a, b);
});

test("throttle: one per key per window, counts suppressed repeats, global cap", () => {
  const t = new AlertThrottle(10_000, 3, 60_000);
  assert.equal(t.take("a", 0), 0);
  assert.equal(t.take("a", 1_000), null);
  assert.equal(t.take("a", 2_000), null);
  assert.equal(t.take("a", 11_000), 2);
  assert.equal(t.take("b", 11_000), 0);
  assert.equal(t.take("c", 11_000), null, "global cap of 3 per minute reached");
  assert.equal(t.take("c", 61_000), 1);
});
