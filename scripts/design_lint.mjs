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
