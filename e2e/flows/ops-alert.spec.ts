import { test, expect } from "../fixtures";
import { FLOW_FIXTURES as F, STAGING_FIXTURE } from "../helpers/test-data";
import { actor, anonymous, api, skipUnlessFlows } from "./flow-helpers";

/** The admin test-alert route fails on purpose (500 → onRequestError → alert) and is admin-only. */
test.describe("Ops alert test route", () => {
  test.beforeEach(() => skipUnlessFlows());

  test("admin gets the deliberate 500, others are refused, app keeps serving", async ({ browser }) => {
    const admin = await actor(browser, STAGING_FIXTURE.adminEmail, /\/admin/);
    const student = await actor(browser, F.users.assign2.email);
    const anon = await anonymous(browser);
    try {
      expect((await api(student.context, "POST", "/api/admin/ops/test-alert")).status).toBe(403);
      expect((await api(anon, "POST", "/api/admin/ops/test-alert")).status).toBe(403);
      expect((await api(admin.context, "POST", "/api/admin/ops/test-alert")).status).toBe(500);
      expect((await api(admin.context, "GET", "/admin")).status, "server healthy after the alert").toBe(200);
      await admin.done();
      await student.done();
    } finally {
      for (const c of [admin.context, student.context, anon]) await c.close().catch(() => undefined);
    }
  });
});
