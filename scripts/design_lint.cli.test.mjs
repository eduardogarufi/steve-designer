import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const cli = new URL("./design_lint.mjs", import.meta.url).pathname;
const manifest = new URL("./fixtures/manifest.json", import.meta.url).pathname;
const bad = new URL("./fixtures/lint_bad_hex.tsx", import.meta.url).pathname;
const clean = new URL("./fixtures/lint_clean.tsx", import.meta.url).pathname;

test("exits 1 and prints the violation on bad input", () => {
  try {
    execFileSync("node", [cli, "--manifest", manifest, bad], { encoding: "utf8" });
    assert.fail("should have exited non-zero");
  } catch (e) {
    assert.equal(e.status, 1);
    assert.match(e.stdout + e.stderr, /no-hardcoded-hex/);
  }
});

test("exits 0 on clean input", () => {
  const out = execFileSync("node", [cli, "--manifest", manifest, clean], { encoding: "utf8" });
  assert.match(out, /clean/i);
});
