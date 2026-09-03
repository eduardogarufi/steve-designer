import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { lintFiles, maskNonCode, resolveManifestPath, resolveScope, runCli, scanJsxLiterals, SteveError } from "./design_lint.mjs";

const MANIFEST = new URL("./fixtures/manifest.json", import.meta.url).pathname;
const bad = new URL("./fixtures/lint_bad_hex.tsx", import.meta.url).pathname;
const clean = new URL("./fixtures/lint_clean.tsx", import.meta.url).pathname;
const badSpace = new URL("./fixtures/lint_bad_spacing.tsx", import.meta.url).pathname;
const badComp = new URL("./fixtures/lint_bad_component.tsx", import.meta.url).pathname;
const MANIFEST_PKG = new URL("./fixtures/manifest_pkg.json", import.meta.url).pathname;
const badPkgComp = new URL("./fixtures/lint_bad_pkg_component.tsx", import.meta.url).pathname;
const cleanPkg = new URL("./fixtures/lint_clean_pkg.tsx", import.meta.url).pathname;
const MANIFEST_V2 = new URL("./fixtures/manifest_v2.json", import.meta.url).pathname;
const MANIFEST_V2_NO_I18N = new URL("./fixtures/manifest_v2_no_i18n.json", import.meta.url).pathname;
const v2Colors = new URL("./fixtures/lint_v2_colors.tsx", import.meta.url).pathname;
const literalText = new URL("./fixtures/lint_literal_text.tsx", import.meta.url).pathname;
const literalClean = new URL("./fixtures/lint_literal_clean.tsx", import.meta.url).pathname;
const literalSkip = new URL("./fixtures/lint_literal_skipme.test.tsx", import.meta.url).pathname;

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

test("flags importing a component not in the whitelist", () => {
  const v = lintFiles([badComp], MANIFEST).filter(x => x.rule === "no-unknown-component");
  assert.equal(v.length, 1);
  assert.match(v[0].message, /StatusCard/);
});

test("flags an unknown UI-cased import from a package specifier (@vinci/ui)", () => {
  const v = lintFiles([badPkgComp], MANIFEST_PKG).filter(x => x.rule === "no-unknown-component");
  assert.equal(v.length, 1, JSON.stringify(v));
  assert.match(v[0].message, /UiGhostCard/);
});

test("does not flag real components imported from a package specifier", () => {
  const v = lintFiles([cleanPkg], MANIFEST_PKG).filter(x => x.rule === "no-unknown-component");
  assert.equal(v.length, 0, JSON.stringify(v));
});

test("flags unknown multiline imports and default imports without inventory paths", () => {
  const source = `import { Button,
  Ghost } from "@/components/ui/button";
import StatusCard from "@/components/ui/status-card";
import * as UnknownNamespace from "@/components/ui/widgets";`;
  const violations = lintFiles(["imports.tsx"], MANIFEST, () => source).filter(v => v.rule === "no-unknown-component");
  assert.equal(violations.length, 2, JSON.stringify(violations));
  assert.match(violations[0].message, /Component Ghost/);
  assert.match(violations[1].message, /default import from @\/components\/ui\/status-card does not match any inventory entry/);
  assert.equal(violations[0].line, 1);
});

