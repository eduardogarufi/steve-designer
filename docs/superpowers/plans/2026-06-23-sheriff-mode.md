# Sheriff Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone, cross-tool (Claude Code + Codex) "Sheriff Mode" to steve-designer that keeps ongoing development faithful to an existing design system via a real component/token inventory, a versioned rule file, and a hard automated lint gate.

**Architecture:** Three mechanisms — INGEST (auto-detect stack → `design-system-manifest.json`), CODIFY (manifest → `AGENTS.md` + lint ruleset), PATROL (a `design-lint` script wired into pre-commit/CI that blocks, plus a Claude-side hook + `design-enforcer` subagent for semantic review). The portable artifacts (manifest, AGENTS.md, design-lint, pre-commit/CI) are the guarantee; the Claude skill/commands/hook/subagent are a convenience layer that degrades gracefully under Codex.

**Tech Stack:** Node 20 (the `design_lint.mjs` engine + `node --test`), Python 3 (the `ingest_design_system.py` detector + dependency-free assert tests), Bash (wiring), Markdown (plugin commands/agents/templates/docs). No new runtime dependencies.

---

## File Structure

**New — engine (testable core):**
- `scripts/ingest_design_system.py` — stack auto-detection + manifest emitter.
- `scripts/test_ingest.py` — dependency-free asserts over fixture repos.
- `scripts/design_lint.mjs` — the stack-aware linter (hex/spacing/whitelist), exit non-zero on violation.
- `scripts/design_lint.test.mjs` — `node --test` over fixtures.
- `scripts/fixtures/` — sample repos/files used by both test suites.

**New — wiring templates:**
- `templates/design-system-manifest.template.json` — canonical manifest shape (documentation).
- `templates/AGENTS.md.template.md` — the portable law.
- `templates/mcp.json.template` — Claude Code MCP config (≤3 servers).
- `templates/codex-config.toml.template` — Codex MCP config (≤3 servers).
- `templates/precommit-design.template.sh` — git pre-commit hook body.
- `templates/ci-design-check.template.yml` — GitHub Actions workflow.

**New — Claude convenience layer:**
- `hooks/design-lint-hook.sh` — PostToolUse hook: run fast lint on UI-file edits, silent on pass.
- `hooks/hooks.json` — hook registration.
- `commands/guard.md` — one-time setup (INGEST + CODIFY + install gate).
- `commands/patrol.md` — on-demand semantic enforcement run.
- `agents/design-enforcer.md` — semantic review subagent.

**New — docs:**
- `skills/steve-designer/references/governance-playbook.md` — severity model, false-positive handling, operating model.

**Modified:**
- `skills/steve-designer/SKILL.md` — add the Sheriff Mode section + when-to-use.
- `skills/steve-designer/references/arsenal.md` — re-tier creation vs governance + tool-bloat note.
- `skills/steve-designer/references/orchestration-map.md` — governance rows.
- `.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json` — version bump + keywords.
- `CHANGELOG.md`.

**Manifest schema (single source of truth — every task below conforms to this):**

```json
{
  "generatedAt": "2026-06-23T00:00:00Z",
  "stack": { "type": "shadcn|own-primitives|tailwind-css", "framework": "next|vite|astro|unknown", "tailwind": true },
  "tokens": {
    "color":   { "bg-base": "#0b0b0c", "accent": "#3b82f6" },
    "spacing": { "1": "4px", "2": "8px" },
    "radius":  { "sm": "4px" },
    "shadow":  { "sm": "0 1px 2px rgba(0,0,0,.06)" },
    "motion":  { "fast": "120ms" }
  },
  "components": [
    { "name": "Button", "import": "@/components/ui/button", "props": ["variant", "size", "asChild"] }
  ],
  "packages": { "next": "15.0.0", "tailwindcss": "4.0.0" },
  "allowedHex": ["#0b0b0c", "#3b82f6"]
}
```

`allowedHex` is derived: every hex literal appearing in `tokens.color` values. The linter treats those as legal; any other hex literal in source is a violation.

---

## Phase A — The engine (testable core)

### Task 1: Manifest emitter — token detection

**Files:**
- Create: `scripts/ingest_design_system.py`
- Create: `scripts/test_ingest.py`
- Create: `scripts/fixtures/repo_tailwind_css/globals.css`
- Create: `scripts/fixtures/repo_tailwind_css/package.json`

- [ ] **Step 1: Create the fixture repo (pure Tailwind/CSS tokens)**

Create `scripts/fixtures/repo_tailwind_css/globals.css`:

```css
:root {
  --color-bg-base: #0b0b0c;
  --color-accent: #3b82f6;
  --space-1: 4px;
  --space-2: 8px;
  --radius-sm: 4px;
}
```

Create `scripts/fixtures/repo_tailwind_css/package.json`:

```json
{ "name": "fx-tailwind", "dependencies": { "tailwindcss": "4.0.0" } }
```

- [ ] **Step 2: Write the failing test for token + stack detection**

Create `scripts/test_ingest.py`:

```python
import json, os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))

def run_ingest(repo):
    out = subprocess.run(
        [sys.executable, os.path.join(HERE, "ingest_design_system.py"), "--root", repo, "--stdout"],
        capture_output=True, text=True,
    )
    assert out.returncode == 0, f"ingest failed: {out.stderr}"
    return json.loads(out.stdout)

def test_tailwind_css_tokens_and_stack():
    repo = os.path.join(HERE, "fixtures", "repo_tailwind_css")
    m = run_ingest(repo)
    assert m["stack"]["type"] == "tailwind-css", m["stack"]
    assert m["stack"]["tailwind"] is True
    assert m["tokens"]["color"]["bg-base"] == "#0b0b0c"
    assert m["tokens"]["color"]["accent"] == "#3b82f6"
    assert m["tokens"]["spacing"]["1"] == "4px"
    assert m["tokens"]["radius"]["sm"] == "4px"
    assert sorted(m["allowedHex"]) == ["#0b0b0c", "#3b82f6"]
    assert m["packages"]["tailwindcss"] == "4.0.0"

if __name__ == "__main__":
    test_tailwind_css_tokens_and_stack()
    print("ok: test_tailwind_css_tokens_and_stack")
```

- [ ] **Step 3: Run the test, verify it fails**

Run: `python3 scripts/test_ingest.py`
Expected: FAIL — `ingest_design_system.py` does not exist (`No such file` / non-zero return).

- [ ] **Step 4: Implement token + stack detection in the ingest script**

Create `scripts/ingest_design_system.py`:

