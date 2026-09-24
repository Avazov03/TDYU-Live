/**
 * Unit checks for E2E base URL safety (no browser).
 *   npx tsx --test e2e/helpers/env.test.ts
 */
import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { resolveBaseURL } from "./env";

describe("resolveBaseURL", () => {
  const prevTest = process.env.TEST_BASE_URL;
  const prevPlay = process.env.PLAYWRIGHT_BASE_URL;

  beforeEach(() => {
    delete process.env.TEST_BASE_URL;
    delete process.env.PLAYWRIGHT_BASE_URL;
  });

  afterEach(() => {
    if (prevTest === undefined) delete process.env.TEST_BASE_URL;
    else process.env.TEST_BASE_URL = prevTest;
    if (prevPlay === undefined) delete process.env.PLAYWRIGHT_BASE_URL;
    else process.env.PLAYWRIGHT_BASE_URL = prevPlay;
  });

  it("defaults to localhost:3000", () => {
    assert.equal(resolveBaseURL(), "http://localhost:3000");
  });

  it("allows staging.lexify.zonic.fit", () => {
    process.env.TEST_BASE_URL = "https://staging.lexify.zonic.fit";
    assert.equal(resolveBaseURL(), "https://staging.lexify.zonic.fit");
  });

  it("refuses production lexify.zonic.fit", () => {
    process.env.TEST_BASE_URL = "https://lexify.zonic.fit";
    assert.throws(() => resolveBaseURL(), /production/);
  });

  it("refuses unlisted *.lexify.zonic.fit", () => {
    process.env.TEST_BASE_URL = "https://preview.lexify.zonic.fit";
    assert.throws(() => resolveBaseURL(), /unlisted/);
  });
});