test("v2 colors and feedback entries are honoured as allowed hex", () => {
  const source = fs.readFileSync(v2Colors, "utf8");
  assert.match(source, /#34d399/);
  const violations = lintFiles([v2Colors], MANIFEST_V2).filter(v => v.rule === "no-hardcoded-hex");
  assert.equal(violations.length, 0, JSON.stringify(violations));
});

test("flags literal JSX text and literal i18n attributes", () => {
  const violations = lintFiles([literalText], MANIFEST_V2).filter(v => v.rule === "no-literal-jsx-string");
  const text = violations.map(v => v.message).join("\n");
  assert.equal(violations.length, 4, text);
  assert.match(text, /Painel de controle/);
  assert.match(text, /Digite o nome/);
  assert.match(text, /Fechar painel/);
  assert.match(text, /Don't panic/);
});

test("does not flag i18n calls, numbers, punctuation, or excluded test files", () => {
  assert.equal(lintFiles([literalClean], MANIFEST_V2).filter(v => v.rule === "no-literal-jsx-string").length, 0);
  assert.equal(lintFiles([literalSkip], MANIFEST_V2).filter(v => v.rule === "no-literal-jsx-string").length, 0);
});

test("the i18n rule is inert when disabled", () => {
  assert.equal(lintFiles([literalText], MANIFEST_V2_NO_I18N).filter(v => v.rule === "no-literal-jsx-string").length, 0);
});

test("flags static expression literals and static i18n attribute expressions", () => {
  const source = '<section>{"Hello"}{\'Olá\'}{`Welcome`}<input placeholder={"Type here"} /></section>';
  const violations = lintFiles(["static-literals.tsx"], MANIFEST_V2, () => source).filter(v => v.rule === "no-literal-jsx-string");
  assert.equal(violations.length, 4, JSON.stringify(violations));
  assert.match(violations.map(v => v.message).join("\n"), /Type here/);
});

test("masks regex literals without suppressing later JSX text", () => {
  const source = 'const matcher = /<not-jsx>/; export const View = () => <p>Hello</p>;';
  const violations = lintFiles(["regex.tsx"], MANIFEST_V2, () => source).filter(v => v.rule === "no-literal-jsx-string");
  assert.equal(violations.length, 1, JSON.stringify(violations));
  assert.equal(violations[0].severity, "error");
  assert.match(violations[0].message, /Hello/);
});

test("includes synthetic patches for untracked UI files in changed scope", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "steve-scope-"));
  fs.writeFileSync(path.join(dir, "new.tsx"), "export const New = () => null;");
  const scope = resolveScope({
    changed: true,
    cwd: dir,
    gitExec: args => args[0] === "ls-files" ? "new.tsx\n" : "",
    gitNoIndexExec: args => args.at(-1) === "new.tsx" ? "diff --git a/new.tsx b/new.tsx\n+export const New = () => null;\n" : "",
  });
  assert.deepEqual(scope.files, ["new.tsx"]);
  assert.match(scope.diff, /diff --git a\/new\.tsx b\/new\.tsx/);
});

test("flags literal JSX nested inside a map expression", () => {
  const source = 'export const List = ({ items }) => <div>{items.map(item => <span>Hello</span>)}</div>;';
  const file = "nested-map.tsx";
  const readAt = requested => requested === file ? source : "";
  const violations = lintFiles([file], MANIFEST_V2, readAt).filter(v => v.rule === "no-literal-jsx-string");
  assert.equal(violations.length, 1, JSON.stringify(violations));
  assert.match(violations[0].message, /Hello/);
});

test("accepts translated JSX nested inside a conditional expression", () => {
  const source = "export const Notice = ({ ok, t }) => <div>{ok && <span>{t('x')}</span>}</div>;";
  const file = "nested-conditional.tsx";
  const violations = lintFiles([file], MANIFEST_V2, requested => requested === file ? source : "");
  assert.equal(violations.filter(v => v.rule === "no-literal-jsx-string").length, 0, JSON.stringify(violations));
});

test("does not mistake a generic arrow for JSX before scanning later literal text", () => {
  const source = "const identity = <T,>(x: T) => x; export const View = () => <p>Hello</p>;";
  const file = "generic-arrow.tsx";
  const violations = lintFiles([file], MANIFEST_V2, requested => requested === file ? source : "");
  assert.equal(violations.filter(v => v.severity === "error").length, 1, JSON.stringify(violations));
  assert.match(violations[0].message, /Hello/);
});

test("treats less-than after a value as an operator and continues scanning JSX", () => {
  const source = "const ok = a<b; export const View = () => <p>Hello</p>;";
  const violations = lintFiles(["less-than.tsx"], MANIFEST_V2, () => source).filter(v => v.rule === "no-literal-jsx-string");
  assert.equal(violations.length, 1, JSON.stringify(violations));
  assert.equal(violations[0].severity, "error");
  assert.match(violations[0].message, /Hello/);
});

test("recognizes JSX fragments, including their closing tag", () => {
  const source = "export const View = () => <>Hello</>;";
  const violations = lintFiles(["fragment.tsx"], MANIFEST_V2, () => source).filter(v => v.rule === "no-literal-jsx-string");
  assert.equal(violations.length, 1, JSON.stringify(violations));
  assert.equal(violations[0].severity, "error");
  assert.match(violations[0].message, /Hello/);
});

test("preserves three-dot ranges in git diff commands", () => {
  const commands = [];
  const scope = resolveScope({
    range: "base...head",
    gitExec: args => {
      commands.push(args);
      if (args[0] === "rev-parse") return args.at(-1).startsWith("base") ? "base-oid\n" : "head-oid\n";
      if (args[0] === "diff" && args.includes("--name-only")) return "View.tsx\n";
      if (args[0] === "diff") return "patch";
      return "";
    },
  });
  assert.equal(scope.range, "base...head");
  assert.ok(commands.some(args => args.join(" ") === "diff --name-only --diff-filter=ACMR base-oid...head-oid"));
  assert.ok(commands.some(args => args.join(" ") === "diff base-oid...head-oid -- View.tsx"));
});