```python
#!/usr/bin/env python3
"""ingest_design_system.py — auto-detect a repo's design system and emit a manifest.

Usage:
  ingest_design_system.py --root PATH [--stdout | --out PATH]
Exit codes: 0 ok, 1 error.
"""
import argparse, glob, json, os, re, sys

CSS_VAR_RE = re.compile(r"--([a-z0-9-]+)\s*:\s*([^;]+);", re.I)
HEX_RE = re.compile(r"#[0-9a-fA-F]{3,8}\b")

def read(path):
    try:
        with open(path, encoding="utf-8") as f:
            return f.read()
    except (OSError, UnicodeDecodeError):
        return ""

def find_files(root, patterns):
    out = []
    for pat in patterns:
        out += glob.glob(os.path.join(root, "**", pat), recursive=True)
    return [p for p in out if "node_modules" not in p]

def classify_token(name):
    if name.startswith("color-") or name.startswith("color"):
        return ("color", name[len("color-"):] if name.startswith("color-") else name)
    if name.startswith("space-") or name.startswith("spacing-"):
        return ("spacing", name.split("-", 1)[1])
    if name.startswith("radius-"):
        return ("radius", name.split("-", 1)[1])
    if name.startswith("shadow-"):
        return ("shadow", name.split("-", 1)[1])
    if name.startswith("motion-") or name.startswith("duration-") or name.startswith("ease-"):
        return ("motion", name.split("-", 1)[1])
    return (None, name)

def detect_tokens(root):
    tokens = {"color": {}, "spacing": {}, "radius": {}, "shadow": {}, "motion": {}}
    for css in find_files(root, ["*.css"]):
        for name, value in CSS_VAR_RE.findall(read(css)):
            bucket, short = classify_token(name.lower())
            if bucket:
                tokens[bucket][short] = value.strip()
    return tokens

def detect_packages(root):
    pkg = read(os.path.join(root, "package.json"))
    if not pkg:
        return {}
    try:
        data = json.loads(pkg)
    except json.JSONDecodeError:
        return {}
    deps = {}
    deps.update(data.get("dependencies", {}))
    deps.update(data.get("devDependencies", {}))
    return {k: v.lstrip("^~") for k, v in deps.items()}

def detect_stack(root, packages):
    framework = "unknown"
    if "next" in packages:
        framework = "next"
    elif "astro" in packages:
        framework = "astro"
    elif "vite" in packages:
        framework = "vite"
    tailwind = "tailwindcss" in packages
    if os.path.exists(os.path.join(root, "components.json")):
        stype = "shadcn"
    elif find_files(root, ["*.tsx", "*.jsx"]) and (
        os.path.isdir(os.path.join(root, "components"))
        or os.path.isdir(os.path.join(root, "src", "components"))
    ):
        stype = "own-primitives"
    else:
        stype = "tailwind-css"
    return {"type": stype, "framework": framework, "tailwind": tailwind}

def build_manifest(root):
    packages = detect_packages(root)
    tokens = detect_tokens(root)
    allowed = sorted({h.lower() for v in tokens["color"].values() for h in HEX_RE.findall(v)})
    return {
        "generatedAt": "GENERATED",
        "stack": detect_stack(root, packages),
        "tokens": tokens,
        "components": [],  # filled in Task 2
        "packages": packages,
        "allowedHex": allowed,
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--stdout", action="store_true")
    ap.add_argument("--out")
    args = ap.parse_args()
    if not os.path.isdir(args.root):
        print(f"root not found: {args.root}", file=sys.stderr)
        return 1
    manifest = build_manifest(args.root)
    text = json.dumps(manifest, indent=2)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text + "\n")
    if args.stdout or not args.out:
        print(text)
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 5: Run the test, verify it passes**

Run: `python3 scripts/test_ingest.py`
Expected: `ok: test_tailwind_css_tokens_and_stack`

- [ ] **Step 6: Commit**

```bash
git add scripts/ingest_design_system.py scripts/test_ingest.py scripts/fixtures/repo_tailwind_css
git commit -m "feat(sheriff): ingest tokens + stack detection"
```

---

### Task 2: Manifest emitter — component inventory

**Files:**
- Modify: `scripts/ingest_design_system.py` (add `detect_components`, call it in `build_manifest`)
- Modify: `scripts/test_ingest.py` (add a shadcn fixture test)
- Create: `scripts/fixtures/repo_shadcn/components.json`
- Create: `scripts/fixtures/repo_shadcn/components/ui/button.tsx`
- Create: `scripts/fixtures/repo_shadcn/package.json`

- [ ] **Step 1: Create the shadcn fixture**

Create `scripts/fixtures/repo_shadcn/components.json`:

```json
{ "style": "default", "tailwind": { "config": "tailwind.config.ts" } }
```

Create `scripts/fixtures/repo_shadcn/package.json`:

```json
{ "name": "fx-shadcn", "dependencies": { "next": "15.0.0", "tailwindcss": "4.0.0" } }
```

Create `scripts/fixtures/repo_shadcn/components/ui/button.tsx`:

```tsx
export interface ButtonProps {
  variant?: "default" | "ghost";
  size?: "sm" | "lg";
  asChild?: boolean;
}
export function Button({ variant, size, asChild }: ButtonProps) {
  return <button data-variant={variant} data-size={size} />;
}
```

- [ ] **Step 2: Write the failing test for component inventory**

Add to `scripts/test_ingest.py` (and call it in `__main__`):

```python
def test_shadcn_components():
    repo = os.path.join(HERE, "fixtures", "repo_shadcn")
    m = run_ingest(repo)
    assert m["stack"]["type"] == "shadcn", m["stack"]
    assert m["stack"]["framework"] == "next"
    names = {c["name"] for c in m["components"]}
    assert "Button" in names, names
    button = next(c for c in m["components"] if c["name"] == "Button")
    assert sorted(button["props"]) == ["asChild", "size", "variant"], button["props"]
    assert button["import"].endswith("components/ui/button")
```

Update the bottom of the file:

```python
if __name__ == "__main__":
    test_tailwind_css_tokens_and_stack(); print("ok: tailwind_css")
    test_shadcn_components(); print("ok: shadcn_components")
