# Implementation Plan — Steve Designer v0.3 (UI owner)

**Spec:** `docs/superpowers/specs/2026-09-03-steve-ui-owner-design.md` (including **§13 Rulings do gate de design**, which prevails over earlier sections where they conflict).
**Date:** 2026-09-03 · **Author:** planner (Opus) · **Status:** ready for execution

---

## Goal

Turn steve-designer from a two-mode plugin (Creation + Sheriff) into the **owner of the UI design system** of any project that invokes it: three modes (Creation / Governance / Direction), eight commands, a canonical `docs/design/` folder, a v2 manifest, a new i18n lint rule, a single scope resolver for `check`, and a capabilities file any agent can read.

## Architecture

steve-designer is a Claude Code **plugin** — not an application. It has five kinds of artifact:

| Kind | Where | Runs how |
|---|---|---|
| Portable enforcement | `scripts/design_lint.mjs`, `scripts/ingest_design_system.py`, `scripts/init_project_brief.py`, `hooks/design-lint-hook.sh`, `templates/precommit-*`, `templates/ci-*` | Node 24 / Python 3, git-level, agent-agnostic |
| Prose brain | `skills/steve-designer/SKILL.md` + `references/*.md` | Read by Claude |
| Prose commands | `commands/*.md` (frontmatter `description` + body) | `/steve-designer:<name>` |
| Prose agents | `agents/*.md` (frontmatter `name` + `description`) | Task/subagent |
| Project templates | `skills/steve-designer/templates/*`, `templates/*` | Copied into user projects |

Only the first row is executable code. Everything else is prose contracts.

## Tech Stack

- **Node.js 24** — `design_lint.mjs` is a single ESM file with **zero dependencies** (it is *vendored into user repos* by `enforce`, so it must stay self-contained). Tests use `node:test`.
- **Python 3** — `ingest_design_system.py`, `init_project_brief.py`. Stdlib only. These always run from `${CLAUDE_PLUGIN_ROOT}` and are never vendored, so a shared sibling module is allowed.
- **Bash** — hooks + templates, shellcheck-clean at `severity: warning`.
- No `package.json` exists at the repo root and none is added.

**Canonical test commands (verified working on this repo, Node v24.18.0):**

```bash
node --test scripts/design_lint.test.mjs scripts/design_lint.cli.test.mjs   # 8 tests pass today
python3 scripts/test_ingest.py                                              # 5 tests pass today
bash -n hooks/design-lint-hook.sh && bash -n templates/precommit-design.template.sh
bash scripts/check_arsenal.sh   # exit 0/1/2 all acceptable; must not crash
```

> `node --test scripts/` (directory form) **fails** on Node 24 with `MODULE_NOT_FOUND`. Always pass the two test files explicitly.

## Global Constraints

1. **TDD is forbidden.** Order for every task with code: implement → extend the existing test file → run. Never write a test before the code it covers.
2. **No new test files.** Only `scripts/design_lint.test.mjs`, `scripts/design_lint.cli.test.mjs`, `scripts/test_ingest.py` may hold tests. New fixtures go in `scripts/fixtures/`.
3. **Tier per §11 + global testing policy:** scripts = Tier 1 (3–8 new cases per file); prose = Tier 0 (run the verification commands, no test files).
4. **Backwards compatibility is load-bearing.** v1 manifests, root-level `design-system-manifest.json`, root-level `design-brief.md`, and legacy `dsImportPrefixes`-free manifests must keep working.
5. **`design_lint.mjs` stays a single dependency-free file.** No imports beyond `node:fs`, `node:path`, `node:module`/`node:child_process`.
6. **No TBD, no placeholders, no `TODO`** in any produced artifact. A stub is a blocker, not progress.
7. **Ownership is disjoint by file.** No file appears in two slices. Do not touch a file you do not own; report the conflict instead.
8. **Nobody commits but the lead.** Slice workers do not run `git add` or `git commit`.

---

# Slice ownership (disjoint file sets)