test("resolves namespace component roots against the inventory", () => {
  const source = `import * as ui from "@/components/ui/button";
export const View = () => <><ui.Button /><ui.Ghost /><ui.Button.Group /></>;`;
  const violations = lintFiles(["namespace.tsx"], MANIFEST, () => source).filter(v => v.rule === "no-unknown-component");
  assert.equal(violations.length, 1, JSON.stringify(violations));
  assert.match(violations[0].message, /Component Ghost/);
});

test("validates named imports by exported name rather than local alias", () => {
  const cleanSource = 'import { Button as Btn } from "@/components/ui/button"; export const View = () => <Btn />;';
  const badSource = 'import { Ghost as Btn } from "@/components/ui/button"; export const View = () => <Btn />;';
  assert.equal(lintFiles(["named-clean.tsx"], MANIFEST, () => cleanSource).filter(v => v.rule === "no-unknown-component").length, 0);
  const violations = lintFiles(["named-bad.tsx"], MANIFEST, () => badSource).filter(v => v.rule === "no-unknown-component");
  assert.equal(violations.length, 1, JSON.stringify(violations));
  assert.match(violations[0].message, /Component Ghost/);
});

test("requires default imports to match an inventory import path", () => {
  const defaultSource = 'import Button from "@/components/ui/button"; export const View = () => <Button />;';
  const namedDefaultSource = 'import { default as Button } from "@/components/ui/button"; export const View = () => <Button />;';
  const badSource = 'import Ghost from "@/components/ui/ghost"; export const View = () => <Ghost />;';
  assert.equal(lintFiles(["default-clean.tsx"], MANIFEST, () => defaultSource).filter(v => v.rule === "no-unknown-component").length, 0);
  assert.equal(lintFiles(["named-default-clean.tsx"], MANIFEST, () => namedDefaultSource).filter(v => v.rule === "no-unknown-component").length, 0);
  const violations = lintFiles(["default-bad.tsx"], MANIFEST, () => badSource).filter(v => v.rule === "no-unknown-component");
  assert.equal(violations.length, 1, JSON.stringify(violations));
  assert.equal(violations[0].message, "default import from @/components/ui/ghost does not match any inventory entry");
});

test("ignores type-only component import specifiers", () => {
  const typeOnly = 'import type { ButtonProps } from "@/components/ui/button";';
  const inlineType = 'import { type ButtonProps, Ghost } from "@/components/ui/button";';
  assert.equal(lintFiles(["type-only.tsx"], MANIFEST, () => typeOnly).filter(v => v.rule === "no-unknown-component").length, 0);
  const violations = lintFiles(["inline-type.tsx"], MANIFEST, () => inlineType).filter(v => v.rule === "no-unknown-component");
  assert.equal(violations.length, 1, JSON.stringify(violations));
  assert.match(violations[0].message, /Component Ghost/);
});

test("reports an unscannable file as a non-blocking CLI warning", () => {
  const file = "unscannable.tsx";
  const stdout = [], stderr = [];
  const status = runCli(["--manifest", MANIFEST_V2, file], {
    readAt: requested => requested === file ? "export const Broken = () => <div" : "",
    write: line => stdout.push(line),
    writeError: line => stderr.push(line),
  });
  assert.equal(status, 0);
  assert.match(stderr.join("\n"), /^WARNING unscannable\.tsx:1 \[no-literal-jsx-string\] file could not be scanned for literal strings; review manually$/);
  assert.match(stdout.join("\n"), /clean \(1 warning\(s\)\)\./);
});

test("the lexer masks JS strings/comments but keeps JSX body text, including apostrophes", () => {
  const { masked, ok } = maskNonCode(`const a = "hidden"; // gone
<p>Don't panic</p>`);
  assert.equal(ok, true);
  assert.ok(!masked.includes("hidden") && !masked.includes("gone"));
  assert.ok(masked.includes("Don't panic"));
  assert.deepEqual(scanJsxLiterals("<p>Don't panic</p>"), [{ index: 3, text: "Don't panic", kind: "text" }]);
});

test("two manifests present is an explicit failure", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "steve-paths-"));
  fs.mkdirSync(path.join(dir, "docs", "design"), { recursive: true });
  fs.writeFileSync(path.join(dir, "docs", "design", "manifest.json"), "{}");
  fs.writeFileSync(path.join(dir, "design-system-manifest.json"), "{}");
  assert.throws(() => resolveManifestPath(null, dir), error => error instanceof SteveError && /docs\/design\/manifest\.json/.test(error.message) && /design-system-manifest\.json/.test(error.message));
});
