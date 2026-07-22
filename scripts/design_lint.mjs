#!/usr/bin/env node
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

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

// Any `import { ... } from "<specifier>"`. The specifier is filtered against the
// design-system matcher (built from the manifest) so this works for both the
// greenfield `.../components/ui/...` convention and package specifiers (@scope/ui).
const IMPORT_RE = /import\s*(?:type\s*)?\{([^}]+)\}\s*from\s*["']([^"']+)["']/g;
// Legacy fallback for manifests generated before dsImportPrefixes existed.
const LEGACY_UI_PATH_RE = /^[^"']*\/components\/ui\/[^"']+$/;

// Turn a glob-ish prefix ("@vinci/ui", "@vinci/ui/*", "*/components/ui/*") into a
// regex that matches a full import specifier.
function prefixToRegex(prefix) {
  const escaped = prefix.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  return new RegExp("^" + escaped.replace(/\*/g, "[^\"']*") + "$");
}

function makeDsImportMatcher(manifest) {
  const prefixes = manifest.dsImportPrefixes || [];
  if (prefixes.length > 0) {
    const res = prefixes.map(prefixToRegex);
    return (spec) => res.some(re => re.test(spec));
  }
  // No prefixes declared → legacy behavior (greenfield components/ui/ paths).
  return (spec) => LEGACY_UI_PATH_RE.test(spec);
}

function ruleNoUnknownComponent(file, src, manifest) {
  const known = new Set((manifest.components || []).map(c => c.name));
  // Only enforce when the project actually exposes a component whitelist.
  if (known.size === 0) return [];
  const isDsImport = makeDsImportMatcher(manifest);
  const out = [];
  src.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(IMPORT_RE)) {
      const spec = m[2];
      if (!isDsImport(spec)) continue;
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

export function lintFiles(files, manifestPath) {
  const manifest = loadManifest(manifestPath);
  const violations = [];
  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    violations.push(...ruleNoHardcodedHex(file, src, manifest));
    violations.push(...ruleNoOffScaleSpacing(file, src, manifest));
    violations.push(...ruleNoUnknownComponent(file, src, manifest));
  }
  return violations;
}

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
  const run = (cmd) => {
    try { return execSync(cmd, { encoding: "utf8" }); }
    catch { return ""; }
  };
  // Working tree = staged + unstaged + untracked. Looking only at the staged
  // diff gives a false "clean" when real work sits unstaged in the tree.
  const sources = [
    run("git diff --cached --name-only --diff-filter=ACM"), // staged
    run("git diff --name-only --diff-filter=ACM"),          // unstaged (tracked)
    run("git ls-files --others --exclude-standard"),        // untracked
  ];
  const set = new Set(
    sources.flatMap(o => o.split("\n").map(s => s.trim()).filter(Boolean))
  );
  return [...set].filter(f => /\.(tsx|jsx|css)$/.test(f) && fs.existsSync(f));
}

function isMain() {
  return process.argv[1] && process.argv[1].endsWith("design_lint.mjs");
}

if (isMain()) {
  const args = parseArgs(process.argv.slice(2));
  const files = args.changed ? changedFiles() : args.files;
  if (files.length === 0) {
    const scope = args.changed ? " in the working tree (staged + unstaged + untracked)" : "";
    console.log(`design-lint: no UI files to check${scope} — clean.`);
    process.exit(0);
  }
  const violations = lintFiles(files, args.manifest);
  if (violations.length === 0) { console.log(`design-lint: ${files.length} file(s) clean.`); process.exit(0); }
  for (const v of violations) {
    console.error(`${v.severity.toUpperCase()} ${v.file}:${v.line} [${v.rule}] ${v.message}`);
  }
  console.error(`\ndesign-lint: ${violations.length} violation(s). Build blocked.`);
  process.exit(1);
}
