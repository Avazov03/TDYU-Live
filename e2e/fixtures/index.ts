import { test as base, expect, type Page } from "@playwright/test";
import { loginAs } from "../auth/login";
import { BrowserMonitor } from "../helpers/browser-monitor";
import {
  adminCreds,
  isE2EDbReady,
  skipReasonDbNotReady,
  skipReasonMissingCreds,
  studentCreds,
  teacherCreds,
} from "../helpers/env";

type Fixtures = {
  monitor: BrowserMonitor;
  /** Authenticated student page (skipped if E2E_STUDENT_* unset). */
  studentPage: Page;
  /** Authenticated teacher page (skipped if E2E_TEACHER_* unset). */
  teacherPage: Page;
  /** Authenticated admin page (skipped if E2E_ADMIN_* unset). */
  adminPage: Page;
};

/**
 * Extended Playwright test:
 * - `monitor` attaches console / pageerror / network listeners
 * - auto-asserts no critical browser errors after each test
 * - role pages log in once per test via UI
 */
export const test = base.extend<Fixtures>({
  monitor: async ({ page }, use, testInfo) => {
    const monitor = new BrowserMonitor(page);
    monitor.attach();
    await use(monitor);

    const body = monitor.formatReport();
    await testInfo.attach("browser-diagnostics", {
      body,
      contentType: "text/plain",
    });

    if (testInfo.status === "passed" || testInfo.status === undefined) {
      monitor.assertNoCriticalBrowserErrors();
    } else if (monitor.getCritical().length) {
      // Already failing — append diagnostics to error output when possible.
      testInfo.annotations.push({
        type: "browser-diagnostics",
        description: body,
      });
    }
  },

  studentPage: async ({ page, monitor }, use) => {
    test.skip(!isE2EDbReady(), skipReasonDbNotReady());
    const creds = studentCreds();
    test.skip(!creds, skipReasonMissingCreds("student"));
    await loginAs(page, creds!, {
      monitor,
      expectPath: /\/(app|onboard)(\/|\?|$)/,
    });
    await use(page);
  },

  teacherPage: async ({ page, monitor }, use) => {
    test.skip(!isE2EDbReady(), skipReasonDbNotReady());
    const creds = teacherCreds();
    test.skip(!creds, skipReasonMissingCreds("teacher"));
    await loginAs(page, creds!, { monitor, expectPath: /\/teacher/ });
    await use(page);
  },

  adminPage: async ({ page, monitor }, use) => {
    test.skip(!isE2EDbReady(), skipReasonDbNotReady());
    const creds = adminCreds();
    test.skip(!creds, skipReasonMissingCreds("admin"));
    await loginAs(page, creds!, { monitor, expectPath: /\/admin/ });
    await use(page);
  },
});

export { expect };
