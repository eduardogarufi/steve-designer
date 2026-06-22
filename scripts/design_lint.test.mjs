import { test } from "node:test";
import assert from "node:assert/strict";
import { lintFiles } from "./design_lint.mjs";

const MANIFEST = new URL("./fixtures/manifest.json", import.meta.url).pathname;
const bad = new URL("./fixtures/lint_bad_hex.tsx", import.meta.url).pathname;
const clean = new URL("./fixtures/lint_clean.tsx", import.meta.url).pathname;
const badSpace = new URL("./fixtures/lint_bad_spacing.tsx", import.meta.url).pathname;

test("flags a hardcoded hex not in the token system", () => {
  const violations = lintFiles([bad], MANIFEST);
  const hex = violations.filter(v => v.rule === "no-hardcoded-hex");
  assert.equal(hex.length, 1);
  assert.match(hex[0].message, /#ff0000/);
});

test("does not flag token-referenced color", () => {
  const violations = lintFiles([clean], MANIFEST);
  assert.equal(violations.filter(v => v.rule === "no-hardcoded-hex").length, 0);
});

test("flags a Tailwind arbitrary px value off the spacing scale", () => {
  const v = lintFiles([badSpace], MANIFEST).filter(x => x.rule === "no-off-scale-spacing");
  assert.equal(v.length, 1);
  assert.match(v[0].message, /13px/);
});
