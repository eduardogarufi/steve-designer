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

export function lintFiles(files, manifestPath) {
  const manifest = loadManifest(manifestPath);
  const violations = [];
  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    violations.push(...ruleNoHardcodedHex(file, src, manifest));
    violations.push(...ruleNoOffScaleSpacing(file, src, manifest));
  }
  return violations;
}