```

- [ ] **Step 3: Run the test, verify it fails**

Run: `python3 scripts/test_ingest.py`
Expected: PASS on `tailwind_css`, FAIL on `shadcn_components` (`components` is empty `[]`).

- [ ] **Step 4: Implement component detection**

Add to `scripts/ingest_design_system.py` (above `build_manifest`):

```python
EXPORT_RE = re.compile(r"export\s+(?:default\s+)?(?:function|const)\s+([A-Z][A-Za-z0-9]+)")
PROPS_IFACE_RE = re.compile(r"interface\s+([A-Z][A-Za-z0-9]*Props)\s*\{([^}]*)\}", re.S)
PROP_NAME_RE = re.compile(r"([A-Za-z0-9]+)\??\s*:")

def detect_components(root):
    comps = []
    for path in find_files(root, ["*.tsx", "*.jsx"]):
        if "/components/" not in path.replace("\\", "/"):
            continue
        src = read(path)
        exports = EXPORT_RE.findall(src)
        if not exports:
            continue
        props_by_iface = {name: PROP_NAME_RE.findall(body) for name, body in PROPS_IFACE_RE.findall(src)}
        rel = os.path.relpath(path, root).replace("\\", "/")
        imp = os.path.splitext(rel)[0]
        for name in exports:
            props = props_by_iface.get(name + "Props", [])
            comps.append({"name": name, "import": imp, "props": sorted(set(props))})
    return comps
```

In `build_manifest`, replace `"components": []` with `"components": detect_components(root),`.

- [ ] **Step 5: Run the test, verify both pass**

Run: `python3 scripts/test_ingest.py`
Expected: `ok: tailwind_css` and `ok: shadcn_components`.

- [ ] **Step 6: Commit**

```bash
git add scripts/ingest_design_system.py scripts/test_ingest.py scripts/fixtures/repo_shadcn
git commit -m "feat(sheriff): ingest component inventory with props"
```

---

### Task 3: Linter — hardcoded hex rule

**Files:**
- Create: `scripts/design_lint.mjs`
- Create: `scripts/design_lint.test.mjs`
- Create: `scripts/fixtures/manifest.json`
- Create: `scripts/fixtures/lint_bad_hex.tsx`
- Create: `scripts/fixtures/lint_clean.tsx`

- [ ] **Step 1: Create lint fixtures**

Create `scripts/fixtures/manifest.json`:

```json
{
  "stack": { "type": "shadcn" },
  "tokens": { "color": { "bg-base": "#0b0b0c", "accent": "#3b82f6" }, "spacing": { "1": "4px", "2": "8px" }, "radius": {}, "shadow": {}, "motion": {} },
  "components": [{ "name": "Button", "import": "@/components/ui/button", "props": ["variant", "size"] }],
  "packages": {},
  "allowedHex": ["#0b0b0c", "#3b82f6"]
}
```

Create `scripts/fixtures/lint_bad_hex.tsx`:

```tsx
export const X = () => <div style={{ color: "#ff0000" }} />;
```

Create `scripts/fixtures/lint_clean.tsx`:

```tsx
export const X = () => <div className="bg-[var(--color-bg-base)]" />;
```

- [ ] **Step 2: Write the failing test**

Create `scripts/design_lint.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { lintFiles } from "./design_lint.mjs";

const MANIFEST = new URL("./fixtures/manifest.json", import.meta.url).pathname;
const bad = new URL("./fixtures/lint_bad_hex.tsx", import.meta.url).pathname;
const clean = new URL("./fixtures/lint_clean.tsx", import.meta.url).pathname;

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
```

- [ ] **Step 3: Run the test, verify it fails**

Run: `node --test scripts/design_lint.test.mjs`
Expected: FAIL — cannot import `lintFiles` (module/file missing).

- [ ] **Step 4: Implement the linter with the hex rule**

Create `scripts/design_lint.mjs`:

```js
#!/usr/bin/env node
import fs from "node:fs";

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;

export function loadManifest(manifestPath) {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function ruleNoHardcodedHex(file, src, manifest) {
  const allowed = new Set((manifest.allowedHex || []).map(h => h.toLowerCase()));
  const out = [];
  src.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(HEX_RE)) {
      if (!allowed.has(m[0].toLowerCase())) {
        out.push({ rule: "no-hardcoded-hex", file, line: i + 1, severity: "error",
          message: `Hardcoded color ${m[0]} is not in the token system. Use a token (var(--color-*)).` });
      }
    }
  });
  return out;
}

export function lintFiles(files, manifestPath) {
  const manifest = loadManifest(manifestPath);
  const violations = [];
  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    violations.push(...ruleNoHardcodedHex(file, src, manifest));
  }
  return violations;
}
```

- [ ] **Step 5: Run the test, verify it passes**

Run: `node --test scripts/design_lint.test.mjs`
Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/design_lint.mjs scripts/design_lint.test.mjs scripts/fixtures/manifest.json scripts/fixtures/lint_bad_hex.tsx scripts/fixtures/lint_clean.tsx
git commit -m "feat(sheriff): design-lint no-hardcoded-hex rule"
```

---

### Task 4: Linter — off-scale spacing rule

**Files:**
- Modify: `scripts/design_lint.mjs` (add `ruleNoOffScaleSpacing`, call in `lintFiles`)
- Modify: `scripts/design_lint.test.mjs` (add cases)
- Create: `scripts/fixtures/lint_bad_spacing.tsx`

- [ ] **Step 1: Create the fixture**

Create `scripts/fixtures/lint_bad_spacing.tsx`:

```tsx
export const X = () => <div className="p-[13px] m-2" />;
```

- [ ] **Step 2: Write the failing test**

Add to `scripts/design_lint.test.mjs`:

```js
const badSpace = new URL("./fixtures/lint_bad_spacing.tsx", import.meta.url).pathname;

test("flags a Tailwind arbitrary px value off the spacing scale", () => {
  const v = lintFiles([badSpace], MANIFEST).filter(x => x.rule === "no-off-scale-spacing");
  assert.equal(v.length, 1);
  assert.match(v[0].message, /13px/);
});
```

- [ ] **Step 3: Run the test, verify it fails**

Run: `node --test scripts/design_lint.test.mjs`
Expected: FAIL — `no-off-scale-spacing` produces 0 violations.

- [ ] **Step 4: Implement the spacing rule**

Add to `scripts/design_lint.mjs` (before `lintFiles`):

```js
const ARBITRARY_SPACE_RE = /\b[pm][trblxy]?-\[(\d+)px\]/g;

function ruleNoOffScaleSpacing(file, src, manifest) {
  const scalePx = new Set(Object.values(manifest.tokens?.spacing || {}));
  const out = [];
  src.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(ARBITRARY_SPACE_RE)) {
      const px = `${m[1]}px`;
      if (!scalePx.has(px)) {
        out.push({ rule: "no-off-scale-spacing", file, line: i + 1, severity: "error",
          message: `Spacing ${px} is off the scale. Use a spacing token or a scale step.` });
      }
    }
  });
  return out;
}
```

