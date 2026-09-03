import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCli, ScopeError } from "./design_lint.mjs";

const manifest = new URL("./fixtures/manifest.json", import.meta.url).pathname;
const bad = new URL("./fixtures/lint_bad_hex.tsx", import.meta.url).pathname;
const clean = new URL("./fixtures/lint_clean.tsx", import.meta.url).pathname;

function invoke(args, options) {
  const stdout = [], stderr = [];
  const status = runCli(args, { ...options, write: line => stdout.push(line), writeError: line => stderr.push(line) });
  return { status, output: stdout.join("\n") + stderr.join("\n") };
}

test("exits 1 and prints the violation on bad input", () => {
  const result = invoke(["--manifest", manifest, bad]);
  assert.equal(result.status, 1);
  assert.match(result.output, /no-hardcoded-hex/);
});

test("exits 0 on clean input", () => {
  const result = invoke(["--manifest", manifest, clean]);
  assert.equal(result.status, 0);
  assert.match(result.output, /clean/i);
});

test("--commit scopes to that commit and blocks violations", () => {
  const result = invoke(["--manifest", manifest, "--commit", "abc"], {
    scopeResolver: () => ({ files: ["bad.tsx"], readAt: () => 'export const X = () => <div style={{ color: "#ff0000" }} />;' }),
  });
  assert.equal(result.status, 1);
  assert.match(result.output, /no-hardcoded-hex/);
});

test("an invalid revision fails closed with exit 2 and never reports clean", () => {
  const result = invoke(["--manifest", manifest, "--commit", "deadbeefdeadbeef"], {
    scopeResolver: () => { throw new ScopeError('Not a valid commit: "deadbeefdeadbeef".'); },
  });
  assert.equal(result.status, 2);
  assert.doesNotMatch(result.output, /clean/i);
});

test("mutually exclusive scope flags are rejected", () => {
  const result = invoke(["--manifest", manifest, "--changed", "--commit", "abc"]);
  assert.equal(result.status, 2);
  assert.match(result.output, /mutually exclusive/);
});

test("missing --commit value fails closed without claiming clean", () => {
  const result = invoke(["--manifest", manifest, "--commit"]);
  assert.equal(result.status, 2);
  assert.match(result.output, /--commit requires a value/);
  assert.doesNotMatch(result.output, /clean/i);
});

test("emits a scope snapshot with the documented fields", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "steve-emit-"));
  const output = path.join(dir, "nested", "scope.json");
  const result = invoke(["--manifest", manifest, "--emit-scope", output], {
    cwd: dir,
    scopeResolver: () => ({ mode: "changed", base: "HEAD", head: null, files: [], diff: "" }),
  });
  assert.equal(result.status, 0, result.output);
  const snapshot = JSON.parse(fs.readFileSync(output, "utf8"));
  assert.deepEqual(Object.keys(snapshot).sort(), ["base", "diff", "files", "head", "lintVersion", "manifest", "mode", "range"]);
  assert.equal(snapshot.mode, "changed");
  assert.equal(snapshot.range, null);
  assert.equal(snapshot.lintVersion, "0.3.0");
});

test("records the raw range in an emitted scope snapshot", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "steve-range-"));
  const output = path.join(dir, "scope.json");
  const result = invoke(["--manifest", manifest, "--range", "base...head", "--emit-scope", output], {
    cwd: dir,
    scopeResolver: args => ({ mode: "range", base: "base-oid", head: "head-oid", range: args.range, files: [], diff: "" }),
  });
  assert.equal(result.status, 0, result.output);
  assert.equal(JSON.parse(fs.readFileSync(output, "utf8")).range, "base...head");
});

test("prints the current lint version without needing a manifest", () => {
  const result = invoke(["--version"]);
  assert.equal(result.status, 0);
  assert.match(result.output, /^design-lint 0\.3\.0$/);
});