| Slice | Owner | Files (exclusive) |
|---|---|---|
| **A — scripts** | Codex (MCP coder) | `scripts/design_lint.mjs`, `scripts/design_lint.test.mjs`, `scripts/design_lint.cli.test.mjs`, `scripts/ingest_design_system.py`, `scripts/test_ingest.py`, `scripts/init_project_brief.py`, `scripts/steve_paths.py` *(new)*, `scripts/fixtures/**`, `templates/design-system-manifest.template.json`, `hooks/design-lint-hook.sh`, `templates/precommit-design.template.sh`, `templates/ci-design-check.template.yml` |
| **B — agents + references** | sub-agent (opus) | `agents/tokens-engineer.md`, `agents/component-builder.md`, `agents/design-enforcer.md`, `agents/design-critic.md`, `skills/steve-designer/references/hard-won-rules.md` *(new)*, `skills/steve-designer/references/capabilities.md` *(new)*, `skills/steve-designer/references/anti-patterns.md` |
| **C — project templates** | sub-agent (sonnet) | `skills/steve-designer/templates/brief.template.md` *(renamed)*, `skills/steve-designer/templates/design-doc.template.md` *(new)*, `skills/steve-designer/templates/screens.template.md` *(new)*, `skills/steve-designer/templates/decisions.template.md` *(new)*, `skills/steve-designer/templates/handoff.template.md` *(renamed)*, `skills/steve-designer/templates/claude-md-snippet.template.md`, `templates/AGENTS.md.template.md`, `templates/mcp.json.template`, `templates/codex-config.toml.template` |
| **D — commands + brain** | sub-agent (opus) | `commands/start.md`, `commands/resume.md`, `commands/arsenal.md`, `commands/enforce.md` *(new)*, `commands/check.md` *(new)*, `commands/build.md` *(new)*, `commands/handoff.md` *(new)*, `commands/help.md` *(new)*, `commands/guard.md` *(rewritten as alias)*, `commands/patrol.md` *(rewritten as alias)*, `skills/steve-designer/SKILL.md`, `skills/steve-designer/references/governance-playbook.md`, `skills/steve-designer/references/orchestration-map.md`, `skills/steve-designer/references/phase-playbook.md`, `hooks/hooks.json` |
| **E — docs + version** | sub-agent (sonnet), last | `README.md`, `docs/HELP.md`, `docs/INSTALACAO.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `install.sh`, `.github/workflows/ci.yml` |

Files touched by nobody: `scripts/check_arsenal.sh`, `scripts/start_preview.sh`, `skills/steve-designer/references/{arsenal,awwwards-dna,app-references,when-to-resist-awwwards}.md`, `LICENSE`, `.github/ISSUE_TEMPLATE/**`, `.github/PULL_REQUEST_TEMPLATE.md`.

---

# SLICE A — scripts (Codex)

## Task A1 — Single path resolver for manifest and brief (§13.1)

**Files**
- Create: `scripts/steve_paths.py`
- Modify: `scripts/design_lint.mjs`, `scripts/ingest_design_system.py`, `scripts/init_project_brief.py`

**Interfaces**
- Produces (JS, exported from `design_lint.mjs`): `MANIFEST_NEW`, `MANIFEST_LEGACY`, `resolveArtifactPath({explicit, newPath, legacyPath, root, kind}) -> string`, `resolveManifestPath(explicit, root) -> string`, `class SteveError extends Error`.
- Produces (Python, `steve_paths.py`): `MANIFEST_NEW`, `MANIFEST_LEGACY`, `BRIEF_NEW`, `BRIEF_LEGACY`, `class StevePathError(Exception)`, `resolve_artifact_path(explicit, new_path, legacy_path, root=".", kind="manifest") -> str`, `resolve_manifest_path(explicit, root=".")`, `resolve_brief_path(explicit, root=".")`.
- Consumes: nothing new.

Resolution order, identical in both languages: **explicit flag → `docs/design/<new>` if it exists → legacy root path if it exists → `docs/design/<new>` as the creation target.** If **both** exist, raise/throw naming both paths. Never choose silently.

**Steps**

- [ ] Add to `scripts/design_lint.mjs`, right after the existing `const HEX_RE = ...` line:

```js
import path from "node:path";

export const MANIFEST_NEW = "docs/design/manifest.json";
export const MANIFEST_LEGACY = "design-system-manifest.json";

export class SteveError extends Error {}

// Single resolution order for every reader/writer (spec §13.1):
//   explicit flag → docs/design/<new> if present → legacy root path if present
//   → docs/design/<new> as the creation target.
// Both present is an unresolvable ambiguity: fail loudly, never guess.
export function resolveArtifactPath({ explicit, newPath, legacyPath, root = ".", kind = "manifest" }) {
  if (explicit) return path.resolve(root, explicit);
  const modern = path.resolve(root, newPath);
  const legacy = path.resolve(root, legacyPath);
  const hasModern = fs.existsSync(modern);
  const hasLegacy = fs.existsSync(legacy);
  if (hasModern && hasLegacy) {
    throw new SteveError(
      `Two ${kind} files exist: "${newPath}" and "${legacyPath}". ` +
      `Steve will not guess which one is authoritative. Delete or merge one, ` +
      `or pass an explicit path.`
    );
  }
  if (hasModern) return modern;
  if (hasLegacy) return legacy;
  return modern;
}

export function resolveManifestPath(explicit, root = ".") {
  return resolveArtifactPath({
    explicit, newPath: MANIFEST_NEW, legacyPath: MANIFEST_LEGACY, root, kind: "manifest",
  });
}
```

- [ ] In `parseArgs`, change the default from a literal path to `null` so resolution happens later:

```js
function parseArgs(argv) {
  const args = { manifest: null, files: [], changed: false, commit: null, range: null, pr: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--manifest") args.manifest = argv[++i];
    else if (a === "--changed") args.changed = true;
    else if (a === "--commit") args.commit = argv[++i];
    else if (a === "--range") args.range = argv[++i];
    else if (a === "--pr") args.pr = argv[++i];
    else args.files.push(a);
  }
  return args;
}
```

- [ ] Create `scripts/steve_paths.py` with the Python mirror:

```python
#!/usr/bin/env python3
"""steve_paths.py — one resolution order for the manifest and the brief.

Order (spec §13.1): explicit flag → docs/design/<new> if present → legacy root
path if present → docs/design/<new> as the creation target. Both present is an
unresolvable ambiguity: raise, never guess.

Imported by ingest_design_system.py and init_project_brief.py, which always run
from the plugin root (never vendored into user repos), so a sibling import is safe.
"""
import os

MANIFEST_NEW = os.path.join("docs", "design", "manifest.json")
MANIFEST_LEGACY = "design-system-manifest.json"
BRIEF_NEW = os.path.join("docs", "design", "brief.md")
BRIEF_LEGACY = "design-brief.md"


class StevePathError(Exception):
    """Raised when two candidate paths exist and neither can be preferred."""


def resolve_artifact_path(explicit, new_path, legacy_path, root=".", kind="manifest"):
    if explicit:
        return os.path.abspath(os.path.join(root, explicit))
    modern = os.path.abspath(os.path.join(root, new_path))
    legacy = os.path.abspath(os.path.join(root, legacy_path))
    has_modern = os.path.exists(modern)
    has_legacy = os.path.exists(legacy)
    if has_modern and has_legacy:
        raise StevePathError(
            f'Two {kind} files exist: "{new_path}" and "{legacy_path}". '
            f"Steve will not guess which one is authoritative. Delete or merge one, "
            f"or pass an explicit path."
        )
    if has_modern:
        return modern
    if has_legacy:
        return legacy
    return modern


def resolve_manifest_path(explicit=None, root="."):
    return resolve_artifact_path(explicit, MANIFEST_NEW, MANIFEST_LEGACY, root, "manifest")


def resolve_brief_path(explicit=None, root="."):
    return resolve_artifact_path(explicit, BRIEF_NEW, BRIEF_LEGACY, root, "design brief")


def ensure_parent_dir(path):
    parent = os.path.dirname(os.path.abspath(path))
    if parent:
        os.makedirs(parent, exist_ok=True)
    return path
```

- [ ] In `scripts/ingest_design_system.py`: add `from steve_paths import resolve_manifest_path, ensure_parent_dir, StevePathError` to the imports, add `--manifest` as an alias of `--out`, and replace the whole `main()` body's output handling:

```python
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--stdout", action="store_true")
    ap.add_argument("--out")
    ap.add_argument("--manifest", help="alias of --out; the manifest path to write")
    args = ap.parse_args()
    if not os.path.isdir(args.root):
        print(f"root not found: {args.root}", file=sys.stderr)
        return 1
    explicit = args.out or args.manifest
    manifest = build_manifest(args.root)
    text = json.dumps(manifest, indent=2)
    if explicit or not args.stdout:
        try:
            out_path = resolve_manifest_path(explicit, args.root)
        except StevePathError as exc:
            print(f"ingest: {exc}", file=sys.stderr)
            return 1
        ensure_parent_dir(out_path)
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(text + "\n")
        print(f"wrote {out_path}", file=sys.stderr)
    if args.stdout:
        print(text)
    return 0
```

- [ ] In `scripts/init_project_brief.py`: import `resolve_brief_path`, `ensure_parent_dir`, `StevePathError`; replace the hard-coded `brief_path = project_root / "design-brief.md"` with the resolver; and fix `find_template()` — the template is renamed by Slice C, so both names must be accepted:

```python
    candidates = [
        script_dir.parent / "skills" / "steve-designer" / "templates" / "brief.template.md",
        script_dir.parent / "skills" / "steve-designer" / "templates" / "design-brief.template.md",
        script_dir / "templates" / "brief.template.md",
        script_dir.parent / "templates" / "brief.template.md",
    ]
```

```python
    try:
        brief_path = Path(resolve_brief_path(None, str(project_root)))
    except StevePathError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
    if brief_path.exists() and not args.force:
        print(f"brief already exists at {brief_path}.")
        print("Use --force to overwrite, or run /steve-designer:resume instead.")
        sys.exit(1)
    ensure_parent_dir(str(brief_path))
```

**Verification (Tier 1 — covered by tests in A6/A7).**

---

## Task A2 — Manifest v2 normalization (§5, §13.2)

**Files**
- Modify: `scripts/design_lint.mjs`, `scripts/ingest_design_system.py`, `templates/design-system-manifest.template.json`

**Interfaces**
- Produces (JS): `colorValue(entry) -> string|undefined`, `colorRole(entry) -> string|null`, `TOKEN_ROLES` (array), `allowedHexSet(manifest) -> Set<string>`.
- Produces (Python): `color_value(entry) -> str`, `derive_allowed_hex(tokens) -> list[str]`.
- Consumes: `manifest.tokens.color` (string **or** `{value, role}`), `manifest.tokens.feedback[*]`.

**Steps**

- [ ] Add to `scripts/design_lint.mjs` (before `ruleNoHardcodedHex`):

```js
export const TOKEN_ROLES = ["background", "surface", "text", "accent", "border", "ring", "brand"];

// v1: "bg-base": "#080b12".  v2: "bg-base": { value: "#080b12", role: "background" }.
export function colorValue(entry) {
  if (entry && typeof entry === "object" && !Array.isArray(entry)) return entry.value;
  return entry;
}

export function colorRole(entry) {
  if (entry && typeof entry === "object" && typeof entry.role === "string") return entry.role;
  return null;
}

// allowedHex is authoritative when present, but a hand-edited v2 manifest may
// carry colors the ingester never saw. Union both so a token color is never
// flagged as hardcoded just because allowedHex is stale.
export function allowedHexSet(manifest) {
  const out = new Set((manifest.allowedHex || []).map(h => h.toLowerCase()));
  const add = (v) => {
    if (typeof v !== "string") return;
    for (const m of v.matchAll(HEX_RE)) out.add(m[0].toLowerCase());
  };
  for (const entry of Object.values(manifest.tokens?.color || {})) add(colorValue(entry));
  for (const group of Object.values(manifest.tokens?.feedback || {})) {
    if (group && typeof group === "object") for (const v of Object.values(group)) add(v);
    else add(group);
  }
  return out;
}
```

- [ ] Replace the first line of `ruleNoHardcodedHex` so it uses the union:

```js
function ruleNoHardcodedHex(file, src, manifest) {
  const allowed = allowedHexSet(manifest);
  // ...rest unchanged
```

- [ ] In `scripts/ingest_design_system.py`, add next to `HEX_RE`:

```python
def color_value(entry):
    """v1 colors are strings; v2 colors are {"value": ..., "role": ...}."""
    if isinstance(entry, dict):
        return str(entry.get("value", ""))
    return str(entry or "")


def derive_allowed_hex(tokens):
    """Every hex the system owns: core colors plus every feedback slot (§13.2)."""
    values = [color_value(e) for e in tokens.get("color", {}).values()]
    for group in tokens.get("feedback", {}).values():
        if isinstance(group, dict):
            values.extend(str(v) for v in group.values())
        else:
            values.append(str(group))
    return sorted({h.lower() for v in values for h in HEX_RE.findall(v)})
```

- [ ] In `build_manifest`, replace the `allowed = sorted({...})` line with `allowed = derive_allowed_hex(tokens)` and emit `schemaVersion` first in the returned dict:

```python
    return {
        "schemaVersion": 2,
        "generatedAt": "GENERATED",
        "stack": detect_stack(root, packages, tokens, components),
        "tokens": tokens,
        "components": components,
        "i18n": detect_i18n(root, config),
        "voice": (config or {}).get("voice", {}),
        "dsImportPrefixes": ds_prefixes,
        "packages": packages,
        "allowedHex": allowed,
    }
```

- [ ] Rewrite `templates/design-system-manifest.template.json` to the v2 shape while keeping `generatedAt`/`stack` (the spec's §5 snippet drops them; the detector and the governance playbook both rely on them — keep them):

```json
{
  "schemaVersion": 2,
  "generatedAt": "2026-09-03T00:00:00Z",
  "stack": { "type": "shadcn|tailwind-css|token-css|own-primitives|css-modules", "framework": "next|vite|astro|unknown", "tailwind": true },
  "tokens": {
    "color":       { "bg-base": { "value": "#080b12", "role": "background" }, "accent": { "value": "#3b82f6", "role": "accent" } },
    "feedback":    { "success": { "solid": "#10b981", "fg": "#34d399", "subtle": "rgba(16,185,129,.12)" } },
    "typography":  { "h1": { "size": "2.5rem", "lineHeight": "1.1", "weight": "700", "tracking": "-0.02em", "family": "sans" } },
    "spacing":     { "1": "4px", "2": "8px" },
    "radius":      { "sm": "4px" },
    "shadow":      { "sm": "0 1px 2px rgba(0,0,0,.06)" },
    "motion":      { "fast": "120ms" },
    "zIndex":      { "dropdown": 100, "modal": 1000, "dropdown-in-modal": 1050, "toast": 1100 },
    "breakpoints": { "sm": "480px", "md": "768px", "lg": "1024px", "xl": "1280px" }
  },
  "components": [
    { "name": "Button", "import": "@/components/ui/button", "props": ["variant", "size", "asChild"],
      "states": ["default", "hover", "focus", "disabled", "loading"], "a11y": ["aria-busy", "hit>=44px"] }
  ],
  "i18n": { "enabled": false, "keyPattern": "<area>.<screen>.<element>", "source": "src/lib/i18n/pt-BR.json" },
  "voice": { "tone": "", "locale": "" },
  "dsImportPrefixes": ["*/components/ui/*", "@scope/ui", "@scope/ui/*"],
  "packages": { "next": "15.0.0", "tailwindcss": "4.0.0" },
  "allowedHex": ["#080b12", "#3b82f6", "#10b981", "#34d399"]
}
```

Roles are `background | surface | text | accent | border | ring | brand`. Validation of `role` happens **only when the key is present** — a v1 manifest never fails on it.

---

## Task A3 — Ingest: feedback, typography, zIndex, breakpoints, i18n, voice, component states (§5)

**Files**
- Modify: `scripts/ingest_design_system.py`
- Create: `scripts/fixtures/repo_v2_tokens/globals.css`, `scripts/fixtures/repo_v2_tokens/package.json`, `scripts/fixtures/repo_v2_tokens/steve.config.json`

**Interfaces**
- Produces: `classify_token(name) -> (bucket, key, slot)` *(signature changes — 3-tuple)*, `detect_i18n(root, config) -> dict`, `TYPO_ATTRS`, `FEEDBACK_KEYS`.
- Consumes: `steve.config.json` keys `i18n`, `voice`, `components`.

**Steps**

- [ ] Replace `classify_token` and `detect_tokens` wholesale:

```python
FEEDBACK_KEYS = {"success": "success", "warning": "warning", "danger": "danger",
                 "error": "danger", "info": "info"}
FEEDBACK_SLOTS = {"": "solid", "fg": "fg", "subtle": "subtle"}
# Longest-suffix-first so "line-height" wins over "height" style prefixes.
TYPO_ATTRS = [("letter-spacing", "tracking"), ("line-height", "lineHeight"),
              ("tracking", "tracking"), ("leading", "lineHeight"), ("weight", "weight"),
              ("family", "family"), ("size", "size"), ("lh", "lineHeight")]


def _classify_feedback(name):
    """--success / --color-danger-fg / --warning-subtle → (key, slot) or None."""
    base = name[len("color-"):] if name.startswith("color-") else name
    for suffix, slot in (("-fg", "fg"), ("-subtle", "subtle")):
        if base.endswith(suffix):
            key = FEEDBACK_KEYS.get(base[: -len(suffix)])
            return (key, slot) if key else None
    key = FEEDBACK_KEYS.get(base)
    return (key, "solid") if key else None


def _classify_typography(name):
    """--text-h1 / --text-h1-line-height / --font-sans → (role, attr) or None."""
    for prefix, default_attr in (("text-", "size"), ("font-", "family")):
        if not name.startswith(prefix):
            continue
        rest = name[len(prefix):]
        if not rest:
            return None
        for suffix, attr in TYPO_ATTRS:
            if rest.endswith("-" + suffix):
                role = rest[: -(len(suffix) + 1)]
                return (role, attr) if role else None
        return (rest, default_attr)
    return None


def classify_token(name):
    """Return (bucket, key, slot). slot is only used by feedback/typography."""
    fb = _classify_feedback(name)
    if fb:
        return ("feedback", fb[0], fb[1])
    typo = _classify_typography(name)
    if typo:
        return ("typography", typo[0], typo[1])
    if name.startswith("z-"):
        return ("zIndex", name[2:], None)
    if name.startswith("breakpoint-"):
        return ("breakpoints", name[len("breakpoint-"):], None)
    if name.startswith("bp-"):
        return ("breakpoints", name[3:], None)
    if name.startswith("color-"):
        return ("color", name[len("color-"):], None)
    if name.startswith("color"):
        return ("color", name, None)
    if name.startswith("space-") or name.startswith("spacing-"):
        return ("spacing", name.split("-", 1)[1], None)
    if name.startswith("radius-"):
        return ("radius", name.split("-", 1)[1], None)
    if name.startswith("shadow-"):
        return ("shadow", name.split("-", 1)[1], None)
    if name.startswith("motion-") or name.startswith("duration-") or name.startswith("ease-"):
        return ("motion", name.split("-", 1)[1], None)
    return (None, name, None)


def _coerce_z(value):
    v = value.strip()
    return int(v) if v.lstrip("-").isdigit() else v


def detect_tokens(root):
    tokens = {"color": {}, "feedback": {}, "typography": {}, "spacing": {},
              "radius": {}, "shadow": {}, "motion": {}, "zIndex": {}, "breakpoints": {}}
    for css in find_files(root, ["*.css"]):
        for name, value in CSS_VAR_RE.findall(read(css)):
            bucket, key, slot = classify_token(name.lower())
            if not bucket:
                continue
            value = value.strip()
            if bucket in ("feedback", "typography"):
                tokens[bucket].setdefault(key, {})[slot] = value
            elif bucket == "zIndex":
                tokens[bucket][key] = _coerce_z(value)
            else:
                tokens[bucket][key] = value
    return tokens
```

- [ ] Add i18n detection (dependency or config; config wins):

```python
I18N_PACKAGES = ("next-intl", "i18next", "react-i18next", "@lingui/core", "@lingui/react", "lingui")
DEFAULT_KEY_PATTERN = "<area>.<screen>.<element>"


def detect_i18n(root, config):
    """Config wins; otherwise a known i18n dependency enables the rule."""
    cfg = (config or {}).get("i18n")
    if isinstance(cfg, dict):
        return {"enabled": bool(cfg.get("enabled", True)),
                "keyPattern": cfg.get("keyPattern", DEFAULT_KEY_PATTERN),
                "source": cfg.get("source", "")}
    packages = detect_packages(root)
    enabled = any(p in packages for p in I18N_PACKAGES)
    return {"enabled": enabled, "keyPattern": DEFAULT_KEY_PATTERN, "source": ""}
```

- [ ] Merge `states` / `a11y` from config into detected components — the detector never infers them (§5). Add at the end of `detect_components`, just before `return comps, prefixes`:

```python
    overrides = (config or {}).get("components") or {}
    for comp in comps:
        extra = overrides.get(comp["name"]) or {}
        if extra.get("states"):
            comp["states"] = list(extra["states"])
        if extra.get("a11y"):
            comp["a11y"] = list(extra["a11y"])
```

- [ ] Create `scripts/fixtures/repo_v2_tokens/globals.css`:

```css
:root {
  --color-bg-base: #080b12;
  --color-accent: #3b82f6;
  --success: #10b981;
  --success-fg: #34d399;
  --success-subtle: rgba(16,185,129,.12);
  --color-error: #ef4444;
  --text-h1: 2.5rem;
  --text-h1-line-height: 1.1;
  --text-h1-weight: 700;
  --font-sans: "Inter", system-ui, sans-serif;
  --z-modal: 1000;
  --z-dropdown-in-modal: 1050;
  --bp-md: 768px;
  --breakpoint-xl: 1280px;
  --space-1: 4px;
}
```

- [ ] Create `scripts/fixtures/repo_v2_tokens/package.json`:

```json
{ "name": "fx-v2-tokens", "dependencies": { "next": "15.0.0", "next-intl": "3.0.0" } }
```

- [ ] Create `scripts/fixtures/repo_v2_tokens/steve.config.json`:

```json
{
  "voice": { "tone": "executivo e calmo, sentence case, sem exclamação", "locale": "pt-BR" }
}
```

---

## Task A4 — Lint rule `no-literal-jsx-string` via lexer (§6, §13.3)

**Files**
- Modify: `scripts/design_lint.mjs`
- Create: `scripts/fixtures/manifest_v2.json`, `scripts/fixtures/manifest_v2_no_i18n.json`, `scripts/fixtures/lint_v2_colors.tsx`, `scripts/fixtures/lint_literal_text.tsx`, `scripts/fixtures/lint_literal_clean.tsx`, `scripts/fixtures/lint_literal_skipme.test.tsx`

**Interfaces**
- Produces: `maskNonCode(src) -> {masked, ok}`, `scanJsxLiterals(src) -> Array<{index, text, kind}> | null`, `ruleNoLiteralJsxString(file, src, manifest) -> violations[]`.
- Consumes: `manifest.i18n.enabled`, `manifest.i18n.keyPattern`.

**Contract (§13.3):** no regex over raw source. Mask comments/strings/templates, track JSX element depth and `{}` depth, then inspect JSX body text and the attributes `placeholder|title|aria-label|alt`. **Ambiguity is never reported** — an unterminated string (e.g. an apostrophe inside JSX text like `Don't`) or an unterminated tag makes the whole file a no-op. A false negative is always preferred over a wrong block. Skips `*.test.*`, `*.spec.*`, `*.stories.*`.

**Steps**

- [ ] Add to `scripts/design_lint.mjs` after the component rule:

```js
const I18N_ATTRS = "placeholder|title|aria-label|alt";
const ATTR_RE = new RegExp(`\\b(${I18N_ATTRS})\\s*=\\s*(["'])((?:\\\\.|[^\\\\])*?)\\2`, "g");
const HAS_WORD_RE = /\p{L}{2,}/u;
const SKIP_FILE_RE = /\.(test|spec|stories)\.[jt]sx?$/;

// Blank out comments, string literals and template literals in place (same
// length, newlines preserved) so later scanning only ever sees code. Returns
// ok:false when a string never closes — the caller then skips the file rather
// than risk a desynced scan (§13.3: ambiguity is not reported).
export function maskNonCode(src) {
  const out = src.split("");
  const blank = (i) => { if (out[i] !== "\n") out[i] = " "; };
  let i = 0;
  const n = src.length;
  let ok = true;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { while (i < n && src[i] !== "\n") blank(i++); continue; }
    if (c === "/" && d === "*") {
      blank(i++); blank(i++);
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) blank(i++);
      if (i < n) { blank(i++); blank(i++); } else ok = false;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      blank(i++);
      let closed = false;
      while (i < n) {
        if (src[i] === "\\") { blank(i++); if (i < n) blank(i++); continue; }
        if (src[i] === quote) { blank(i++); closed = true; break; }
        if (src[i] === "\n" && quote !== "`") break;   // unterminated single-line string
        blank(i++);
      }
      if (!closed) { ok = false; break; }
      continue;
    }
    i++;
  }
  return { masked: out.join(""), ok };
}

function pushText(findings, src, from, to) {
  const raw = src.slice(from, to);
  const text = raw.trim();
  if (!text || !HAS_WORD_RE.test(text)) return;         // punctuation/numbers only
  findings.push({ index: from + (raw.length - raw.trimStart().length), text, kind: "text" });
}

function attrFindings(src, masked, tagFrom, tagTo) {
  const found = [];
  const slice = src.slice(tagFrom, tagTo);
  ATTR_RE.lastIndex = 0;
  for (const m of slice.matchAll(ATTR_RE)) {
    const at = tagFrom + m.index;
    if (masked[at] === " ") continue;                   // the attr name itself was quoted → not code
    const value = m[3];
    if (!HAS_WORD_RE.test(value)) continue;
    found.push({ index: at, text: `${m[1]}="${value}"`, kind: "attr" });
  }
  return found;
}

// Walk the masked source tracking JSX element depth. Returns null when the file
// cannot be scanned safely.
export function scanJsxLiterals(src) {
  const { masked, ok } = maskNonCode(src);
  if (!ok) return null;
  const findings = [];
  const n = masked.length;
  let i = 0, depth = 0;
  while (i < n) {
    if (masked[i] !== "<") { i++; continue; }
    const next = masked[i + 1];
    if (!next || !/[A-Za-z_$>/]/.test(next)) { i++; continue; }
    const closing = next === "/";
    let j = i + 1, brace = 0;
    while (j < n) {
      const ch = masked[j];
      if (ch === "{") brace++;
      else if (ch === "}") brace--;
      else if (ch === ">" && brace <= 0) break;
      j++;
    }
    if (j >= n) return null;                            // unterminated tag → skip file
    const selfClosing = masked[j - 1] === "/";
    if (!closing) findings.push(...attrFindings(src, masked, i, j));
    if (closing) depth = Math.max(0, depth - 1);
    else if (!selfClosing) depth += 1;
    i = j + 1;
    if (depth === 0) continue;
    // Children region: text runs at brace depth 0, up to the next tag.
    let k = i, brace2 = 0, runStart = i;
    while (k < n) {
      const ch = masked[k];
      if (ch === "{") { if (brace2 === 0) pushText(findings, src, runStart, k); brace2++; }
      else if (ch === "}") { brace2 = Math.max(0, brace2 - 1); if (brace2 === 0) runStart = k + 1; }
      else if (ch === "<" && brace2 === 0) break;
      k++;
    }
    if (brace2 === 0) pushText(findings, src, runStart, k);
    i = k;
  }
  return findings;
}

function lineOf(src, index) {
  let line = 1;
  for (let i = 0; i < index && i < src.length; i++) if (src[i] === "\n") line++;
  return line;
}

function ruleNoLiteralJsxString(file, src, manifest) {
  if (manifest.i18n?.enabled !== true) return [];
  if (SKIP_FILE_RE.test(file)) return [];
  const found = scanJsxLiterals(src);
  if (found === null) return [];                        // ambiguous file → conservative no-op
  const pattern = manifest.i18n.keyPattern || "<area>.<screen>.<element>";
  return found.map(f => ({
    rule: "no-literal-jsx-string", file, line: lineOf(src, f.index), severity: "error",
    message: `Literal UI text ${JSON.stringify(f.text.slice(0, 60))} — use an i18n key ` +
             `(${pattern}), e.g. {t("...")}.`,
  }));
}
```

- [ ] Register the rule in `lintFiles`:

```js
    violations.push(...ruleNoUnknownComponent(file, src, manifest));
    violations.push(...ruleNoLiteralJsxString(file, src, manifest));
```

- [ ] Create `scripts/fixtures/manifest_v2.json`:

```json
{
  "schemaVersion": 2,
  "stack": { "type": "shadcn", "tailwind": true },
  "tokens": {
    "color": { "bg-base": { "value": "#080b12", "role": "background" }, "accent": "#3b82f6" },
    "feedback": { "success": { "solid": "#10b981", "fg": "#34d399" } },
    "spacing": { "1": "4px", "2": "8px" },
    "radius": {}, "shadow": {}, "motion": {},
    "zIndex": { "modal": 1000 }, "breakpoints": { "md": "768px" }
  },
  "components": [{ "name": "Button", "import": "@/components/ui/button", "props": ["variant"] }],
  "i18n": { "enabled": true, "keyPattern": "<area>.<screen>.<element>", "source": "src/i18n/pt-BR.json" },
  "packages": {},
  "allowedHex": []
}
```

- [ ] Create `scripts/fixtures/manifest_v2_no_i18n.json` — byte-identical to the above except `"i18n": { "enabled": false, "keyPattern": "<area>.<screen>.<element>", "source": "" }`.

- [ ] Create `scripts/fixtures/lint_v2_colors.tsx` (uses a v2 color value and a feedback hex; must be clean under `manifest_v2.json`):

```tsx
export const Swatches = () => (
  <div style={{ background: "#080b12", borderColor: "#34d399" }} />
);
```

- [ ] Create `scripts/fixtures/lint_literal_text.tsx` (three findings: body text, `placeholder`, `aria-label`):

```tsx
import { Button } from "@/components/ui/button";

export function Panel({ t }: { t: (k: string) => string }) {
  const label = "not jsx text, just a variable";
  return (
    <section>
      <h1>Painel de controle</h1>
      <input placeholder="Digite o nome" />
      <Button aria-label="Fechar painel" variant="ghost" />
      <span>{t("panel.footer.note")}</span>
      <span>—</span>
      <span>{label}</span>
    </section>
  );
}
```

- [ ] Create `scripts/fixtures/lint_literal_clean.tsx` (zero findings even with i18n on):

```tsx
export function Clean({ t }: { t: (k: string) => string }) {
  return (
    <section>
      <h1>{t("clean.title")}</h1>
      <input placeholder={t("clean.name.placeholder")} />
      <span>42</span>
      <span>·</span>
    </section>
  );
}
```

- [ ] Create `scripts/fixtures/lint_literal_skipme.test.tsx` — same content as `lint_literal_text.tsx`, used only to prove the `*.test.*` exclusion.

---

## Task A5 — `resolveScope` for `check` scopes (§3, §13.4, §13.5)

**Files**
- Modify: `scripts/design_lint.mjs`

**Interfaces**
- Produces: `resolveScope({changed, commit, range, pr, cwd}) -> {mode, base, head, files, diff, readAt(file)}`, `class ScopeError extends SteveError`.
- Consumes: `git`, and `gh` only for `--pr`.

**Contract:** the four flags are mutually exclusive. Any git/`gh` failure, invalid revision, missing `gh`, or `HEAD !== headRefOid` is **fail-closed** — a non-zero exit, never a "clean" report. Files are filtered with `--diff-filter=ACMR` and to `.tsx|.jsx|.css`. The same `{files, diff}` is what `check` hands to `design-enforcer` and `design-critic`.

**Steps**

- [ ] Replace the existing `changedFiles()` function with the resolver:

```js
const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
const UI_FILE_RE = /\.(tsx|jsx|css)$/;

export class ScopeError extends SteveError {}

function git(args, cwd) {
  const { execFileSync } = require("node:child_process");
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    throw new ScopeError(`git ${args.join(" ")} failed: ${(e.stderr || e.message).toString().trim()}`);
  }
}

function lines(out) {
  return out.split("\n").map(s => s.trim()).filter(Boolean);
}

function verifyRev(rev, cwd) {
  const out = git(["rev-parse", "--verify", "--quiet", `${rev}^{commit}`], cwd).trim();
  if (!out) throw new ScopeError(`Not a valid commit: "${rev}".`);
  return out;
}

function ghPr(number, cwd) {
  const { execFileSync } = require("node:child_process");
  let raw;
  try {
    raw = execFileSync("gh", ["pr", "view", String(number), "--json", "baseRefOid,headRefOid,number"],
      { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    throw new ScopeError(
      `gh pr view ${number} failed — install and authenticate the GitHub CLI ` +
      `(gh auth login). Original error: ${(e.stderr || e.message).toString().trim()}`);
  }
  const data = JSON.parse(raw);
  if (!data.baseRefOid || !data.headRefOid) throw new ScopeError(`PR #${number} has no base/head oid.`);
  return data;
}

export function resolveScope(opts = {}) {
  const cwd = opts.cwd || process.cwd();
  const picked = ["changed", "commit", "range", "pr"].filter(k => opts[k]);
  if (picked.length > 1) {
    throw new ScopeError(`--${picked.join(" and --")} are mutually exclusive. Pick one scope.`);
  }
  const mode = picked[0] || "changed";
  const filterUi = (fs_) => fs_.filter(f => UI_FILE_RE.test(f));

  if (mode === "changed") {
    const staged = lines(git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"], cwd));
    const unstaged = lines(git(["diff", "--name-only", "--diff-filter=ACMR"], cwd));
    const untracked = lines(git(["ls-files", "--others", "--exclude-standard"], cwd));
    const files = filterUi([...new Set([...staged, ...unstaged, ...untracked])])
      .filter(f => fs.existsSync(path.resolve(cwd, f)));
    const diff = files.length ? git(["diff", "HEAD", "--", ...files], cwd) : "";
    return { mode, base: "HEAD", head: null, files, diff, readAt: (f) => fs.readFileSync(path.resolve(cwd, f), "utf8") };
  }

  if (mode === "commit") {
    const head = verifyRev(opts.commit, cwd);
    const parents = lines(git(["rev-list", "--parents", "-n", "1", head], cwd)[0] ? git(["rev-list", "--parents", "-n", "1", head], cwd).trim().split(" ").slice(1).join("\n") : "");
    const base = parents[0] || EMPTY_TREE;   // root commit → empty tree
    const files = filterUi(lines(git(["diff", "--name-only", "--diff-filter=ACMR", base, head], cwd)));
    const diff = files.length ? git(["diff", base, head, "--", ...files], cwd) : "";
    return { mode, base, head, files, diff, readAt: (f) => git(["show", `${head}:${f}`], cwd) };
  }

  if (mode === "range") {
    if (!String(opts.range).includes("..")) {
      throw new ScopeError(`--range expects "<a>..<b>", got "${opts.range}".`);
    }
    const [a, b] = String(opts.range).split("..");
    const base = verifyRev(a, cwd);
    const head = verifyRev(b, cwd);
    const files = filterUi(lines(git(["diff", "--name-only", "--diff-filter=ACMR", `${base}..${head}`], cwd)));
    const diff = files.length ? git(["diff", `${base}..${head}`, "--", ...files], cwd) : "";
    return { mode, base, head, files, diff, readAt: (f) => git(["show", `${head}:${f}`], cwd) };
  }

  // mode === "pr"
  const pr = ghPr(opts.pr, cwd);
  const localHead = git(["rev-parse", "HEAD"], cwd).trim();
  if (localHead !== pr.headRefOid) {
    throw new ScopeError(
      `HEAD (${localHead.slice(0, 8)}) is not the head of PR #${pr.number} (${pr.headRefOid.slice(0, 8)}). ` +
      `Steve will not check out for you. Run: git fetch origin ${pr.headRefOid} && git checkout ${pr.headRefOid}`);
  }
  const base = pr.baseRefOid, head = pr.headRefOid;
  const files = filterUi(lines(git(["diff", "--name-only", "--diff-filter=ACMR", `${base}..${head}`], cwd)));
  const diff = files.length ? git(["diff", `${base}..${head}`, "--", ...files], cwd) : "";
  return { mode, base, head, files, diff, readAt: (f) => git(["show", `${head}:${f}`], cwd) };
}
```

> Simplify the `commit` branch's parent lookup to a single call — write it as:
> ```js
>     const parentOut = git(["rev-list", "--parents", "-n", "1", head], cwd).trim().split(/\s+/);
>     const base = parentOut[1] || EMPTY_TREE;   // root commit → empty tree
> ```

- [ ] Teach `lintFiles` to read through a scope when one is given:

```js
export function lintFiles(files, manifestPath, readAt) {
  const manifest = loadManifest(manifestPath);
  const read = readAt || ((f) => fs.readFileSync(f, "utf8"));
  const violations = [];
  for (const file of files) {
    const src = read(file);
    violations.push(...ruleNoHardcodedHex(file, src, manifest));
    violations.push(...ruleNoOffScaleSpacing(file, src, manifest));
    violations.push(...ruleNoUnknownComponent(file, src, manifest));
    violations.push(...ruleNoLiteralJsxString(file, src, manifest));
  }
  return violations;
}
```

- [ ] Replace the CLI main block so path/scope errors exit non-zero with a diagnostic (fail closed) instead of printing "clean":

```js
if (isMain()) {
  const args = parseArgs(process.argv.slice(2));
  const scoped = args.changed || args.commit || args.range || args.pr;
  let manifestPath, files, readAt;
  try {
    manifestPath = resolveManifestPath(args.manifest);
    if (scoped) {
      const scope = resolveScope(args);
      files = scope.files;
      readAt = scope.readAt;
    } else {
      files = args.files;
    }
  } catch (e) {
    if (e instanceof SteveError) { console.error(`design-lint: ${e.message}`); process.exit(2); }
    throw e;
  }
  if (!fs.existsSync(manifestPath)) {
    console.error(`design-lint: no manifest at ${manifestPath} — run /steve-designer:enforce first.`);
    process.exit(2);
  }
  if (files.length === 0) {
    console.log(`design-lint: no UI files to check in scope — clean.`);
    process.exit(0);
  }
  const violations = lintFiles(files, manifestPath, readAt);
  if (violations.length === 0) { console.log(`design-lint: ${files.length} file(s) clean.`); process.exit(0); }
  for (const v of violations) {
    console.error(`${v.severity.toUpperCase()} ${v.file}:${v.line} [${v.rule}] ${v.message}`);
  }
  console.error(`\ndesign-lint: ${violations.length} violation(s). Build blocked.`);
  process.exit(1);
}
```

Exit codes: `0` clean · `1` violations · `2` configuration/scope error (fail closed).

---

## Task A6 — Extend `design_lint.test.mjs` (Tier 1, 8 new cases)

**Files**
- Modify: `scripts/design_lint.test.mjs`

**Interfaces**
- Consumes: `lintFiles`, `maskNonCode`, `scanJsxLiterals`, `resolveManifestPath`, `SteveError` from `./design_lint.mjs`.

**Steps**

- [ ] Extend the import line to `import { lintFiles, maskNonCode, scanJsxLiterals, resolveManifestPath, SteveError } from "./design_lint.mjs";` and add `import fs from "node:fs"; import os from "node:os"; import path from "node:path";` plus the new fixture constants (`MANIFEST_V2`, `MANIFEST_V2_NO_I18N`, `v2Colors`, `literalText`, `literalClean`, `literalSkip`).
- [ ] Append these tests (do not modify the six existing ones):

```js
test("v2 colors: {value, role} entries are honoured as allowed hex", () => {
  const v = lintFiles([v2Colors], MANIFEST_V2).filter(x => x.rule === "no-hardcoded-hex");
  assert.equal(v.length, 0, JSON.stringify(v));
});

test("v2 feedback hex is allowed even when allowedHex is empty", () => {
  const src = fs.readFileSync(v2Colors, "utf8");
  assert.match(src, /#34d399/);   // the feedback fg colour used by the fixture
  const v = lintFiles([v2Colors], MANIFEST_V2);
  assert.equal(v.filter(x => x.rule === "no-hardcoded-hex").length, 0);
});

test("flags literal JSX text, placeholder and aria-label when i18n is enabled", () => {
  const v = lintFiles([literalText], MANIFEST_V2).filter(x => x.rule === "no-literal-jsx-string");
  const texts = v.map(x => x.message).join("\n");
  assert.equal(v.length, 3, texts);
  assert.match(texts, /Painel de controle/);
  assert.match(texts, /Digite o nome/);
  assert.match(texts, /Fechar painel/);
});

test("does not flag t() calls, numbers or punctuation", () => {
  const v = lintFiles([literalClean], MANIFEST_V2).filter(x => x.rule === "no-literal-jsx-string");
  assert.equal(v.length, 0, JSON.stringify(v));
});

test("the rule is inert when manifest.i18n.enabled is false", () => {
  const v = lintFiles([literalText], MANIFEST_V2_NO_I18N).filter(x => x.rule === "no-literal-jsx-string");
  assert.equal(v.length, 0, JSON.stringify(v));
});

test("test/spec/stories files are excluded from the i18n rule", () => {
  const v = lintFiles([literalSkip], MANIFEST_V2).filter(x => x.rule === "no-literal-jsx-string");
  assert.equal(v.length, 0, JSON.stringify(v));
});

test("the lexer masks strings and comments but leaves JSX body text", () => {
  const { masked, ok } = maskNonCode(`const a = "hidden"; // gone\n<p>Visible</p>`);
  assert.equal(ok, true);
  assert.ok(!masked.includes("hidden"));
  assert.ok(!masked.includes("gone"));
  assert.ok(masked.includes("Visible"));
});

test("an ambiguous file (apostrophe in JSX text) is skipped, never flagged", () => {
  assert.equal(scanJsxLiterals(`<p>Don't block me</p>`), null);
});

test("two manifests present is an explicit failure, not a silent choice", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "steve-paths-"));
  fs.mkdirSync(path.join(dir, "docs", "design"), { recursive: true });
  fs.writeFileSync(path.join(dir, "docs", "design", "manifest.json"), "{}");
  fs.writeFileSync(path.join(dir, "design-system-manifest.json"), "{}");
  assert.throws(() => resolveManifestPath(null, dir), (e) =>
    e instanceof SteveError && /docs\/design\/manifest\.json/.test(e.message)
      && /design-system-manifest\.json/.test(e.message));
});
```

- [ ] Run: `node --test scripts/design_lint.test.mjs scripts/design_lint.cli.test.mjs` — all 6 original + 9 new must pass.

---

## Task A7 — Extend `design_lint.cli.test.mjs` and `test_ingest.py` (Tier 1)

**Files**
- Modify: `scripts/design_lint.cli.test.mjs`, `scripts/test_ingest.py`

**Interfaces**
- Consumes: the `design_lint.mjs` CLI and `ingest_design_system.py --root/--stdout/--manifest`.

**Steps**

- [ ] Add to `scripts/design_lint.cli.test.mjs` a helper that builds a throwaway git repo, then three cases:

```js
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function tmpRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "steve-cli-"));
  const g = (...a) => execFileSync("git", a, { cwd: dir, encoding: "utf8" });
  g("init", "-q");
  g("config", "user.email", "t@example.com");
  g("config", "user.name", "t");
  fs.copyFileSync(manifest, path.join(dir, "design-system-manifest.json"));
  fs.writeFileSync(path.join(dir, "bad.tsx"), 'export const X = () => <div style={{ color: "#ff0000" }} />;\n');
  g("add", "-A");
  g("commit", "-qm", "seed");
  return { dir, sha: g("rev-parse", "HEAD").trim() };
}

test("--commit scopes to that commit and blocks on its violations", () => {
  const { dir, sha } = tmpRepo();
  try {
    execFileSync("node", [cli, "--commit", sha], { cwd: dir, encoding: "utf8" });
    assert.fail("should have exited non-zero");
  } catch (e) {
    assert.equal(e.status, 1);
    assert.match(e.stdout + e.stderr, /no-hardcoded-hex/);
  }
});

test("an invalid revision fails closed (exit 2), never reports clean", () => {
  const { dir } = tmpRepo();
  try {
    execFileSync("node", [cli, "--commit", "deadbeefdeadbeef"], { cwd: dir, encoding: "utf8" });
    assert.fail("should have exited non-zero");
  } catch (e) {
    assert.equal(e.status, 2);
    assert.doesNotMatch(e.stdout + e.stderr, /clean/i);
  }
});

test("mutually exclusive scope flags are rejected", () => {
  const { dir, sha } = tmpRepo();
  try {
    execFileSync("node", [cli, "--changed", "--commit", sha], { cwd: dir, encoding: "utf8" });
    assert.fail("should have exited non-zero");
  } catch (e) {
    assert.equal(e.status, 2);
    assert.match(e.stdout + e.stderr, /mutually exclusive/);
  }
});
```

- [ ] Add to `scripts/test_ingest.py` (and register each in the `__main__` block):

```python
def test_v2_feedback_typography_z_breakpoints():
    repo = os.path.join(HERE, "fixtures", "repo_v2_tokens")
    m = run_ingest(repo)
    assert m["schemaVersion"] == 2, m.get("schemaVersion")
    fb = m["tokens"]["feedback"]
    assert fb["success"]["solid"] == "#10b981", fb
    assert fb["success"]["fg"] == "#34d399", fb
    assert fb["success"]["subtle"] == "rgba(16,185,129,.12)", fb
    assert "danger" in fb and fb["danger"]["solid"] == "#ef4444", fb   # --color-error normalises to danger
    typo = m["tokens"]["typography"]
    assert typo["h1"]["size"] == "2.5rem", typo
    assert typo["h1"]["lineHeight"] == "1.1", typo
    assert typo["h1"]["weight"] == "700", typo
    assert typo["sans"]["family"].startswith('"Inter"'), typo
    assert m["tokens"]["zIndex"] == {"modal": 1000, "dropdown-in-modal": 1050}, m["tokens"]["zIndex"]
    assert m["tokens"]["breakpoints"] == {"md": "768px", "xl": "1280px"}, m["tokens"]["breakpoints"]


def test_allowed_hex_includes_feedback():
    repo = os.path.join(HERE, "fixtures", "repo_v2_tokens")
    m = run_ingest(repo)
    for hexv in ("#080b12", "#3b82f6", "#10b981", "#34d399", "#ef4444"):
        assert hexv in m["allowedHex"], (hexv, m["allowedHex"])


def test_i18n_and_voice():
    repo = os.path.join(HERE, "fixtures", "repo_v2_tokens")
    m = run_ingest(repo)
    assert m["i18n"]["enabled"] is True, m["i18n"]          # next-intl dependency
    assert m["i18n"]["keyPattern"] == "<area>.<screen>.<element>", m["i18n"]
    assert m["voice"]["locale"] == "pt-BR", m["voice"]


def test_v1_repo_still_has_no_i18n():
    repo = os.path.join(HERE, "fixtures", "repo_tailwind_css")
    m = run_ingest(repo)
    assert m["i18n"]["enabled"] is False, m["i18n"]
    assert m["tokens"]["feedback"] == {}, m["tokens"]["feedback"]


def test_manifest_flag_writes_under_docs_design():
    import shutil, tempfile
    src = os.path.join(HERE, "fixtures", "repo_v2_tokens")
    with tempfile.TemporaryDirectory() as tmp:
        repo = os.path.join(tmp, "repo")
        shutil.copytree(src, repo)
        out = subprocess.run(
            [sys.executable, os.path.join(HERE, "ingest_design_system.py"), "--root", repo,
             "--manifest", "docs/design/manifest.json"],
            capture_output=True, text=True)
        assert out.returncode == 0, out.stderr
        written = os.path.join(repo, "docs", "design", "manifest.json")
        assert os.path.exists(written), out.stderr
        assert json.load(open(written))["schemaVersion"] == 2
```

- [ ] Run both suites; all 8 old + 5 new Python cases and all Node cases must pass.

---

## Task A8 — Hook, pre-commit and CI templates use the new default (§4, §8)

**Files**
- Modify: `hooks/design-lint-hook.sh`, `templates/precommit-design.template.sh`, `templates/ci-design-check.template.yml`

**Interfaces**
- Consumes: `design_lint.mjs` exit codes (`0` clean, `1` violations, `2` config/scope error) and its own manifest resolution when `--manifest` is omitted.

**Steps**

- [ ] `hooks/design-lint-hook.sh`: stop hard-coding the manifest. Replace the `MANIFEST=` block and the invocation with:

```bash
MANIFEST=""
if [ -f "$ROOT/docs/design/manifest.json" ] && [ -f "$ROOT/design-system-manifest.json" ]; then
  echo "design-lint: both docs/design/manifest.json and design-system-manifest.json exist — resolve the ambiguity." >&2
  exit 2
elif [ -f "$ROOT/docs/design/manifest.json" ]; then
  MANIFEST="$ROOT/docs/design/manifest.json"
elif [ -f "$ROOT/design-system-manifest.json" ]; then
  MANIFEST="$ROOT/design-system-manifest.json"
else
  exit 0   # ungoverned repo: the hook stays silent
fi
if ! OUT="$(node "$ROOT/scripts/design_lint.mjs" --manifest "$MANIFEST" "$FILE" 2>&1)"; then
  echo "design-lint blocked this edit:" >&2
  echo "$OUT" >&2
  exit 2
fi
exit 0
```

- [ ] `templates/precommit-design.template.sh`: drop the hard-coded default; let the script resolve, and keep `DESIGN_MANIFEST` as the explicit override. Also fix the stale command name in the message:

```bash
#!/usr/bin/env bash
# Installed by steve-designer at .git/hooks/pre-commit (or via husky/lefthook).
# Blocks commits that violate the design system.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
if [ -n "${DESIGN_MANIFEST:-}" ]; then
  exec node "$ROOT/scripts/design_lint.mjs" --manifest "$DESIGN_MANIFEST" --changed
fi
if [ ! -f "$ROOT/docs/design/manifest.json" ] && [ ! -f "$ROOT/design-system-manifest.json" ]; then
  echo "design-lint: no manifest — run /steve-designer:enforce. Skipping."
  exit 0
fi
exec node "$ROOT/scripts/design_lint.mjs" --changed
```

- [ ] `templates/ci-design-check.template.yml`: drop the hard-coded `--manifest`, and add the optional `design-a11y` job gated on `STEVE_A11Y_URL` (§8):

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
      - name: Run design-lint on the PR range
        run: |
          BASE="${{ github.event.pull_request.base.sha }}"
          HEAD="${{ github.event.pull_request.head.sha }}"
          node scripts/design_lint.mjs --range "$BASE..$HEAD"

  design-a11y:
    # Optional. Runs only when the repo defines STEVE_A11Y_URL (a reachable
    # preview URL) as a repository variable. Absent → the job is skipped.
    runs-on: ubuntu-latest
    if: ${{ vars.STEVE_A11Y_URL != '' }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - name: axe-core accessibility scan
        run: npx --yes @axe-core/cli "${{ vars.STEVE_A11Y_URL }}" --exit
```

- [ ] Verify: `bash -n hooks/design-lint-hook.sh`, `bash -n templates/precommit-design.template.sh`, `python3 -c "import yaml,sys; yaml.safe_load(open('templates/ci-design-check.template.yml'))"` (or `python3 -c "print(open('templates/ci-design-check.template.yml').read())"` if PyYAML is absent — then eyeball the indentation).

**Slice A verification (run all, in order):**

```bash
node --test scripts/design_lint.test.mjs scripts/design_lint.cli.test.mjs
python3 scripts/test_ingest.py
bash -n hooks/design-lint-hook.sh templates/precommit-design.template.sh
python3 -c "import json; [json.load(open(p)) for p in ['scripts/fixtures/manifest.json','scripts/fixtures/manifest_pkg.json','scripts/fixtures/manifest_v2.json','scripts/fixtures/manifest_v2_no_i18n.json','templates/design-system-manifest.template.json']]"
node scripts/design_lint.mjs --manifest scripts/fixtures/manifest_v2.json scripts/fixtures/lint_literal_clean.tsx   # expect "clean", exit 0
shellcheck -S warning hooks/design-lint-hook.sh templates/precommit-design.template.sh 2>/dev/null || true
```

---

# SLICE B — agents + references

Prose only. Tier 0. Every file keeps its existing YAML frontmatter shape (`name` + `description` for agents).

## Task B1 — `references/hard-won-rules.md` (new, §9)

**Files** — Create: `skills/steve-designer/references/hard-won-rules.md`

**Interfaces** — Produces: a reference read by `component-builder` and `design-enforcer`; referenced from `SKILL.md` (Slice D) by that exact path.

**Steps**

- [ ] Write the file as a numbered rule list. Each rule = **Rule → why it bites → the concrete fix**. The eleven rules, verbatim in substance from §9:
  1. A floating surface (dropdown, popover, command palette) has a max-height and scrolls inside itself — never grows past the viewport.
  2. `ConfirmDialog` uses `role="alertdialog"`, opens focus on **Cancel**, and returns focus to the trigger on close.
  3. A dropdown rendered inside a modal needs its own z-index above the modal (`dropdown-in-modal`), not the plain `dropdown` value.
  4. Destructive microcopy names the real consequence and the real count; provide `_zero` / `_um` (`_one`) plural variants.
  5. Feedback **text** always uses the `fg` slot; `solid` is for fills only. Text on `solid` fails contrast.
  6. Light text on a saturated accent fails AA — check the pair, don't assume.
  7. An empty state says what will happen when the list fills, not just "add your first item".
  8. A success message reports the number that matters ("3 invoices sent"), not "Success!".
  9. Never pre-select a value in a field the user cannot change afterwards.
  10. A 409 conflict gets its own message naming the conflicting field — never the generic error toast.
  11. Every rule above is checkable in review: `design-enforcer` cites the rule number.
- [ ] Close with a short "How to use this file" paragraph: `component-builder` checks its output against the list before returning; `design-enforcer` cites rule numbers in findings.
- [ ] Verify: file exists, has an `#` H1, and every rule has a fix clause.

## Task B2 — `references/capabilities.md` (new, §3.1, §9)

**Files** — Create: `skills/steve-designer/references/capabilities.md`

**Interfaces** — Produces: the canonical machine-and-human capability map. `/steve-designer:help` prints this file verbatim (Slice D). The generated `AGENTS.md` points at it (Slice C).

**Steps**

- [ ] Structure, in this order:
  1. **What Steve is** — one paragraph: owner of the project's UI design system; creates it, adopts it, directs every UI change, verifies any executor's work, maintains `docs/design/`.
  2. **The three modes** — Creation, Governance, Direction — one line each.
  3. **Command table** — the eight commands: `start`, `resume`, `enforce`, `check`, `build`, `handoff`, `arsenal`, `help`, each with: what it does · what it reads · what it writes · **return contract** (what the caller gets back).
  4. **Artifacts table** — every path Steve owns: `docs/design/design-doc.md`, `brief.md`, `manifest.json`, `contrast.md`, `screens.md`, `decisions.md`, `handoffs/`, plus root `AGENTS.md`.
  5. **How another agent uses Steve without the plugin** — read `AGENTS.md`; ask for a `handoff` contract before writing UI; run `node scripts/design_lint.mjs --changed` before committing; the pre-commit + CI gate applies regardless of which agent wrote the code.
  6. **Scopes of `check`** — working tree (default), `--commit <sha>`, `--range <a>..<b>`, `--pr <n>`, with the §13.5 rule that `--pr` requires `HEAD == headRefOid` and never checks out for you.
  7. **Lint rules** — the four rules and their trigger conditions (`no-literal-jsx-string` only with `i18n.enabled`).
  8. **Deprecated** — `guard` → `enforce`, `patrol` → `check`; aliases remain through 0.3.x, removed in 0.4.
- [ ] Verify: file exists; every command name in it matches an actual file in `commands/` (cross-check after Slice D lands).

## Task B3 — `agents/tokens-engineer.md` (§7)

**Files** — Modify: `agents/tokens-engineer.md`

**Steps**

- [ ] In "What you produce", add four outputs after the existing three:
  - **Feedback layer** — for each of `success | warning | danger | info`: `solid`, `fg`, `subtle`. State the rule: text uses `fg`, fills use `solid`, backgrounds use `subtle`.
  - **`zIndex` ladder** — `dropdown`, `modal`, **`dropdown-in-modal`**, `toast`, with the explicit note that a dropdown inside a modal needs its own tier.
  - **`breakpoints`** — `sm/md/lg/xl`, and for each one **the layout change that happens at it** (not just the pixel value).
  - **Typography by role** — `display, h1…h3, body, body-sm, caption, mono-label`, each with `size / lineHeight / weight / tracking / family`.
- [ ] Add a new numbered output: **`docs/design/contrast.md`** — the fg×bg matrix computed against WCAG 2.1 (≥4.5:1 normal text, ≥3:1 large text ≥24px or ≥18.66px bold), listing every pair with its ratio and PASS/FAIL, followed by an explicit **Forbidden pairs** list. State that the ratio is computed, not estimated.
- [ ] Extend the `tokens-preview.html` section: the preview must additionally render the feedback layer (all four × three slots) and the contrast matrix.
- [ ] Add to "Anti-patterns to avoid": feedback colors used as text at `solid`; a z-index scale without a `dropdown-in-modal` tier; breakpoints with no stated layout change.
- [ ] Verify: `head -4 agents/tokens-engineer.md` still shows valid frontmatter with `name: tokens-engineer`.

## Task B4 — `agents/component-builder.md` (§7)

**Files** — Modify: `agents/component-builder.md`

**Steps**

- [ ] Add a non-negotiable rule block **"Every screen covers its states"**: `loading`, `empty`, `error`, `success`, plus every domain state named in the contract. A screen missing one of these is not done.
- [ ] Add **"Text goes through i18n"**: when `manifest.i18n.enabled` is true, every user-visible string is a key following `manifest.i18n.keyPattern`; never a literal. When it is false, follow `manifest.voice` instead.
- [ ] Add **"Halt and ask"** as its own section: when a design decision is missing (a token that does not exist, a component that is not in the inventory, copy that was not supplied), **stop**. Do not decide in code. Record the open decision in `docs/design/decisions.md` as a pending row and return control to the director. Give the exact pending-row format used by `decisions.template.md`.
- [ ] Add **"Apply `references/hard-won-rules.md`"** with the path, listing the three rules most often violated (floating-surface height, confirm-dialog focus, feedback `fg` vs `solid`).
- [ ] Update the inputs list: the brief now resolves as `docs/design/brief.md` → `design-brief.md` (§13.1 order), and the builder also receives the **screen contract** from `build`/`handoff`.
- [ ] Verify frontmatter intact.

## Task B5 — `agents/design-enforcer.md` (§7, §13.3, §13.4)

**Files** — Modify: `agents/design-enforcer.md`

**Steps**

- [ ] Update the frontmatter `description`: replace "Invoke from steve-designer's /patrol" with "Invoke from steve-designer's `/steve-designer:check`".
- [ ] Update the inputs section: the manifest path resolves per §13.1; the agent receives the scope object's `{files, diff}` from `resolveScope`, plus the scope label (working tree / commit / range / PR).
- [ ] Add checks 6–10 after the existing five:
  6. **Missing required state** — a screen without loading / empty / error / success (or a domain state named in the contract).
  7. **Token used outside its declared `role`** — check only when the manifest color entry carries a `role` (v2). A v1 manifest never triggers this.
  8. **Paid-rule violation** — a rule listed in `docs/design/design-doc.md` §10 as "cravado" that the diff breaks.
  9. **Literal UI string the linter does not cover** — only when `manifest.i18n.enabled` is **false**; otherwise `no-literal-jsx-string` already blocks it and re-reporting is forbidden.
  10. **Copy outside `manifest.voice`** — tone, casing, punctuation. **§13.3 correction:** with `i18n.enabled === false`, review **voice**, do not demand an i18n key.
- [ ] Add a scope line to the Output Format header: `## Sheriff semantic review — [scope]` where scope is one of `working tree | commit <sha> | range <a>..<b> | PR #<n>`.
- [ ] Update the `OUTPUT_FILE` default from `.steve/patrol-enforcer.md` to `.steve/check-enforcer.md` and say the orchestrator passes it explicitly.
- [ ] Verify frontmatter intact and the `## Sheriff semantic review` heading still appears in the output contract.

## Task B6 — `agents/design-critic.md` + `references/anti-patterns.md` (§7)

**Files** — Modify: `agents/design-critic.md`, `skills/steve-designer/references/anti-patterns.md`

**Steps**

- [ ] `design-critic.md`: under the **Distinctiveness** dimension, add two named signals with the required treatment — **"everything is a card"** (every content block wrapped in the same bordered surface) and **"one surface everywhere"** (no elevation or background differentiation between page, section and interactive surface). Each signal states the fix (break one block out of the card pattern; introduce a second surface tier from the tokens).
- [ ] `design-critic.md`: change the `OUTPUT_FILE` default from `.steve/patrol-critic.md` to `.steve/check-critic.md`, and note it is invoked by `check --visual` (or automatically when a preview URL is available).
- [ ] `anti-patterns.md`: add the same two entries under **Visual anti-patterns** ("Everything is a card", "One surface everywhere"), and add under **Token anti-patterns**: "Feedback color used as text at its `solid` value" and "A z-index scale with no `dropdown-in-modal` tier".
- [ ] Verify frontmatter intact on the agent; anti-patterns.md still has its `## How to use this file during build` closer.

**Slice B verification (Tier 0):**

```bash
for f in agents/*.md; do head -1 "$f" | grep -q '^---$' || echo "BAD FRONTMATTER $f"; done
grep -l "name:" agents/*.md | wc -l          # expect 4
test -f skills/steve-designer/references/hard-won-rules.md
test -f skills/steve-designer/references/capabilities.md
bash scripts/check_arsenal.sh >/dev/null; echo "arsenal exit $?"
```

---

# SLICE C — project templates

Prose only. Tier 0. These files are copied into user projects.

## Task C1 — `brief.template.md` (rename + governance header + voice, §8)

**Files**
- Create: `skills/steve-designer/templates/brief.template.md`
- Delete: `skills/steve-designer/templates/design-brief.template.md` (**after** creating the new file; `git mv` is preferred so history follows)

**Interfaces** — Consumed by `scripts/init_project_brief.py` (Slice A accepts **both** names, so ordering between slices does not break the script).

**Steps**

- [ ] `git mv skills/steve-designer/templates/design-brief.template.md skills/steve-designer/templates/brief.template.md`.
- [ ] Add a governance header block right under the H1, before the existing `- **Project:**` list:
  - `- **Status:** rascunho | em-revisao | cravado | superseded`
  - `- **Decisor:**`
  - `- **Versão:**`
  - `- **Supersedes:**`
- [ ] Add a new section **`## Voz e cópia`** between Phase 3 (References) and Phase 4 (Tokens), with these sub-fields: **Tom** (one sentence), **Locale**, **Padrão de mensagem por tipo** (sucesso / erro / vazio / confirmação destrutiva — one line each), **Convenção de chave i18n** (the `keyPattern`), **Palavras banidas**.
- [ ] Keep every existing phase section unchanged — this is an addition, not a rewrite.
- [ ] Update the intro blockquote: the file lives at `docs/design/brief.md` (legacy `design-brief.md` at the root is still read).

## Task C2 — `design-doc.template.md` (new, §8)

**Files** — Create: `skills/steve-designer/templates/design-doc.template.md`

**Interfaces** — Produces the canonical source at `docs/design/design-doc.md`. Filled by `enforce` and by Creation Phase 4 from the manifest + brief.

**Steps**

- [ ] Write the template with exactly these ten sections plus a history table, each with placeholder rows and a one-line instruction comment:
  - **§1 Princípios** — 3–5 principles, each with the decision it settles.
  - **§2 Tokens** — sub-tables: core, marca, feedback (solid/fg/subtle), tipografia (role → size/lineHeight/weight/tracking/family), espaço/raio/sombra, motion, z-index (incl. `dropdown-in-modal`), breakpoints (value + layout change).
  - **§3 Voz e microcópia** — tone, locale, message pattern per type, banned words, i18n key convention.
  - **§4 Componentes** — table: name · import · props · states · tokens used · a11y requirements.
  - **§5 Estados obrigatórios** — loading / empty / error / success + domain states, and the rule that a screen missing one is not done.
  - **§6 Telas** — pointer to `screens.md` plus the summary count.
  - **§7 Acessibilidade** — contrast floors, focus visibility, keyboard paths, hit targets ≥44px, `prefers-reduced-motion`; pointer to `contrast.md`.
  - **§8 Zero hardcode e paths** — the four lint rules, the manifest path resolution order, where the gate lives.
  - **§9 DS de referência** — which external system (if any) this one descends from and where it deliberately diverges.
  - **§10 Checklist "cravado"** — the paid rules; each line is a rule `design-enforcer` can cite.
  - **Histórico** — table: versão · data · autor · mudança · lição.
- [ ] Placeholders use `{{DOUBLE_BRACE}}` form, consistent with the other templates.

## Task C3 — `screens.template.md` and `decisions.template.md` (new, §8)

**Files** — Create: `skills/steve-designer/templates/screens.template.md`, `skills/steve-designer/templates/decisions.template.md`

**Steps**

- [ ] `screens.template.md` — a single table with columns: **Tela · Rota · Componentes · Estados cobertos · Origem** (`build` | `handoff` | `existente` | `importada`), plus a legend explaining `Estados cobertos` must list all of loading/empty/error/success or name what is missing and why. Keep it under 40 lines.
- [ ] `decisions.template.md` — two tables:
  - **Decisões** — versão · data · autor · mudança · lição.
  - **Pendências (halt-and-ask)** — data · quem pediu · o que falta (token/componente/cópia) · tela afetada · status (`aberta` | `resolvida em <versão>`). This is the exact row format `component-builder` writes when it halts (Task B4 must quote it identically).
- [ ] Keep both under 40 lines each.

## Task C4 — `handoff.template.md` (rename from `final-prompt`, tool-agnostic, §8)

**Files**
- Create: `skills/steve-designer/templates/handoff.template.md`
- Delete: `skills/steve-designer/templates/final-prompt.template.md` (via `git mv`)

**Steps**

- [ ] `git mv skills/steve-designer/templates/final-prompt.template.md skills/steve-designer/templates/handoff.template.md`.
- [ ] Retitle to `# Handoff — {{SCREEN_NAME}}` and rewrite the intro: this is the **execution contract** for any executor (Claude, Codex, v0, Lovable, Cursor, a human). Remove the "if building via Claude Code the subagent already has this" caveat — the handoff is now first-class.
- [ ] Restructure into the screen contract:
  1. **Escopo** — the screen, its route, what changes and what must not.
  2. **Componentes permitidos** — the exact list from the manifest with imports and props. "Anything not on this list is a stop, not a decision."
  3. **Tokens por papel** — color by role, spacing, radius, typography by role, feedback slots, z-index tier, breakpoints.
  4. **Estados obrigatórios** — loading / empty / error / success + domain states.
  5. **Chaves i18n** — the key pattern and the exact keys to create (or the voice rules when i18n is off).
  6. **Regras pagas** — the rules from design-doc §10 that apply to this screen.
  7. **Halt-and-ask** — what to do when a decision is missing: stop, write the pending row into `docs/design/decisions.md`, return.
  8. **Como devolver** — return the diff; the director closes with `/steve-designer:check`.
  9. **Hard constraints** — keep the existing four (tokens only, scale only, responsive 375→1920, reduced motion, a11y baseline).
- [ ] Keep the existing anti-pattern blocks (web/app) at the end.
- [ ] Output path is `docs/design/handoffs/<YYYY-MM-DD>-<screen>.md`.

## Task C5 — `AGENTS.md.template.md` (§8, §3.1)

**Files** — Modify: `templates/AGENTS.md.template.md`

**Steps**

- [ ] Change the header blockquote: the machine inventory lives at `docs/design/manifest.json` (legacy `design-system-manifest.json` still read). The canonical human doc is `docs/design/design-doc.md`.
- [ ] Add the governing sentence, verbatim and prominent: **"Toda mudança de UI passa pelo Steve: `handoff` antes de escrever, `check` antes de commitar."** (with an English gloss on the next line, since this template is English).
- [ ] Add hard rule 4: **no literal UI strings** when the manifest declares i18n.
- [ ] Add a **Required states** section: every screen covers loading / empty / error / success plus its domain states.
- [ ] Add a **Voice** section pointing at `docs/design/design-doc.md` §3.
- [ ] Add **Halt and ask**: a missing design decision is a stop, not an improvisation — record it in `docs/design/decisions.md`.
- [ ] Add an **Inventory pointers** row for `docs/design/` (all six files) and a pointer to `skills/steve-designer/references/capabilities.md` for agents that want the full capability map.
- [ ] Replace the two stale `/steve-designer:guard` mentions with `/steve-designer:enforce`.
- [ ] Update the "When you touch UI" step 3 command to `node scripts/design_lint.mjs --changed` (no `--manifest`; the script resolves).

## Task C6 — MCP templates + CLAUDE.md snippet

**Files** — Modify: `templates/mcp.json.template`, `templates/codex-config.toml.template`, `skills/steve-designer/templates/claude-md-snippet.template.md`

**Steps**

- [ ] `mcp.json.template` and `codex-config.toml.template`: no server changes (still ≤3, still stack-aware on `shadcn`). Only update the comment lines that say "Sheriff Mode" to "Governance mode (`/steve-designer:enforce`)".
- [ ] `claude-md-snippet.template.md`: replace `design-brief.md` references with `docs/design/brief.md`; add a "Design system docs" block pointing at all six `docs/design/` files; replace the "Build workflow" step 1 with "ask Steve for a `handoff` contract (`/steve-designer:handoff <screen>`) before writing UI, and run `/steve-designer:check` before committing"; keep the token and anti-pattern sections as they are.

**Slice C verification (Tier 0):**

```bash
ls skills/steve-designer/templates/     # expect: brief, design-doc, screens, decisions, handoff, claude-md-snippet
test ! -f skills/steve-designer/templates/design-brief.template.md
test ! -f skills/steve-designer/templates/final-prompt.template.md
python3 -c "import json; json.load(open('templates/mcp.json.template'))"
grep -c "steve-designer:guard" templates/AGENTS.md.template.md   # expect 0
python3 scripts/init_project_brief.py --project-root /tmp/steve-brief-smoke --project-name smoke 2>&1 | tail -2
```

(the last line needs `mkdir -p /tmp/steve-brief-smoke` first; it must create `docs/design/brief.md` there — this is the cross-check that C1's rename and A1's `find_template()` agree.)

---

# SLICE D — commands + brain

Prose only. Tier 0. Every command file needs YAML frontmatter with a `description` key — Claude Code will not register it otherwise.

## Task D1 — `commands/enforce.md` and the `guard` alias (§3, §13.6)

**Files**
- Create: `commands/enforce.md`
- Modify: `commands/guard.md` (rewritten as a thin deprecated alias — **not deleted**, per §13.6)

**Steps**

- [ ] Create `commands/enforce.md` starting from the current `commands/guard.md` body (it is good and battle-tested), with these changes:
  - `description:` — "Set up governance on this repo — ingest the design system, generate `docs/design/`, write the law, and install the hard gate (pre-commit + CI). Works for Claude Code and Codex. Non-destructive on existing repos."
  - Keep **Prime directive: NEVER CLOBBER** and **Step 0 greenfield/brownfield detection** verbatim, adding `docs/design/` to the brownfield signal list.
  - Step 1 (INGEST): the command is now `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/ingest_design_system.py --root . --out .steve/manifest.detected.json`; the destination resolves per §13.1 (`docs/design/manifest.json` for a new repo; the legacy root path if that is what already exists; **abort with the diagnostic if both exist**). Same merge-never-drop rules as today.
  - **New Step 2 — the design doc.** Generate `docs/design/design-doc.md` from `templates/design-doc.template.md`, filled from the manifest and the brief. If it already exists, merge new tokens/components into the tables and never overwrite §1, §3, §9, §10 (the judgement sections). Also seed `docs/design/screens.md` and `docs/design/decisions.md` if absent.
  - Step 3 (CODIFY the law): `AGENTS.md` gains the pointer to `docs/design/` and to `references/capabilities.md`; the section heading becomes `## Design System Law (steve-designer)`; the merge/skip behaviour is unchanged.
  - Step 4 (the gate): unchanged except the pre-commit/CI templates no longer pass `--manifest`.
  - Steps 5–7 (MCP, verify, report): unchanged, except Verify now runs `node scripts/design_lint.mjs --changed` and the report table adds rows for `docs/design/design-doc.md`, `screens.md`, `decisions.md`.
  - Close with: "Do not auto-commit. Show the user the diff and let them commit."
- [ ] Rewrite `commands/guard.md` as an alias, complete content:

```markdown
---
description: "[Deprecated — use /steve-designer:enforce] Alias kept for the 0.3.x series."
---

`/steve-designer:guard` was renamed to **`/steve-designer:enforce`** in 0.3.0.

1. Tell the user, in one line: "`guard` is deprecated — it is now `/steve-designer:enforce`. Running it for you this time."
2. Then execute `${CLAUDE_PLUGIN_ROOT}/commands/enforce.md` exactly as written, with the same arguments.

This alias is removed in 0.4.0.
```

## Task D2 — `commands/check.md` and the `patrol` alias (§3, §13.4, §13.5, §13.6)

**Files**
- Create: `commands/check.md`
- Modify: `commands/patrol.md` (thin deprecated alias)

**Steps**

- [ ] Create `commands/check.md` with `description:` "Verify UI work against the design system — mechanical lint, semantic review, and an optional visual critique. Scopes: working tree (default), --commit, --range, --pr." Body, in order:
  1. **Scope.** Parse one of `--commit <sha>`, `--range <a>..<b>`, `--pr <n>`; default is the working tree. The flags are mutually exclusive; say so and stop if more than one is passed. Never check out a branch on the user's behalf; for `--pr`, if `HEAD` is not the PR head, print the exact `git fetch`/`git checkout` command the linter reports and stop.
  2. **Layer 1 — mechanical gate (blocking).** Run `node scripts/design_lint.mjs <scope flags>`. Exit `0` = clean, `1` = violations (list every one verbatim, blocking), `2` = configuration or scope failure — **report the failure, never call it clean**.
  3. **Layer 2 — semantic review (severity-rated).** Spawn `design-enforcer` with: the resolved manifest contents, the scope's `{files, diff}`, the scope label, `AGENTS.md`, `docs/design/design-doc.md` if present, and `OUTPUT_FILE: .steve/check-enforcer.md`. Keep today's `patrol` failure rule verbatim: if the final message lacks `## Sheriff semantic review`, read the OUTPUT_FILE; if both are empty, the check **failed** — never a pass.
  4. **Layer 3 — visual critique (conditional).** Run when `--visual` is passed **or** a preview URL is available. Spawn `design-critic` with the preview URL/screenshots, `docs/design/design-doc.md`, and `OUTPUT_FILE: .steve/check-critic.md`.
  5. **Report.** Blocking mechanical violations, then severity-rated semantic findings, then the critique. For each blocking item: `file:line` and the exact fix. Do not auto-fix unless asked.
  6. If no manifest is found, tell the user to run `/steve-designer:enforce` first.
- [ ] Rewrite `commands/patrol.md` as an alias, same shape as the `guard` alias in D1, pointing at `${CLAUDE_PLUGIN_ROOT}/commands/check.md`.

## Task D3 — `commands/build.md` (new, §3)

**Files** — Create: `commands/build.md`

**Steps**

- [ ] `description:` "Direct a UI change in a governed project — Steve reads the manifest and design doc, builds the screen contract, and constructs (or conforms) the screen via component-builder, closing with check."
- [ ] Body, in order:
  1. **Preconditions.** A manifest must resolve (§13.1) — otherwise send the user to `/steve-designer:enforce`. Read `docs/design/design-doc.md`, `docs/design/brief.md` (fallback `design-brief.md`), and `docs/design/screens.md`.
  2. **Build the screen contract** — the nine sections of `handoff.template.md`: scope, allowed components, tokens by role, required states, i18n keys (or voice rules), paid rules, halt-and-ask, return protocol, hard constraints. This contract is built the same way whether it is executed here or handed off.
  3. **Two paths.** *New screen* → spawn `component-builder` with the contract. *Existing screen* → first run the mechanical lint on it, then spawn `component-builder` in conform mode with the violation list plus the contract.
  4. **Halt-and-ask is respected.** If the builder returns a pending decision, do not decide for it — surface the pending row from `docs/design/decisions.md` to the user and ask.
  5. **Record.** Append/refresh the screen's row in `docs/design/screens.md` (screen · route · components · states covered · origin `build`).
  6. **Close.** Always finish by running `/steve-designer:check` on the resulting working tree and reporting the result.
  7. Do not auto-commit.

## Task D4 — `commands/handoff.md` and `commands/help.md` (new, §3, §3.1)

**Files** — Create: `commands/handoff.md`, `commands/help.md`

**Steps**

- [ ] `commands/handoff.md` — `description:` "Produce the execution contract for a UI change as a prompt any executor can run (Claude, Codex, v0, Lovable, a human), saved under docs/design/handoffs/." Body:
  1. Same preconditions and same contract construction as `build` (steps 1–2 of D3) — say explicitly that the contract is identical; only the executor differs.
  2. Render it through `${CLAUDE_PLUGIN_ROOT}/skills/steve-designer/templates/handoff.template.md`.
  3. Write it to `docs/design/handoffs/<YYYY-MM-DD>-<screen-slug>.md` **and** print it in full in the chat, so the user can paste it anywhere.
  4. State the return protocol: the executor returns the diff; the director closes with `/steve-designer:check` (working tree, or `--commit`/`--range`/`--pr` depending on how it came back).
  5. Record the row in `docs/design/screens.md` with origin `handoff`.
- [ ] `commands/help.md` — `description:` "Show what Steve does: the three modes, the eight commands, what he produces and where. Serves humans and other agents." Body:
  1. Read `${CLAUDE_PLUGIN_ROOT}/skills/steve-designer/references/capabilities.md` and print it **verbatim** — it is the canonical map, so do not paraphrase or summarize it.
  2. Then add exactly two lines of orientation: which mode fits the user's current repo (governed vs. not — decide by whether a manifest resolves), and the single next command to run.
  3. Do nothing else. `help` never starts a flow.

## Task D5 — `commands/start.md`, `commands/resume.md`, `commands/arsenal.md` (§3, §4)

**Files** — Modify: `commands/start.md`, `commands/resume.md`, `commands/arsenal.md`

**Steps**

- [ ] `start.md`: change the closing rule "Update `design-brief.md` at the project root" to "Update the brief at `docs/design/brief.md` (the resolver's creation target)". Add one line to the Phase 4 note: the phase now also produces `docs/design/design-doc.md` and `docs/design/contrast.md`.
- [ ] `resume.md`: replace step 1 with the resolution order — read `docs/design/brief.md`; if absent, `design-brief.md` at the root; **if both exist, stop and name both files** (§13.1). Update the not-found message to name `/steve-designer:start`. Keep the rest.
- [ ] `arsenal.md`: only the Step 4 suggestion line changes — mention `/steve-designer:start`, `/steve-designer:resume`, and `/steve-designer:enforce` for an existing project. Everything else unchanged.

## Task D6 — `SKILL.md`, `governance-playbook.md`, `orchestration-map.md`, `phase-playbook.md`, `hooks/hooks.json`

**Files** — Modify: `skills/steve-designer/SKILL.md`, `skills/steve-designer/references/governance-playbook.md`, `skills/steve-designer/references/orchestration-map.md`, `skills/steve-designer/references/phase-playbook.md`, `hooks/hooks.json`

**Steps**

- [ ] `SKILL.md` frontmatter `description`: extend it to name the new capabilities and triggers — add "owns the project's UI design system", "directs any UI change", "verifies work from any executor", and the trigger phrases **"mudar UI" / "change UI", "nova tela" / "new screen", "conformar tela" / "conform a screen", "revisar diff de UI" / "review a UI diff", "prompt para outra ferramenta" / "prompt for another tool"**. Keep the existing Creation-mode triggers — they still fire.
- [ ] `SKILL.md` body — replace the **"Two modes: Creation vs Sheriff"** section with **"Three modes"**: Creation (six phases), Governance (`enforce` + `check`), Direction (`build` + `handoff`). Name the eight commands and note `guard`/`patrol` are deprecated aliases through 0.3.x.
- [ ] `SKILL.md` — replace every "write to `design-brief.md` at the project root" instruction with the `docs/design/brief.md` resolution order (§13.1); state it once, near the top, and reference it afterwards.
- [ ] `SKILL.md` — add a new section **"The `docs/design/` folder"** reproducing the §4 tree with a one-line purpose per file, and stating that Steve owns the folder in any governed project.
- [ ] `SKILL.md` — Phase 4 gains two outputs: `docs/design/design-doc.md` and `docs/design/contrast.md`.
- [ ] `SKILL.md` — the "Reference files", "Agent prompts", "Templates" and "Scripts" lists must be regenerated to match reality after Slices B and C: add `hard-won-rules.md`, `capabilities.md`; rename `design-brief.template.md`→`brief.template.md`, `final-prompt.template.md`→`handoff.template.md`; add `design-doc.template.md`, `screens.template.md`, `decisions.template.md`. **Every path listed must exist** — this is the D-depends-on-B-and-C edge.
- [ ] `governance-playbook.md`: rename Sheriff mode → **Governance mode** throughout, `guard`→`enforce`, `patrol`→`check` (7 occurrences). Add a fourth lint rule row for `no-literal-jsx-string` in the severity model (error, i18n-gated). Add the `check` scope table (working tree / commit / range / PR) with the fail-closed rule. Add `docs/design/**` to the **Portable (the guarantee)** layer row. Keep the "escape hatch is out of scope" paragraph as is.
- [ ] `orchestration-map.md`: rename the "Sheriff mode (governance)" table's rows to the new commands; add rows for **Direction** (`build` → `component-builder`; `handoff` → `handoff.template.md`; `help` → `capabilities.md`) and for the visual layer (`check --visual` → `design-critic`).
- [ ] `phase-playbook.md`: update the single `design-brief.md` mention (line ~266) to the resolution order. No other change.
- [ ] `hooks/hooks.json`: no change is required — the `PostToolUse` matcher and command path are unaffected. Confirm by inspection and record "no change needed" rather than editing.

**Slice D verification (Tier 0):**

```bash
for f in commands/*.md; do
  head -1 "$f" | grep -q '^---$' || echo "NO FRONTMATTER: $f";
  sed -n '1,6p' "$f" | grep -q '^description:' || echo "NO DESCRIPTION: $f";
done
ls commands/    # expect: arsenal build check enforce guard handoff help patrol resume start (10 files)
python3 -c "import json; json.load(open('hooks/hooks.json'))"
grep -o 'references/[a-z-]*\.md' skills/steve-designer/SKILL.md | sort -u | while read p; do test -f "skills/steve-designer/$p" || echo "DANGLING: $p"; done
grep -o 'templates/[a-z-]*\.template\.[a-z]*' skills/steve-designer/SKILL.md | sort -u | while read p; do test -f "skills/steve-designer/$p" || echo "DANGLING: $p"; done
```

---

# SLICE E — docs and version (runs last)

## Task E1 — `README.md` rewrite (§10)

**Files** — Modify: `README.md`

**Steps**

- [ ] Rewrite the opening: Steve is the **owner of the UI design system** of any project that invokes him — he creates it or adopts it, directs every UI change, verifies any executor's work, and maintains `docs/design/`.
- [ ] Replace the "What it does" numbered list with a **three-mode** section: Creation (six phases), Governance (`enforce`/`check`), Direction (`build`/`handoff`).
- [ ] Add a **Commands** table with all eight, one line each, plus a deprecation note for `guard`/`patrol`.
- [ ] Add a **`docs/design/`** section reproducing the §4 tree.
- [ ] Add **"How another agent invokes Steve"** — the three doors from §3.1 (`references/capabilities.md`, the project `AGENTS.md`, the skill), in that order.
- [ ] Add two worked examples: (a) governing an existing repo — `enforce` → work → `check`; (b) a new screen — `handoff` → executor writes → `check`.
- [ ] Update the **Structure** tree: it currently omits `hooks/`, `templates/`, `docs/`, and lists only three agents and three commands. Fix it against the real tree.
- [ ] Replace **"Status: Version 0.1.0 — early"** with 0.3.0 (this is stale today — `plugin.json` already says 0.2.0).
- [ ] Add links to `docs/HELP.md` and `docs/INSTALACAO.md`.

## Task E2 — `docs/HELP.md` (PT) same shape (§10)

**Files** — Modify: `docs/HELP.md`

**Steps**

- [ ] Command table: replace the five rows with eight (`start`, `resume`, `arsenal`, `enforce`, `check`, `build`, `handoff`, `help`), each tagged with its mode, plus a deprecation row for `guard`/`patrol`.
- [ ] Change every `/steve-designer:guard` → `enforce` and `/steve-designer:patrol` → `check` (9 occurrences).
- [ ] Update the cycle diagram to `enforce → INGEST → CODIFY → gate`, and add a Direction line: `build` / `handoff` → `check`.
- [ ] Add a **`docs/design/`** section (PT) with the six files and their purpose.
- [ ] Update "O que o gate bloqueia" with the fourth rule (literal UI string when i18n is on).
- [ ] Update the cheat sheet: "Construir" now maps to `/steve-designer:build`, "Entregar para outra ferramenta" to `/steve-designer:handoff`, "Conferir" to `/steve-designer:check` (with its four scopes).
- [ ] Update the ready-made prompts to reference `docs/design/manifest.json`.
- [ ] Update the Notes section: the manifest path is now `docs/design/manifest.json`; add `references/capabilities.md` to the internal-references list.

## Task E3 — `docs/INSTALACAO.md`, `CONTRIBUTING.md`, `install.sh` (§10)

**Files** — Modify: `docs/INSTALACAO.md`, `CONTRIBUTING.md`, `install.sh`

**Steps**

- [ ] `INSTALACAO.md` §4 ("Conferir se funcionou"): the `/help` listing must show all eight commands, not three.
- [ ] `INSTALACAO.md` §5 ("Usar"): add `enforce`, `check`, `build`, `handoff`, `help` with one line each.
- [ ] `INSTALACAO.md` "Estrutura do que você está instalando": fix the tree (it omits `hooks/` and `templates/`, and says "3 subagents" when there are 4).
- [ ] `install.sh`: the only change is the "Next steps" block at the end — add `/steve-designer:help` as step 2 and keep the rest. Re-run `bash -n install.sh && bash install.sh --help` after editing.
- [ ] `CONTRIBUTING.md`: fix the **stale** local-setup instructions — `install.sh --project` no longer exists (removed in 0.2.0); replace with `bash /path/to/steve-designer/install.sh --local`. Also fix the "CI workflow runs … a dry-run of `install.sh --project`" line, and update the repository-layout tree to include `hooks/` and `templates/`.

## Task E4 — `CHANGELOG.md` closes 0.3.0 (§10)

**Files** — Modify: `CHANGELOG.md`

**Steps**

- [ ] Move everything currently under `## [Unreleased]` (the brownfield work) into the new `## 0.3.0 — 2026-09-03` release section — §10 says brownfield ships out of Unreleased.
- [ ] Under 0.3.0, add these subsections:
  - **Changed (BREAKING)** — `/steve-designer:guard` → `/steve-designer:enforce`, `/steve-designer:patrol` → `/steve-designer:check`. The old names remain as **deprecated aliases through 0.3.x** and are removed in 0.4.0 (§13.6). The manifest default moves to `docs/design/manifest.json` and the brief to `docs/design/brief.md`, both with fallback to the legacy root paths; **two files present is now a hard error, not a silent choice**. `classify_token` now routes `--success|--warning|--danger|--error|--info` (and their `-fg`/`-subtle` variants) to `tokens.feedback` instead of `tokens.color`.
  - **Added** — three modes and eight commands; `docs/design/` canonical folder; manifest **v2** (`schemaVersion: 2`, `feedback`, `typography`, `zIndex`, `breakpoints`, `i18n`, `voice`, color `{value, role}`); lint rule `no-literal-jsx-string`; `resolveScope` with `--commit` / `--range` / `--pr`; `references/hard-won-rules.md`; `references/capabilities.md`; templates `design-doc`, `screens`, `decisions`, `handoff` (renamed from `final-prompt`), `brief` (renamed from `design-brief`); optional `design-a11y` CI job behind `STEVE_A11Y_URL`.
  - **Fixed** — `design-lint` now exits `2` and reports the cause on a configuration or scope failure instead of printing "clean"; `init_project_brief.py` follows the same path resolution as every other reader.
- [ ] Update the link refs at the bottom (`[Unreleased]` compare → `v0.3.0...HEAD`, add `[0.3.0]`).

## Task E5 — version bump and CI structure check (§10, §11)

**Files** — Modify: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `.github/workflows/ci.yml`

**Steps**

- [ ] `plugin.json`: `"version": "0.3.0"`. Extend `description` to name the three modes. Add keywords `i18n`, `a11y`, `handoff`.
- [ ] `marketplace.json`: `metadata.version` and `plugins[0].version` → `"0.3.0"`; mirror the new description and keywords. (CI already warns on drift between the two.)
- [ ] `ci.yml` **"Check file structure"** step: extend the command list from `start/resume/arsenal` to all eight (`start resume arsenal enforce check build handoff help`), and the agent list from three to four (add `design-enforcer`). Add `test -f skills/steve-designer/references/capabilities.md`.
- [ ] `ci.yml`: add a new step that **actually runs the tests** — today CI never does, which contradicts §11:

```yaml
      - name: Run script tests
        run: |
          set -e
          node --test scripts/design_lint.test.mjs scripts/design_lint.cli.test.mjs
          python3 scripts/test_ingest.py
```

  Place it after "Lint shell scripts". Note `setup-node` is **not** currently in this job — add `- uses: actions/setup-node@v4` with `node-version: "24"` before the new step (the lexer and `resolveScope` rely on modern Node; the repo's own tests were verified on v24.18.0).
- [ ] `ci.yml`: add `scripts/steve_paths.py` and the two renamed templates to nothing — no change needed there, but re-run the whole workflow logic mentally against the new file names before finishing.

**Slice E verification (Tier 0):**

```bash
python3 -c "import json; p=json.load(open('.claude-plugin/plugin.json')); m=json.load(open('.claude-plugin/marketplace.json')); assert p['version']=='0.3.0'; assert m['plugins'][0]['version']=='0.3.0'; print('versions ok')"
bash -n install.sh && bash install.sh --help >/dev/null && echo "install.sh ok"
grep -c "steve-designer:guard\|steve-designer:patrol" docs/HELP.md README.md   # expect only deprecation mentions
node --test scripts/design_lint.test.mjs scripts/design_lint.cli.test.mjs
python3 scripts/test_ingest.py
```

---

# Integration order and dependencies

```
        ┌── A (scripts, Codex) ─────────────┐
start ──┼── B (agents + references) ────────┼──► D (commands + brain) ──► E (docs + version) ──► review
        └── C (project templates) ──────────┘
```

1. **A, B, C run in parallel.** Their file sets are disjoint and none reads another's output at runtime. A's `init_project_brief.py` accepts **both** the old and new brief-template names precisely so it does not have to wait for C.
2. **D waits for B and C** — `SKILL.md` lists reference and template paths, and the dangling-path check in D's verification fails if `hard-won-rules.md`, `capabilities.md`, `brief.template.md`, `handoff.template.md`, `design-doc.template.md`, `screens.template.md` or `decisions.template.md` are not on disk yet.
3. **E waits for all of A–D** — README/HELP/INSTALACAO enumerate the command files, the CI structure check asserts they exist, and the CHANGELOG describes what actually landed.
4. **The lead integrates and commits** after each slice returns with evidence. Suggested commit boundaries: one per slice, plus a final `chore: v0.3.0` for E.
5. **Review gates:** `/codex:review --wait --base <ref>` per slice as it closes; `/codex:adversarial-review --wait --base <ref>` on the consolidated A+B+C+D+E diff (five writers, touches contracts and enforcement — every trigger in §9.4 fires).

---

# Self-review — spec coverage, section by section

| Spec section | Covered by | Notes |
|---|---|---|
| §1 Objetivo (1) create/adopt | D1 (`enforce`), D5 (`start`) | — |
| §1 (2) direct every UI change | D3 (`build`), D4 (`handoff`) | — |
| §1 (3) verify any executor | D2 (`check`), A5 (`resolveScope`) | All four scopes |
| §1 (4) canonical docs | D1 (design-doc generation), C2/C3 (templates) | — |
| §1 (5) agents can ask | B2 (`capabilities.md`), D4 (`help`) | — |
| §2 Fora de escopo | — | No migration tooling, no inline escape hatch, no phase changes, no marketplace publish. Honoured throughout. |
| §3 Modes/commands table | D1–D5 | Eight commands; `guard`/`patrol` kept as aliases per **§13.6**, overriding §3's "são removidos" |
| §3.1 Three doors | B2, C5 (`AGENTS.md`), D6 (SKILL description) | — |
| §4 `docs/design/` structure | A1 (path resolution), D1 (generation), D6 (SKILL section), C5 | — |
| §4 Compatibility/fallback | A1, A8, D2, D5 | Plus the "both exist → fail" ruling |
| §5 Manifest v2 | A2 (normalization + template), A3 (ingest) | `schemaVersion: 2`, all six new fields |
| §5 ingest extraction rules | A3 | `--text-*`/`--font-*`, `--z-*`, `--bp-*`/`--breakpoint-*`, feedback, i18n detection, states/a11y from config only |
| §6 Lint rules | A4 | New rule via lexer per **§13.3**; no z-index/typography regex rules |
| §7 tokens-engineer | B3 | feedback, zIndex, breakpoints, typography, `contrast.md`, preview |
| §7 component-builder | B4 | states, i18n, halt-and-ask, hard-won-rules |
| §7 design-enforcer | B5 | checks 6–10, scope-aware; check 9/10 amended by **§13.3** |
| §7 design-critic | B6 | "everything is a card", "one surface everywhere" |
| §8 brief template | C1 | rename + voice + governance header |
| §8 design-doc template | C2 | ten sections + history |
| §8 screens/decisions | C3 | — |
| §8 AGENTS.md template | C5 | — |
| §8 CI a11y job | A8 | `design-a11y`, gated on `STEVE_A11Y_URL` |
| §8 handoff template | C4 | renamed, tool-agnostic |
| §9 hard-won-rules | B1 | eleven rules |
| §9 capabilities | B2 | — |
| §9 playbooks updated | D6 | governance, orchestration, phase |
| §10 README/HELP/CHANGELOG/versions | E1, E2, E4, E5 | plus INSTALACAO/CONTRIBUTING/install.sh in E3 |
| §11 Verification | Per-task Tier lines + slice verification blocks | Plus E5 makes CI actually run the tests |
| §12 Risks | E4 (CHANGELOG), D4 (`help`), A1 (fallback), A4 (i18n-gated rule) | — |
| **§13.1** path resolution | A1 | all five readers/writers + hook + templates |
| **§13.2** v2 normalization | A2, A6, A7 | v1/v2/mixed tested |
| **§13.3** lexer rule | A4, A6 | conservative bail-out tested |
| **§13.4** `resolveScope` | A5, A7 | fail-closed tested |
| **§13.5** `--pr` | A5 | `gh pr view`, `HEAD == headRefOid`, no implicit checkout |
| **§13.6** deprecated aliases | D1, D2, B2, E2, E4 | `guard.md`/`patrol.md` kept |

---

# Verification tier per task

| Task | Tier | Evidence required |
|---|---|---|
| A1 path resolver | 1 | covered by A6 (both-exist throws) and A7 (`--manifest` writes under `docs/design/`) |
| A2 v2 normalization | 1 | A6 v2/feedback/mixed cases + A7 `allowedHex` case |
| A3 ingest extraction | 1 | A7: feedback/typography/z/breakpoints/i18n/voice + v1 regression case |
| A4 lexer rule | 1 | A6: 6 cases (flag, clean, disabled, test-file excluded, mask unit, ambiguous bail) |
| A5 resolveScope | 1 | A7 CLI: `--commit` blocks, invalid rev exits 2, exclusive flags exit 2 |
| A6/A7 test extension | 1 | both suites green: `node --test …` and `python3 scripts/test_ingest.py` |
| A8 hook/templates | 0 | `bash -n` on both shell files; YAML parses; one real `design_lint.mjs` run against a fixture |
| B1–B6 | 0 | frontmatter intact on all four agents; both new reference files exist; `check_arsenal.sh` runs |
| C1–C6 | 0 | template files present under the new names, old names gone; `mcp.json.template` parses as JSON; `init_project_brief.py` smoke run creates `docs/design/brief.md` |
| D1–D6 | 0 | all 10 command files have `description:` frontmatter; `hooks.json` parses; zero dangling reference/template paths in `SKILL.md` |
| E1–E5 | 0 | both plugin manifests at 0.3.0; `bash -n install.sh` + `--help`; the full test suite green through the new CI step |

No task uses TDD. No task creates a test file. No task chases coverage.

---

# Open questions

Recorded in `.omc/plans/open-questions.md` as well:

- [ ] **Should `docs/design/contrast.md` be generated by `enforce`, or only by Creation Phase 4?** §7 assigns it to `tokens-engineer` (Creation). A brownfield repo governed by `enforce` never runs `tokens-engineer`, so it would have a design doc §7 pointing at a file that does not exist. Plan assumes: `enforce` writes a `contrast.md` stub listing the pairs it can compute from the manifest, and says so. **Confirm with the decisor.**
- [ ] **Does `role` ever get detected?** §5 says component `states`/`a11y` come only from config, but is silent on color `role`. The plan assumes `role` is likewise manual/config-only, which makes `design-enforcer` check 7 inert on a freshly ingested repo. **Confirm.**
- [ ] **Is `commands/help.md` the right home, given `--help` collisions?** Not a blocker; noted for the record.