In `lintFiles`, add after the hex push:

```js
    violations.push(...ruleNoOffScaleSpacing(file, src, manifest));
```

- [ ] **Step 5: Run the test, verify all pass**

Run: `node --test scripts/design_lint.test.mjs`
Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/design_lint.mjs scripts/design_lint.test.mjs scripts/fixtures/lint_bad_spacing.tsx
git commit -m "feat(sheriff): design-lint no-off-scale-spacing rule"
```

---

### Task 5: Linter — non-whitelisted component rule

**Files:**
- Modify: `scripts/design_lint.mjs` (add `ruleNoUnknownComponent`, call in `lintFiles`)
- Modify: `scripts/design_lint.test.mjs` (add cases)
- Create: `scripts/fixtures/lint_bad_component.tsx`

- [ ] **Step 1: Create the fixture**

Create `scripts/fixtures/lint_bad_component.tsx`:

```tsx
import { StatusCard } from "@/components/ui/status-card";
export const X = () => <StatusCard />;
```

- [ ] **Step 2: Write the failing test**

Add to `scripts/design_lint.test.mjs`:

```js
const badComp = new URL("./fixtures/lint_bad_component.tsx", import.meta.url).pathname;

test("flags importing a component not in the whitelist", () => {
  const v = lintFiles([badComp], MANIFEST).filter(x => x.rule === "no-unknown-component");
  assert.equal(v.length, 1);
  assert.match(v[0].message, /StatusCard/);
});
```

- [ ] **Step 3: Run the test, verify it fails**

Run: `node --test scripts/design_lint.test.mjs`
Expected: FAIL — `no-unknown-component` produces 0 violations.

- [ ] **Step 4: Implement the whitelist rule (only when a whitelist exists)**

Add to `scripts/design_lint.mjs`:

```js
const UI_IMPORT_RE = /import\s*\{([^}]+)\}\s*from\s*["']([^"']*\/components\/ui\/[^"']+)["']/g;

function ruleNoUnknownComponent(file, src, manifest) {
  const known = new Set((manifest.components || []).map(c => c.name));
  // Only enforce when the project actually exposes a component whitelist.
  if (known.size === 0) return [];
  const out = [];
  src.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(UI_IMPORT_RE)) {
      const names = m[1].split(",").map(s => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
      for (const name of names) {
        if (/^[A-Z]/.test(name) && !known.has(name)) {
          out.push({ rule: "no-unknown-component", file, line: i + 1, severity: "error",
            message: `Component ${name} is not in the design-system inventory. Add it via the DS or use an existing component.` });
        }
      }
    }
  });
  return out;
}
```

In `lintFiles`, add:

```js
    violations.push(...ruleNoUnknownComponent(file, src, manifest));
```

- [ ] **Step 5: Run the test, verify all pass**

Run: `node --test scripts/design_lint.test.mjs`
Expected: 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/design_lint.mjs scripts/design_lint.test.mjs scripts/fixtures/lint_bad_component.tsx
git commit -m "feat(sheriff): design-lint no-unknown-component rule"
```

---

### Task 6: Linter — CLI entrypoint, exit codes, reporter

**Files:**
- Modify: `scripts/design_lint.mjs` (add CLI main + `--manifest`, `--changed`, file args)
- Create: `scripts/design_lint.cli.test.mjs`

- [ ] **Step 1: Write the failing CLI test**

Create `scripts/design_lint.cli.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `node --test scripts/design_lint.cli.test.mjs`
Expected: FAIL — script has no CLI; clean run does not print "clean", bad run does not exit 1 with output.

- [ ] **Step 3: Implement the CLI main**

Append to `scripts/design_lint.mjs`:

```js
function parseArgs(argv) {
  const args = { manifest: "design-system-manifest.json", files: [], changed: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--manifest") args.manifest = argv[++i];
    else if (a === "--changed") args.changed = true;
    else args.files.push(a);
  }
  return args;
}

function changedFiles() {
  const { execSync } = require("node:child_process");
  const out = execSync("git diff --cached --name-only --diff-filter=ACM", { encoding: "utf8" });
  return out.split("\n").map(s => s.trim()).filter(Boolean)
    .filter(f => /\.(tsx|jsx|css)$/.test(f) && fs.existsSync(f));
}

function isMain() {
  return process.argv[1] && process.argv[1].endsWith("design_lint.mjs");
}

if (isMain()) {
  const args = parseArgs(process.argv.slice(2));
  const files = args.changed ? changedFiles() : args.files;
  if (files.length === 0) { console.log("design-lint: no UI files to check — clean."); process.exit(0); }
  const violations = lintFiles(files, args.manifest);
  if (violations.length === 0) { console.log(`design-lint: ${files.length} file(s) clean.`); process.exit(0); }
  for (const v of violations) {
    console.error(`${v.severity.toUpperCase()} ${v.file}:${v.line} [${v.rule}] ${v.message}`);
  }
  console.error(`\ndesign-lint: ${violations.length} violation(s). Build blocked.`);
  process.exit(1);
}
```

Note: `require` is used inside `changedFiles`; add at the top of the file: `import { createRequire } from "node:module"; const require = createRequire(import.meta.url);`

- [ ] **Step 4: Run all linter tests, verify pass**

Run: `node --test scripts/design_lint.test.mjs scripts/design_lint.cli.test.mjs`
Expected: all tests pass (4 + 2).

- [ ] **Step 5: Commit**

```bash
git add scripts/design_lint.mjs scripts/design_lint.cli.test.mjs
git commit -m "feat(sheriff): design-lint CLI, exit codes, --changed mode"
```

---

## Phase B — The gate wiring (templates)

### Task 7: Manifest + AGENTS.md templates

**Files:**
- Create: `templates/design-system-manifest.template.json`
- Create: `templates/AGENTS.md.template.md`

- [ ] **Step 1: Create the manifest template (documentation copy of the schema)**

Create `templates/design-system-manifest.template.json` with the exact schema from the "Manifest schema" section at the top of this plan (the full JSON block). This file is committed as reference; the real manifest is generated by `ingest_design_system.py`.

- [ ] **Step 2: Create the AGENTS.md template**

Create `templates/AGENTS.md.template.md`:

```markdown
# Design System Law — {{PROJECT_NAME}}

