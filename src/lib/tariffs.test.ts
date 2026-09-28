import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatSom } from "./tariffs";

describe("formatSom", () => {
  it("groups thousands with a no-break space", () => {
    assert.equal(formatSom(2_840_000), "2\u00a0840\u00a0000 so'm");
    assert.equal(formatSom(120_000), "120\u00a0000 so'm");
    assert.equal(formatSom(999), "999 so'm");
    assert.equal(formatSom(0), "0 so'm");
  });

  it("keeps the sign and rounds to whole so'm", () => {
    assert.equal(formatSom(-1_500), "-1\u00a0500 so'm");
    assert.equal(formatSom(1234.6), "1\u00a0235 so'm");
  });

  it("matches the server ICU rendering so SSR and hydration agree", () => {
    for (const n of [0, 7, 1_000, 60_000, 120_000, 2_840_000, 12_345_678]) {
      assert.equal(formatSom(n), `${n.toLocaleString("uz-UZ")} so'm`);
    }
  });
});
