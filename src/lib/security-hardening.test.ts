import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { telegramLinkPayload, verifyTelegramLinkPayload } from "./telegram/link-token";
import { safeUploadExtension } from "./upload-policy";
import { getClientIp, isRateLimited, rateLimit } from "./rate-limit";
import { cronAuthError } from "./cron-auth";
import { acceptsRecordingUpload, lessonMayEnterReview } from "./recording-lifecycle";
import { nextTashkentHourInput } from "./utils";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import { assignmentUploadPath, lessonUploadPath } from "./lesson-file";

function routeUpload(pathname: string) {
  const res = middleware(new NextRequest(`http://localhost${pathname}`));
  return { status: res.status, rewrite: res.headers.get("x-middleware-rewrite") };
}

describe("Protected uploads never reach public/ static serving", () => {
  it("rewrites lesson materials and assignment files to gated routes", () => {
    const lesson = routeUpload("/uploads/lessons/abc-notes.pdf");
    assert.equal(new URL(lesson.rewrite!).pathname, "/api/files/lessons/abc-notes.pdf");
    const assignment = routeUpload("/uploads/assignments/u1-123-hw.docx");
    assert.equal(new URL(assignment.rewrite!).pathname, "/api/files/assignments/u1-123-hw.docx");
  });

  it("blocks recordings and nested upload paths outright", () => {
    assert.equal(routeUpload("/uploads/recordings/x.webm").status, 403);
    const nested = routeUpload("/uploads/lessons/a/b.pdf");
    assert.equal(nested.status, 404);
    assert.equal(nested.rewrite, null);
  });

  it("rejects path traversal in upload filenames", () => {
    for (const bad of ["", "..", "../x.pdf", "a/b.pdf", "a\\b.pdf", "..%2Fx"]) {
      assert.equal(lessonUploadPath(bad), null);
      assert.equal(assignmentUploadPath(bad), null);
    }
    assert.ok(lessonUploadPath("ok.pdf")?.endsWith("ok.pdf"));
  });
});

const USER = "a6666666-6666-4666-8666-666666666611";

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const prev = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

describe("Telegram deep-link payload", () => {
  it("round-trips only a signed payload within Telegram's 64-char limit", () => {
    withEnv({ AUTH_SECRET: "test-secret-with-enough-length" }, () => {
      const payload = telegramLinkPayload(USER);
      assert.ok(payload);
      assert.ok(payload.length <= 64);
      assert.match(payload, /^[A-Za-z0-9_-]+$/);
      assert.equal(verifyTelegramLinkPayload(payload), USER);
    });
  });

  it("rejects the old bare `link_<userId>` form and forged signatures", () => {
    withEnv({ AUTH_SECRET: "test-secret-with-enough-length" }, () => {
      assert.equal(verifyTelegramLinkPayload(`link_${USER}`), null);
      const payload = telegramLinkPayload(USER)!;
      const forged = `${payload.slice(0, -1)}${payload.endsWith("A") ? "B" : "A"}`;
      assert.equal(verifyTelegramLinkPayload(forged), null);
      const other = "b7777777-7777-4777-8777-777777777701";
      assert.equal(verifyTelegramLinkPayload(payload.replace(USER, other)), null);
    });
  });

  it("fails closed without a server secret", () => {
    withEnv({ AUTH_SECRET: undefined, NEXTAUTH_SECRET: undefined }, () => {
      assert.equal(telegramLinkPayload(USER), null);
      assert.equal(verifyTelegramLinkPayload(`link_${USER}_AAAAAAAAAAAAAAAAAAAA`), null);
    });
  });
});

describe("upload extension allowlist", () => {
  it("accepts documents, images and media", () => {
    for (const name of ["a.pdf", "Slides.PPTX", "x.docx", "p.jpg", "v.mp4", "a.zip"]) {
      assert.ok(safeUploadExtension(name), name);
    }
  });

  it("rejects anything a browser would render as a document or script", () => {
    for (const name of ["x.html", "x.HTM", "logo.svg", "a.xml", "a.js", "a.mjs", "x.xhtml", "noext", "a.pdf.html"]) {
      assert.equal(safeUploadExtension(name), null, name);
    }
  });
});

describe("client IP for rate limits", () => {
  it("trusts X-Real-IP and ignores a client-supplied first X-Forwarded-For hop", () => {
    const req = new Request("http://x/", {
      headers: { "x-forwarded-for": "1.1.1.1, 203.0.113.7", "x-real-ip": "203.0.113.7" },
    });
    assert.equal(getClientIp(req), "203.0.113.7");
    const noReal = new Request("http://x/", { headers: { "x-forwarded-for": "1.1.1.1, 203.0.113.9" } });
    assert.equal(getClientIp(noReal), "203.0.113.9");
  });

  it("isRateLimited peeks without consuming", () => {
    const key = `test-peek-${Date.now()}`;
    assert.equal(isRateLimited(key, 2), false);
    rateLimit(key, 2, 60_000);
    assert.equal(isRateLimited(key, 2), false);
    rateLimit(key, 2, 60_000);
    assert.equal(isRateLimited(key, 2), true);
  });
});

describe("cron auth", () => {
  it("is fail-closed when CRON_SECRET is unset", () => {
    withEnv({ CRON_SECRET: undefined }, () => {
      assert.equal(cronAuthError(new Request("http://x/api/cron/telegram-poll"))?.status, 503);
    });
  });

  it("requires the exact secret", () => {
    withEnv({ CRON_SECRET: "s3cret" }, () => {
      assert.equal(cronAuthError(new Request("http://x/"))?.status, 401);
      assert.equal(
        cronAuthError(new Request("http://x/", { headers: { authorization: "Bearer s3cre" } }))?.status,
        401,
      );
      assert.equal(cronAuthError(new Request("http://x/", { headers: { authorization: "Bearer s3cret" } })), null);
      assert.equal(cronAuthError(new Request("http://x/?secret=s3cret")), null);
    });
  });
});

describe("recording vs lesson state", () => {
  it("never accepts a live-recorder upload for scheduled, cancelled or published lessons", () => {
    for (const s of ["scheduled", "cancelled", "published"]) assert.equal(acceptsRecordingUpload(s), false, s);
    for (const s of ["lobby", "waiting_room", "live", "ended", "teacher_review"]) {
      assert.equal(acceptsRecordingUpload(s), true, s);
    }
  });

  it("only a finished lesson may enter review / be published", () => {
    for (const s of ["live", "lobby", "waiting_room", "scheduled", "cancelled", "paused", null]) {
      assert.equal(lessonMayEnterReview(s), false, String(s));
    }
    for (const s of ["ended", "recording_processing", "recording_ready", "teacher_review"]) {
      assert.equal(lessonMayEnterReview(s), true, s);
    }
  });
});

describe("default lesson slot", () => {
  it("is the next full hour in Asia/Tashkent regardless of the server timezone", () => {
    // 2026-09-28 05:22 UTC = 10:22 Tashkent → next slot 11:00 Tashkent.
    assert.equal(nextTashkentHourInput(new Date("2026-09-28T05:22:00Z")), "2026-09-28T11:00");
    // Crosses midnight in Tashkent.
    assert.equal(nextTashkentHourInput(new Date("2026-12-31T18:30:00Z")), "2027-01-01T00:00");
  });
});