> Generated by steve-designer Sheriff Mode. The machine-readable inventory lives in
> `design-system-manifest.json`. This file is the human + agent contract. Both Claude
> Code and Codex read it. Do not invent components, props, or color values that are not
> in the manifest.

## Hard rules (enforced by `design-lint` in pre-commit + CI)

1. **No hardcoded colors.** Every color must reference a token (`var(--color-*)`). Raw
   hex literals not present in the token system fail the build.
2. **No off-scale spacing.** Use the spacing scale. Tailwind arbitrary `px` values that
   are not a scale step fail the build.
3. **No unknown components.** Only import components listed in the manifest's `components`
   inventory. To add one, build it into the design system first, then re-run
   `/steve-designer:guard` (or `ingest_design_system.py`).

## Inventory pointers

- Tokens: see `design-system-manifest.json` → `tokens`.
- Components (with real props): see `design-system-manifest.json` → `components`.
- Allowed packages + versions: see `design-system-manifest.json` → `packages`.

## When you touch UI

1. Read `design-system-manifest.json` for the real inventory before writing.
2. Use Context7 for package APIs at the versions in `packages` — do not use APIs from memory.
3. Run `node scripts/design_lint.mjs --changed` before committing (the hook/CI does this too).

## Non-negotiables

- {{NON_NEGOTIABLE_1}}
- Responsive mobile-first (375px → 1920px)
- `prefers-reduced-motion` respected on all motion
- Semantic HTML, keyboard navigable, visible focus states

---
*Last generated: {{DATE}} by steve-designer Sheriff Mode.*
```

- [ ] **Step 3: Verify the manifest template is valid JSON**

Run: `python3 -c "import json; json.load(open('templates/design-system-manifest.template.json')); print('valid')"`
Expected: `valid`

- [ ] **Step 4: Commit**

```bash
git add templates/design-system-manifest.template.json templates/AGENTS.md.template.md
git commit -m "feat(sheriff): manifest + AGENTS.md law templates"
```

---

### Task 8: Pre-commit + CI templates

**Files:**
- Create: `templates/precommit-design.template.sh`
- Create: `templates/ci-design-check.template.yml`

- [ ] **Step 1: Create the pre-commit template**

Create `templates/precommit-design.template.sh`:

```bash
#!/usr/bin/env bash
# Installed by steve-designer Sheriff Mode at .git/hooks/pre-commit (or via husky/lefthook).
# Blocks commits that violate the design system.
set -euo pipefail
MANIFEST="${DESIGN_MANIFEST:-design-system-manifest.json}"
if [ ! -f "$MANIFEST" ]; then
  echo "design-lint: no manifest ($MANIFEST) — run /steve-designer:guard. Skipping."
  exit 0
fi
node "$(git rev-parse --show-toplevel)/scripts/design_lint.mjs" --manifest "$MANIFEST" --changed
```

- [ ] **Step 2: Create the CI workflow template**

Create `templates/ci-design-check.template.yml`:

```yaml
name: design-lint
on:
  pull_request:
    paths: ["**/*.tsx", "**/*.jsx", "**/*.css"]
jobs:
  design-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - name: Run design-lint on changed files
        run: |
          BASE="${{ github.event.pull_request.base.sha }}"
          FILES=$(git diff --name-only "$BASE" HEAD -- '*.tsx' '*.jsx' '*.css')
          if [ -z "$FILES" ]; then echo "No UI files changed."; exit 0; fi
          node scripts/design_lint.mjs --manifest design-system-manifest.json $FILES
```

- [ ] **Step 3: Verify the CI YAML parses**

Run: `python3 -c "import sys; print('skip' if __import__('importlib').util.find_spec('yaml') is None else __import__('yaml').safe_load(open('templates/ci-design-check.template.yml')) and 'valid')"`
Expected: `valid` (or `skip` if PyYAML absent — acceptable; the file is templated text).

- [ ] **Step 4: Commit**

```bash
git add templates/precommit-design.template.sh templates/ci-design-check.template.yml
git commit -m "feat(sheriff): pre-commit + CI gate templates"
```

---

### Task 9: MCP config templates (Claude + Codex)

**Files:**
- Create: `templates/mcp.json.template`
- Create: `templates/codex-config.toml.template`

- [ ] **Step 1: Create the Claude Code MCP template (≤3 servers)**

Create `templates/mcp.json.template`:

```json
{
  "mcpServers": {
    "context7": { "command": "npx", "args": ["-y", "@upstash/context7-mcp@latest"] },
    "playwright": { "command": "npx", "args": ["@playwright/mcp@latest"] },
    "shadcn": { "command": "npx", "args": ["shadcn@latest", "mcp"] }
  }
}
```

> The `shadcn` entry is included only when the repo's detected stack is `shadcn`
> (the `guard` command strips it otherwise — see Task 11). Keep ≤3 active.

- [ ] **Step 2: Create the Codex MCP template**

Create `templates/codex-config.toml.template`:

```toml
# Append to ~/.codex/config.toml. steve-designer Sheriff Mode MCP servers (keep <= 3).
[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp@latest"]

[mcp_servers.playwright]
command = "npx"
args = ["@playwright/mcp@latest"]

# Include only when the repo uses shadcn:
[mcp_servers.shadcn]
command = "npx"
args = ["shadcn@latest", "mcp"]
```

- [ ] **Step 3: Verify the JSON template is valid**

Run: `python3 -c "import json; json.load(open('templates/mcp.json.template')); print('valid')"`
Expected: `valid`

- [ ] **Step 4: Commit**

```bash
git add templates/mcp.json.template templates/codex-config.toml.template
git commit -m "feat(sheriff): MCP config templates for Claude + Codex"
```

---

## Phase C — Claude convenience layer

### Task 10: PostToolUse hook (fast lint, silent on pass)

**Files:**
- Create: `hooks/design-lint-hook.sh`
- Create: `hooks/hooks.json`

- [ ] **Step 1: Create the hook script**

Create `hooks/design-lint-hook.sh`:

```bash
#!/usr/bin/env bash
# PostToolUse hook: runs design-lint on a single edited UI file.
# Silent on pass; emits a blocking message on violation. Reads tool input JSON from stdin.
set -euo pipefail
INPUT="$(cat)"
FILE="$(printf '%s' "$INPUT" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("tool_input",{}).get("file_path",""))' 2>/dev/null || true)"
case "$FILE" in
  *.tsx|*.jsx|*.css) ;;
  *) exit 0 ;;
esac
ROOT="$(git -C "$(dirname "$FILE")" rev-parse --show-toplevel 2>/dev/null || true)"
[ -z "$ROOT" ] && exit 0
MANIFEST="$ROOT/design-system-manifest.json"
[ -f "$MANIFEST" ] || exit 0
if ! OUT="$(node "$ROOT/scripts/design_lint.mjs" --manifest "$MANIFEST" "$FILE" 2>&1)"; then
  echo "design-lint blocked this edit:" >&2
  echo "$OUT" >&2
  exit 2   # exit 2 surfaces the message back to the agent
fi
exit 0
```

- [ ] **Step 2: Create the hook registration**

Create `hooks/hooks.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/hooks/design-lint-hook.sh" }
        ]
      }
    ]
  }
}
```

- [ ] **Step 3: Smoke-test the hook against a fixture**

Run:
```bash
chmod +x hooks/design-lint-hook.sh
printf '{"tool_input":{"file_path":"%s/scripts/fixtures/lint_clean.tsx"}}' "$(pwd)" | hooks/design-lint-hook.sh; echo "exit=$?"
```
Expected: `exit=0` (clean file → silent). Note: requires a `design-system-manifest.json` at the fixture's repo root; since the fixture lives in this repo without one, the hook exits 0 at the manifest check — still `exit=0`, which validates the guard path.

- [ ] **Step 4: Commit**

```bash
git add hooks/design-lint-hook.sh hooks/hooks.json
git commit -m "feat(sheriff): PostToolUse design-lint hook"
```

---

### Task 11: `/steve-designer:guard` command

**Files:**
- Create: `commands/guard.md`

- [ ] **Step 1: Write the guard command**

Create `commands/guard.md`:

```markdown
---
description: Set up Sheriff Mode on this repo — ingest the design system, generate the law, and install the hard gate (pre-commit + CI). Works for Claude Code and Codex.
---

You are operating as **steve-designer's Sheriff**. Set up design-system enforcement on the current repository. Read `${CLAUDE_PLUGIN_ROOT}/skills/steve-designer/references/governance-playbook.md` first.

Run these steps in order, reporting what you did after each:

1. **INGEST.** Run:
   `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/ingest_design_system.py --root . --out design-system-manifest.json`
   Then read the manifest back and tell the user: detected stack, token count, component count, package count. If the stack is `tailwind-css` (no component whitelist), say so — the component rule will be inert, tokens + spacing still enforce.

2. **CODIFY — the law.** Copy `${CLAUDE_PLUGIN_ROOT}/templates/AGENTS.md.template.md` to `./AGENTS.md`, filling `{{PROJECT_NAME}}`, `{{NON_NEGOTIABLE_1}}` (ask the user for the one non-negotiable if unknown), and `{{DATE}}`. If a `CLAUDE.md` exists, add a one-line include pointing to `AGENTS.md`; if not, create a `CLAUDE.md` containing only that pointer.

3. **CODIFY — the gate.**
   - Install the pre-commit hook: copy `${CLAUDE_PLUGIN_ROOT}/templates/precommit-design.template.sh` to `.git/hooks/pre-commit` (or, if the repo uses husky/lefthook, wire it there instead) and `chmod +x` it.
   - Install CI: copy `${CLAUDE_PLUGIN_ROOT}/templates/ci-design-check.template.yml` to `.github/workflows/design-lint.yml`.
   - Copy `${CLAUDE_PLUGIN_ROOT}/scripts/design_lint.mjs` into the repo at `scripts/design_lint.mjs` (the hook + CI reference a repo-local path). If the repo already vendors it, skip.

4. **MCP configs (≤3, stack-aware).**
   - From `${CLAUDE_PLUGIN_ROOT}/templates/mcp.json.template`, write/merge `.mcp.json`. Remove the `shadcn` server unless the detected stack is `shadcn`.
   - Tell the user that for Codex they should append the matching block from `${CLAUDE_PLUGIN_ROOT}/templates/codex-config.toml.template` to `~/.codex/config.toml` (same stack-aware rule). Offer to do it.

5. **Verify.** Run `node scripts/design_lint.mjs --manifest design-system-manifest.json --changed` and report the result. Run the ingest test path only if asked.

6. **Report.** Summarize: manifest path, AGENTS.md path, hook installed (y/n), CI installed (y/n), MCP servers configured, and the one cross-tool sentence: "Codex stays faithful because the pre-commit + CI run regardless of which agent wrote the code."

Do not auto-commit. Show the user the diff and let them commit.
```

- [ ] **Step 2: Verify frontmatter + plugin discovery shape matches `commands/start.md`**

Run: `head -4 commands/guard.md`
Expected: a `---` frontmatter block with a `description:` line (same shape as `commands/start.md`).

- [ ] **Step 3: Commit**

```bash
git add commands/guard.md
git commit -m "feat(sheriff): /steve-designer:guard setup command"
```

---

### Task 12: `/steve-designer:patrol` command

**Files:**
- Create: `commands/patrol.md`

- [ ] **Step 1: Write the patrol command**

Create `commands/patrol.md`:

```markdown
---
description: Run Sheriff Mode enforcement on the current UI diff — the fast lint plus the design-enforcer semantic review. Use before opening a PR.
---

You are operating as **steve-designer's Sheriff** on patrol. Enforce the design system over the current changes.

1. **Mechanical gate.** Run:
   `node scripts/design_lint.mjs --manifest design-system-manifest.json --changed`
   If it exits non-zero, list every violation verbatim. These are blocking — they must be fixed.

2. **Semantic review.** Spawn the `design-enforcer` subagent (`${CLAUDE_PLUGIN_ROOT}/agents/design-enforcer.md`). Pass it:
   - the contents of `design-system-manifest.json`,
   - the diff (`git diff` of the UI files),
   - the contents of `AGENTS.md`.
   It returns severity-rated findings the linter can't catch (e.g. semantically wrong component choice, token used in the wrong role).

3. **Report.** Present mechanical violations (blocking) and semantic findings (severity-rated) together. For each blocking item, name the file:line and the exact fix. Do not auto-fix unless the user asks.

If `design-system-manifest.json` is missing, tell the user to run `/steve-designer:guard` first.
```

- [ ] **Step 2: Verify frontmatter**

Run: `head -4 commands/patrol.md`
Expected: `---` frontmatter with `description:`.

- [ ] **Step 3: Commit**

```bash
git add commands/patrol.md
git commit -m "feat(sheriff): /steve-designer:patrol review command"
```

---

### Task 13: `design-enforcer` subagent

**Files:**
- Create: `agents/design-enforcer.md`

- [ ] **Step 1: Write the subagent**

Create `agents/design-enforcer.md`:

```markdown
---
name: design-enforcer
description: Reviews a UI diff against the design-system manifest and AGENTS.md for violations the mechanical linter cannot catch — wrong component choice, token used in the wrong semantic role, invented prop, drift from the synthesis statement. Invoke from steve-designer's /patrol. Read-only review; reports severity, does not edit.
---

You are the **design-enforcer** subagent for steve-designer's Sheriff Mode.

The mechanical linter (`design_lint.mjs`) already caught hardcoded hex, off-scale spacing,
and non-whitelisted component imports. Your job is the semantic layer it cannot see.

## Inputs you receive
- `design-system-manifest.json` contents (the real inventory: tokens, components+props, packages)
- The UI diff (git diff of changed `.tsx`/`.jsx`/`.css`)
- `AGENTS.md` contents (the project law)

## What you check
1. **Invented props.** For each component used in the diff, confirm every prop passed
   exists in that component's `props` list in the manifest. Flag any that don't.
2. **Wrong component choice.** A generic component used where a more specific one exists
   (e.g. `Card` where the inventory has `StatusCard`). Flag with the better option.
3. **Token-role drift.** A token used outside its semantic role (e.g. an accent color used
   as a background, a motion token used for the wrong interaction tier).
4. **Package-version risk.** API usage that doesn't match the version in `packages` —
   recommend a Context7 lookup at that version.
5. **Direction drift.** Output that contradicts AGENTS.md non-negotiables.

## What you do NOT do
- Do not re-report mechanical violations the linter already blocks.
- Do not edit files. You review and report.
- Do not invent rules not grounded in the manifest or AGENTS.md.

## Output format
\`\`\`
## Sheriff semantic review — [scope]

### Blocking (must fix)
1. [file:line] [what] — [the fix, grounded in the manifest]

### Warnings (should fix)
1. [file:line] [what] — [the fix]

### Clean
- [what the diff did right, specifically]
\`\`\`

If the diff is fully clean semantically, say so plainly in one line.
```

- [ ] **Step 2: Verify frontmatter matches existing agents**

Run: `head -4 agents/design-enforcer.md`
Expected: `---` frontmatter with `name:` and `description:` (same shape as `agents/design-critic.md`).

- [ ] **Step 3: Commit**

```bash
git add agents/design-enforcer.md
git commit -m "feat(sheriff): design-enforcer semantic review subagent"
```

---

## Phase D — Integration + docs

### Task 14: Governance playbook reference

**Files:**
- Create: `skills/steve-designer/references/governance-playbook.md`

- [ ] **Step 1: Write the playbook**

Create `skills/steve-designer/references/governance-playbook.md` with these sections (full prose, no placeholders):

- **Purpose** — Sheriff Mode keeps existing design systems faithful; it is the enforcement counterpart to the creation flow. State the three mechanisms INGEST → CODIFY → PATROL in two sentences.
- **The portable-layer rule** — the table from the spec (manifest + AGENTS.md + design-lint + pre-commit/CI are the guarantee; skill/commands/hook/subagent are Claude convenience). One paragraph: "A Claude skill cannot run inside Codex, so the guarantee lives in git-level artifacts."
- **Severity model** — `error` (blocks: hardcoded hex, off-scale spacing, unknown component, invented prop); `warning` (semantic: wrong component choice, token-role drift). Errors block pre-commit/CI; warnings are surfaced by `design-enforcer` only.
- **False positives** — how to allow an intentional exception: add the hex to the token system (preferred), or add a `// design-lint-allow <rule>` line comment which the linter skips (note this as a documented escape hatch; implement only if asked — out of scope for v1, so phrase as "future").
- **Stack-by-stack behavior** — shadcn: full component whitelist; own-primitives: whitelist from the components dir; tailwind-css: no whitelist, tokens + spacing only.
- **Operating cadence** — `guard` once per repo; hook + pre-commit + CI continuously; `patrol` before PRs.

- [ ] **Step 2: Verify the file references resolve**

Run: `grep -n "INGEST" skills/steve-designer/references/governance-playbook.md`
Expected: at least one match (confirms the mechanisms are documented).

- [ ] **Step 3: Commit**

```bash
git add skills/steve-designer/references/governance-playbook.md
git commit -m "docs(sheriff): governance playbook reference"
```

---

### Task 15: SKILL.md — Sheriff Mode section

**Files:**
- Modify: `skills/steve-designer/SKILL.md`

- [ ] **Step 1: Add the Sheriff Mode section**

In `skills/steve-designer/SKILL.md`, after the "Overall flow" section (after line ~33, before `## Phase 1`), insert a new section:

```markdown
## Two modes: Creation vs Sheriff

steve-designer has two modes:

- **Creation mode** (the six phases below) — blank page → shipped UI with real identity.
- **Sheriff mode** (governance) — keep an *existing* design system faithful during ongoing
  development, in Claude Code **and** Codex. Use when the project already has tokens,
  primitives, and packages, and the problem is drift/hallucination, not a missing identity.

Enter Sheriff mode with `/steve-designer:guard` (one-time setup per repo) and
`/steve-designer:patrol` (review a diff). Sheriff mode is built on portable artifacts —
`design-system-manifest.json`, `AGENTS.md`, the `design-lint` gate (pre-commit + CI) —
so the guarantee holds regardless of which agent wrote the code. The skill, commands,
hook, and `design-enforcer` subagent are the Claude-side convenience layer.

See `references/governance-playbook.md` for the full model.
```

- [ ] **Step 2: Add the reference-file pointer**

In the `## Reference files` list near the bottom of SKILL.md, add:

```markdown
- `references/governance-playbook.md` — Sheriff mode: enforcement model, severity, stack behavior
```

And in the `## Agent prompts` list add:

```markdown
- `agents/design-enforcer.md` — Semantic design-system review (Sheriff mode)
```

- [ ] **Step 3: Verify edits applied**

Run: `grep -n "Sheriff" skills/steve-designer/SKILL.md`
Expected: matches in the new section + reference pointer.

- [ ] **Step 4: Commit**

```bash
git add skills/steve-designer/SKILL.md
git commit -m "docs(sheriff): add Sheriff mode section to SKILL.md"
```

---

### Task 16: arsenal.md re-tier + orchestration-map rows

**Files:**
- Modify: `skills/steve-designer/references/arsenal.md`
- Modify: `skills/steve-designer/references/orchestration-map.md`

- [ ] **Step 1: Add a governance arsenal section to arsenal.md**

At the top of `skills/steve-designer/references/arsenal.md`, after the "Guiding principle" line, add:

```markdown
## Two arsenals

steve-designer's tools split by mode:

- **Creation arsenal** (Tiers 1–3 below) — for building new UI.
- **Governance arsenal** (Sheriff mode) — keep ≤3 MCPs active per repo:
  1. **DS source, stack-aware:** shadcn MCP + private registry *if* the repo is shadcn;
     otherwise the manifest is built by direct repo read (no MCP).
  2. **Context7** — correct package APIs at the installed version.
  3. **Visual verifier** — Playwright or Chrome DevTools, the "see what was built" loop.

  Research caps active MCPs at 3–5; Sheriff mode deliberately runs ≤3. Do not stack the
  full creation arsenal on top during enforcement work.
```

- [ ] **Step 2: Add governance rows to orchestration-map.md**

In `skills/steve-designer/references/orchestration-map.md`, after the Master table, add a new table:

```markdown
## Sheriff mode (governance)

| Moment | Primary tool | Notes |
|--------|--------------|-------|
| Setup on a repo | `/steve-designer:guard` → `scripts/ingest_design_system.py` | Auto-detects stack |
| Generate the law | `templates/AGENTS.md.template.md` | Portable; CLAUDE.md points to it |
| Block violations | `scripts/design_lint.mjs` via pre-commit + CI | Git-level; covers Codex too |
| In-session catch (Claude) | `hooks/design-lint-hook.sh` | Silent on pass |
| Semantic review | `agents/design-enforcer.md` via `/steve-designer:patrol` | Props, component choice, drift |
```

- [ ] **Step 3: Verify edits**

Run: `grep -n "Governance\|Sheriff\|guard" skills/steve-designer/references/arsenal.md skills/steve-designer/references/orchestration-map.md`
Expected: matches in both files.

- [ ] **Step 4: Commit**

```bash
git add skills/steve-designer/references/arsenal.md skills/steve-designer/references/orchestration-map.md
git commit -m "docs(sheriff): re-tier arsenal + orchestration-map governance rows"
```

---

### Task 17: Register version bump + changelog

**Files:**
- Modify: `.claude-plugin/plugin.json`
- Modify: `.claude-plugin/marketplace.json`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Bump version + add keywords in plugin.json**

In `.claude-plugin/plugin.json`, change `"version": "0.1.0"` to `"version": "0.2.0"`, and add `"governance"`, `"enforcement"`, `"codex"` to the `keywords` array.

- [ ] **Step 2: Mirror in marketplace.json**

In `.claude-plugin/marketplace.json`, change both `"version": "0.1.0"` occurrences to `"0.2.0"`, and add the same three keywords to the plugin's `keywords` array.

- [ ] **Step 3: Add a CHANGELOG entry**

At the top of `CHANGELOG.md` (under any existing header), add:

```markdown
## 0.2.0 — 2026-06-23

### Added — Sheriff Mode (design-system enforcement)
- `/steve-designer:guard` — one-time setup: ingest the DS, generate `AGENTS.md`, install the hard gate (pre-commit + CI), configure ≤3 MCPs for Claude + Codex.
- `/steve-designer:patrol` — on-demand enforcement: mechanical `design-lint` + `design-enforcer` semantic review.
- `scripts/ingest_design_system.py` — auto-detects stack (shadcn / own-primitives / tailwind-css) and emits `design-system-manifest.json` (tokens, components+props, packages).
- `scripts/design_lint.mjs` — blocking linter: no hardcoded hex, no off-scale spacing, no unknown components.
- `agents/design-enforcer.md`, `hooks/design-lint-hook.sh`, and AGENTS.md / MCP / pre-commit / CI templates.
- Cross-tool: enforcement lives in git-level artifacts, so it holds in both Claude Code and Codex.
```

- [ ] **Step 4: Verify JSON still valid**

Run: `python3 -c "import json; json.load(open('.claude-plugin/plugin.json')); json.load(open('.claude-plugin/marketplace.json')); print('valid')"`
Expected: `valid`

- [ ] **Step 5: Commit**

```bash
git add .claude-plugin/plugin.json .claude-plugin/marketplace.json CHANGELOG.md
git commit -m "chore(sheriff): v0.2.0 — register Sheriff Mode"
```

---

### Task 18: Full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run both test suites**

Run:
```bash
python3 scripts/test_ingest.py && node --test scripts/design_lint.test.mjs scripts/design_lint.cli.test.mjs
```
Expected: ingest prints both `ok:` lines; node reports all 6 linter tests passing.

- [ ] **Step 2: End-to-end smoke on a fixture**

Run:
```bash
python3 scripts/ingest_design_system.py --root scripts/fixtures/repo_shadcn --out /tmp/m.json
node scripts/design_lint.mjs --manifest /tmp/m.json scripts/fixtures/lint_bad_hex.tsx; echo "exit=$?"
```
Expected: manifest written; lint prints a `no-hardcoded-hex` ERROR and `exit=1`.

- [ ] **Step 3: Confirm clean path**

Run:
```bash
node scripts/design_lint.mjs --manifest /tmp/m.json scripts/fixtures/lint_clean.tsx; echo "exit=$?"
```
Expected: `design-lint: 1 file(s) clean.` and `exit=0`.

- [ ] **Step 4: Final commit (if any verification fixes were needed)**

```bash
git add -A && git commit -m "test(sheriff): full-suite verification green" || echo "nothing to commit"
```

---

## Self-Review notes

- **Spec coverage:** INGEST → Tasks 1–2; CODIFY law → Tasks 7, 11; CODIFY gate → Tasks 3–6, 8; PATROL → Tasks 6 (mechanical), 12–13 (semantic); cross-tool/portable layer → Tasks 7–9, 11; Steve-in-dev-loop hook → Task 10; tool-bloat re-tier → Task 16; stack auto-detection → Task 1; docs/registration → Tasks 14–17. All spec success criteria map to Task 18 + 8 (CI) + 10 (hook silence).
- **Type consistency:** the manifest schema (top of plan) is used identically by `ingest_design_system.py` (producer), `design_lint.mjs` (`allowedHex`, `tokens.spacing`, `components[].name`), the fixture `manifest.json`, and the AGENTS.md/templates. Field names checked: `allowedHex`, `tokens.color`, `tokens.spacing`, `components[].name/import/props`, `packages`, `stack.type`.
- **Out of scope (per spec):** AST prop validation (only the semantic subagent checks invented props in v1), auto-fix, hosted registry, visual regression, the `// design-lint-allow` escape hatch (documented as future in Task 14).
