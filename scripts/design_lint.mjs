#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
export const LINT_VERSION = "0.3.0";
export const MANIFEST_NEW = "docs/design/manifest.json";
export const MANIFEST_LEGACY = "design-system-manifest.json";
export class SteveError extends Error {}
export class ScopeError extends SteveError {}

export function resolveArtifactPath({ explicit, newPath, legacyPath, root = ".", kind = "manifest" }) {
  if (explicit) return path.resolve(root, explicit);
  const modern = path.resolve(root, newPath), legacy = path.resolve(root, legacyPath);
  const hasModern = fs.existsSync(modern), hasLegacy = fs.existsSync(legacy);
  if (hasModern && hasLegacy) throw new SteveError(`Two ${kind} files exist: "${newPath}" and "${legacyPath}". Steve will not guess which one is authoritative. Delete or merge one, or pass --manifest explicitly. Run /steve-designer:enforce to migrate the legacy manifest into docs/design/, or pass --manifest explicitly.`);
  return hasModern ? modern : hasLegacy ? legacy : modern;
}
export function resolveManifestPath(explicit, root = ".") {
  return resolveArtifactPath({ explicit, newPath: MANIFEST_NEW, legacyPath: MANIFEST_LEGACY, root, kind: "manifest" });
}
export function loadManifest(manifestPath) { return JSON.parse(fs.readFileSync(manifestPath, "utf8")); }

export const TOKEN_ROLES = ["background", "surface", "text", "accent", "border", "ring", "brand"];
export function colorValue(entry) { return entry && typeof entry === "object" && !Array.isArray(entry) ? entry.value : entry; }
export function colorRole(entry) { return entry && typeof entry === "object" && typeof entry.role === "string" ? entry.role : null; }
export function allowedHexSet(manifest) {
  const allowed = new Set((manifest.allowedHex || []).map(hex => hex.toLowerCase()));
  const add = value => { if (typeof value === "string") for (const match of value.matchAll(HEX_RE)) allowed.add(match[0].toLowerCase()); };
  for (const entry of Object.values(manifest.tokens?.color || {})) add(colorValue(entry));
  for (const group of Object.values(manifest.tokens?.feedback || {})) {
    if (group && typeof group === "object") for (const value of Object.values(group)) add(value);
    else add(group);
  }
  return allowed;
}

function ruleNoHardcodedHex(file, src, manifest) {
  const allowed = allowedHexSet(manifest), out = [];
  src.split("\n").forEach((line, i) => {
    for (const match of line.matchAll(HEX_RE)) if (!allowed.has(match[0].toLowerCase())) {
      out.push({ rule: "no-hardcoded-hex", file, line: i + 1, severity: "error", message: `Hardcoded color ${match[0]} is not in the token system. Use a token (var(--color-*)).` });
    }
  });
  return out;
}
const ARBITRARY_SPACE_RE = /\b[pm][trblxy]?-\[(\d+)px\]/g;
function ruleNoOffScaleSpacing(file, src, manifest) {
  const scalePx = new Set(Object.values(manifest.tokens?.spacing || {})), out = [];
  src.split("\n").forEach((line, i) => {
    for (const match of line.matchAll(ARBITRARY_SPACE_RE)) {
      const px = `${match[1]}px`;
      if (!scalePx.has(px)) out.push({ rule: "no-off-scale-spacing", file, line: i + 1, severity: "error", message: `Spacing ${px} is off the scale. Use a spacing token or a scale step.` });
    }
  });
  return out;
}

const IMPORT_RE = /\bimport\s*(type\s+)?([\s\S]*?)\s+from\s*["']([^"']+)["']/g;
const LEGACY_UI_PATH_RE = /^[^"']*\/components\/ui\/[^"']+$/;
function prefixToRegex(prefix) { return new RegExp("^" + prefix.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^\"']*") + "$"); }
function makeDsImportMatcher(manifest) {
  const prefixes = manifest.dsImportPrefixes || [];
  if (!prefixes.length) return specifier => LEGACY_UI_PATH_RE.test(specifier);
  const patterns = prefixes.map(prefixToRegex);
  return specifier => patterns.some(pattern => pattern.test(specifier));
}
function normalizeImportPath(value) {
  return String(value).replace(/\/(?:index)(?:\.[jt]sx?)?$/, "").replace(/\/$/, "");
}
function parseImportBindings(bindings, typeOnly) {
  if (typeOnly) return { named: [], namespaces: [], defaults: [] };
  const named = [], namespaces = [], defaults = [];
  const namedMatch = bindings.match(/\{([\s\S]*?)\}/);
  if (namedMatch) {
    for (const item of namedMatch[1].split(",")) {
      const value = item.trim();
      if (!value || value.startsWith("type ")) continue;
      const [exported, local = exported] = value.split(/\s+as\s+/).map(part => part.trim());
      if (exported === "default") defaults.push(local);
      else named.push({ exported, local });
    }
  }
  const namespace = bindings.match(/\*\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
  if (namespace) namespaces.push(namespace[1]);
  const beforeNamed = bindings.split("{")[0].trim().replace(/,$/, "");
  if (beforeNamed && !beforeNamed.startsWith("*")) defaults.push(beforeNamed);
  return { named, namespaces, defaults };
}
function unknownComponentFinding(file, src, index, name) {
  return {
    rule: "no-unknown-component", file, line: lineOf(src, index), severity: "error",
    message: `Component ${name} is not in the design-system inventory. Add it via the DS or use an existing component.`,
  };
}
function ruleNoUnknownComponent(file, src, manifest) {
  const known = new Set((manifest.components || []).map(component => component.name));
  if (!known.size) return [];
  const isDsImport = makeDsImportMatcher(manifest), out = [];
  for (const match of src.matchAll(IMPORT_RE)) {
    const [, typeOnly, bindings, specifier] = match;
    if (!isDsImport(specifier)) continue;
    const parsed = parseImportBindings(bindings, Boolean(typeOnly));
    for (const { exported } of parsed.named) {
      if (/^[A-Z]/.test(exported) && !known.has(exported)) out.push(unknownComponentFinding(file, src, match.index, exported));
    }
    const hasDefaultInventory = (manifest.components || []).some(component => normalizeImportPath(component.import) === normalizeImportPath(specifier));
    if (!hasDefaultInventory) {
      for (const _binding of parsed.defaults) out.push({
        rule: "no-unknown-component", file, line: lineOf(src, match.index), severity: "error",
        message: `default import from ${specifier} does not match any inventory entry`,
      });
    }
    for (const namespace of parsed.namespaces) {
      const namespaceUse = new RegExp(`<\\s*${namespace.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.([A-Za-z_$][A-Za-z0-9_$]*)`, "g");
      for (const use of src.matchAll(namespaceUse)) {
        const name = use[1];
        if (!known.has(name)) out.push(unknownComponentFinding(file, src, use.index, name));
      }
    }
  }
  return out;
}

const I18N_ATTRS = new Set(["placeholder", "title", "aria-label", "alt"]);
const HAS_WORD_RE = /\p{L}{2,}/u;
const SKIP_FILE_RE = /\.(test|spec|stories)\.[jt]sx?$/;
function previousJsToken(src, index) {
  let i = index - 1;
  while (i >= 0) {
    while (i >= 0 && /\s/.test(src[i])) {
      if (src[i] === "\n") return "start";
      i--;
    }
    if (i >= 1 && src[i] === "/" && src[i - 1] === "*") {
      i -= 2;
      while (i >= 1 && !(src[i - 1] === "/" && src[i] === "*")) i--;
      if (i < 1) return null;
      i -= 2;
      continue;
    }
    break;
  }
  if (i < 0 || src[i] === "\n") return "start";
  const pair = src.slice(i - 1, i + 1);
  if (["=>", "&&", "||", "??"].includes(pair)) return pair;
  if ("=(:,?[]{};!".includes(src[i])) return src[i];
  if (/[A-Za-z_$]/.test(src[i])) {
    let start = i;
    while (start >= 0 && /[A-Za-z0-9_$]/.test(src[start])) start--;
    return src.slice(start + 1, i + 1);
  }
  return src[i];
}
function canStartJsxInJs(src, index) {
  return new Set(["start", "=", "(", ",", "?", ":", "[", "{", "}", ";", "=>", "&&", "||", "??", "!", "return", "default", "yield", "case"]).has(previousJsToken(src, index));
}
function startsJsxTag(src, index, inJs = false) {
  if (src[index] !== "<") return false;
  const next = src[index + 1];
  if (next === "/") return !inJs && /[A-Za-z_$>]/.test(src[index + 2]);
  if (!/[A-Za-z_$>]/.test(next)) return false;
  return !inJs || canStartJsxInJs(src, index);
}
function isTsGenericArrow(src, index) {
  if (src[index] !== "<" || !/[A-Za-z_$]/.test(src[index + 1])) return false;
  let i = index + 1;
  while (i < src.length && /[A-Za-z0-9_$]/.test(src[i])) i++;
  while (i < src.length && /\s/.test(src[i])) i++;
  if (src[i] === ",") return true;
  if (src.startsWith("extends", i) && !/[A-Za-z0-9_$]/.test(src[i + 7])) return true;
  if (src[i] !== ">") return false;
  i++;
  while (i < src.length && /\s/.test(src[i])) i++;
  return src[i] === "(";
}
function skipQuoted(src, index) {
  const quote = src[index++];
  while (index < src.length) {
    if (src[index] === "\\") { index += 2; continue; }
    if (src[index] === quote) return index + 1;
    if (src[index] === "\n" && quote !== "`") return -1;
    index++;
  }
  return -1;
}
function isRegexStart(src, index) {
  if (src[index] !== "/" || src[index + 1] === "/" || src[index + 1] === "*") return false;
  let previous = index - 1;
  while (previous >= 0 && /\s/.test(src[previous])) previous--;
  if (previous < 0 || "=(,:[!&|?{};".includes(src[previous])) return true;
  return /\breturn$/.test(src.slice(0, previous + 1));
}
function skipRegex(src, index) {
  let inClass = false;
  for (let i = index + 1; i < src.length; i++) {
    if (src[i] === "\\") { i++; continue; }
    if (src[i] === "\n") return -1;
    if (src[i] === "[") inClass = true;
    else if (src[i] === "]") inClass = false;
    else if (src[i] === "/" && !inClass) {
      i++;
      while (i < src.length && /[A-Za-z]/.test(src[i])) i++;
      return i;
    }
  }
  return -1;
}

// Mask JS comments/strings while preserving JSX bodies and quoted JSX attrs.
// Quotes in body text (including Don't) are text, never a string delimiter.
export function maskNonCode(src) {
  const out = src.split("");
  const blank = index => { if (out[index] !== "\n") out[index] = " "; };
  let i = 0, inTag = false, tagStart = -1, tagBraceDepth = 0, expressionDepth = 0;
  const tagContexts = [];
  const maskCommentOrString = () => {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { while (i < src.length && src[i] !== "\n") blank(i++); return true; }
    if (c === "/" && d === "*") {
      blank(i++); blank(i++);
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) blank(i++);
      if (i >= src.length) return false;
      blank(i++); blank(i++); return true;
    }
    if (c === "/" && isRegexStart(src, i)) {
      const end = skipRegex(src, i);
      if (end < 0) return false;
      while (i < end) blank(i++);
      return true;
    }
    if (c !== "'" && c !== '"' && c !== "`") return null;
    const quote = c; blank(i++); let closed = false;
    while (i < src.length) {
      if (src[i] === "\\") { blank(i++); if (i < src.length) blank(i++); continue; }
      if (src[i] === quote) { blank(i++); closed = true; break; }
      if (src[i] === "\n" && quote !== "`") break;
      blank(i++);
    }
    return closed;
  };
  while (i < src.length) {
    if (inTag) {
      const c = src[i];
      if (tagBraceDepth > 0) {
        const masked = maskCommentOrString();
        if (masked === false) return { masked: out.join(""), ok: false };
        if (masked) continue;
        if (c === "{") tagBraceDepth++; else if (c === "}") tagBraceDepth--;
        i++; continue;
      }
      if (c === '"' || c === "'") { const end = skipQuoted(src, i); if (end < 0) return { masked: out.join(""), ok: false }; i = end; continue; }
      if (c === "{") { tagBraceDepth = 1; i++; continue; }
      if (c === ">") {
        let previous = i - 1; while (previous >= 0 && /\s/.test(src[previous])) previous--;
        if (src[tagStart + 1] === "/") tagContexts.pop();
        else if (src[previous] !== "/") tagContexts.push(expressionDepth);
        inTag = false; tagStart = -1; i++; continue;
      }
      i++; continue;
    }
    const inJsExpression = expressionDepth > 0 && tagContexts.at(-1) !== expressionDepth;
    if (inJsExpression) {
      if (startsJsxTag(src, i, true) && !isTsGenericArrow(src, i)) { inTag = true; tagStart = i; i++; continue; }
      const masked = maskCommentOrString();
      if (masked === false) return { masked: out.join(""), ok: false };
      if (masked) continue;
      if (src[i] === "{") expressionDepth++; else if (src[i] === "}") expressionDepth--;
      i++; continue;
    }
    if (tagContexts.length > 0) {
      if (startsJsxTag(src, i)) { inTag = true; tagStart = i; i++; continue; }
      if (src[i] === "{") { expressionDepth++; i++; continue; }
      i++; continue;
    }
    if (startsJsxTag(src, i, true) && !isTsGenericArrow(src, i)) { inTag = true; tagStart = i; i++; continue; }
    const masked = maskCommentOrString();
    if (masked === false) return { masked: out.join(""), ok: false };
    if (masked) continue;
    i++;
  }
  return { masked: out.join(""), ok: !inTag };
}

function pushText(findings, src, from, to) {
  const raw = src.slice(from, to), text = raw.trim();
  if (text && HAS_WORD_RE.test(text)) findings.push({ index: from + raw.length - raw.trimStart().length, text, kind: "text" });
}
function findTagEnd(src, from) {
  let i = from + 1, braceDepth = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'") { const end = skipQuoted(src, i); if (end < 0) return -1; i = end; continue; }
    if (c === "{") braceDepth++; else if (c === "}") braceDepth--; else if (c === ">" && braceDepth === 0) return i;
    i++;
  }
  return -1;
}
function staticExpressionLiteral(src, masked, from, to) {
  let start = from;
  while (start < to && /\s/.test(src[start])) start++;
  const quote = src[start];
  if (quote !== "'" && quote !== '"' && quote !== "`") return null;
  const end = skipQuoted(src, start);
  if (end < 0 || end > to) return null;
  for (let i = start + 1; i < end - 1; i++) if (quote === "`" && src[i] === "$" && src[i + 1] === "{") return null;
  for (let i = end; i < to; i++) if (!/\s/.test(src[i])) return null;
  const text = src.slice(start + 1, end - 1);
  return HAS_WORD_RE.test(text) ? { index: start + 1, text, kind: "expression" } : null;
}
function attrFindings(src, masked, from, to) {
  const found = [];
  let i = from + 1;
  if (src[i] === "/") i++;
  while (i < to && !/\s/.test(src[i]) && src[i] !== "/") i++;
  while (i < to) {
    while (i < to && /\s/.test(src[i])) i++;
    if (i >= to || src[i] === "/") break;
    const nameStart = i;
    while (i < to && /[A-Za-z0-9:-]/.test(src[i])) i++;
    const name = src.slice(nameStart, i);
    if (!name) { i++; continue; }
    while (i < to && /\s/.test(src[i])) i++;
    if (src[i] !== "=") continue;
    i++; while (i < to && /\s/.test(src[i])) i++;
    if (src[i] === "{") {
      const expressionEnd = findExpressionEnd(masked, i, to);
      if (expressionEnd < 0) return null;
      const literal = staticExpressionLiteral(src, masked, i + 1, expressionEnd);
      if (I18N_ATTRS.has(name) && literal) found.push({ index: nameStart, text: `${name}=${JSON.stringify(literal.text)}`, kind: "attr" });
      i = expressionEnd + 1;
      continue;
    }
    if (src[i] !== '"' && src[i] !== "'") continue;
    const valueStart = ++i, end = skipQuoted(src, i - 1);
    if (end < 0 || end > to + 1) return null;
    const value = src.slice(valueStart, end - 1);
    if (I18N_ATTRS.has(name) && HAS_WORD_RE.test(value)) found.push({ index: nameStart, text: `${name}=${JSON.stringify(value)}`, kind: "attr" });
    i = end;
  }
  return found;
}
function findExpressionEnd(masked, from, limit) {
  let depth = 1;
  for (let i = from + 1; i < limit; i++) {
    if (masked[i] === "{") depth++;
    else if (masked[i] === "}" && --depth === 0) return i;
  }
  return -1;
}

function scanExpression(src, masked, from, limit) {
  const findings = [];
  for (let i = from; i < limit; i++) {
    if (!startsJsxTag(masked, i, true) || isTsGenericArrow(masked, i)) continue;
    const element = scanJsxElement(src, masked, i, limit);
    if (element === null) return null;
    findings.push(...element.findings);
    i = element.next - 1;
  }
  return findings;
}

function scanJsxElement(src, masked, from, limit) {
  const findings = [];
  let end = findTagEnd(src, from);
  if (end < 0 || end >= limit || src[from + 1] === "/") return null;
  let previous = end - 1;
  while (previous > from && /\s/.test(src[previous])) previous--;
  const selfClosing = src[previous] === "/";
  const attrs = attrFindings(src, masked, from, end);
  if (attrs === null) return null;
  findings.push(...attrs);
  if (selfClosing) return { findings, next: end + 1 };

  let i = end + 1;
  let depth = 1;
  while (i < limit && depth > 0) {
    if (startsJsxTag(masked, i)) {
      end = findTagEnd(src, i);
      if (end < 0 || end >= limit) return null;
      const closing = src[i + 1] === "/";
      previous = end - 1;
      while (previous > i && /\s/.test(src[previous])) previous--;
      if (closing) depth--;
      else {
        const nestedAttrs = attrFindings(src, masked, i, end);
        if (nestedAttrs === null) return null;
        findings.push(...nestedAttrs);
        if (src[previous] !== "/") depth++;
      }
      i = end + 1;
      continue;
    }
    if (src[i] === "{") {
      const expressionEnd = findExpressionEnd(masked, i, limit);
      if (expressionEnd < 0) return null;
      const literal = staticExpressionLiteral(src, masked, i + 1, expressionEnd);
      if (literal) findings.push(literal);
      const nested = scanExpression(src, masked, i + 1, expressionEnd);
      if (nested === null) return null;
      findings.push(...nested);
      i = expressionEnd + 1;
      continue;
    }
    const start = i;
    while (i < limit && src[i] !== "{" && !startsJsxTag(masked, i)) i++;
    pushText(findings, src, start, i);
  }
  return depth === 0 ? { findings, next: i } : null;
}

export function scanJsxLiterals(src) {
  const { masked, ok } = maskNonCode(src);
  if (!ok) return null;
  return scanExpression(src, masked, 0, src.length);
}
function lineOf(src, index) { let line = 1; for (let i = 0; i < index; i++) if (src[i] === "\n") line++; return line; }
function ruleNoLiteralJsxString(file, src, manifest) {
  if (manifest.i18n?.enabled !== true || SKIP_FILE_RE.test(file)) return [];
  const found = scanJsxLiterals(src);
  if (found === null) {
    return [{
      rule: "no-literal-jsx-string", file, line: 1, severity: "warning",
      message: "file could not be scanned for literal strings; review manually",
    }];
  }
  const pattern = manifest.i18n.keyPattern || "<area>.<screen>.<element>";
  return found.map(finding => ({ rule: "no-literal-jsx-string", file, line: lineOf(src, finding.index), severity: "error", message: `Literal UI text ${JSON.stringify(finding.text.slice(0, 60))} — use an i18n key (${pattern}), e.g. {t("...")}.` }));
}

const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
const UI_FILE_RE = /\.(tsx|jsx|css)$/;
function git(args, cwd) {
  const { execFileSync } = require("node:child_process");
  try { return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
  catch (error) { throw new ScopeError(`git ${args.join(" ")} failed: ${(error.stderr || error.message).toString().trim()}`); }
}
function gitNoIndex(args, cwd) {
  const { execFileSync } = require("node:child_process");
  try { return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
  catch (error) {
    if (error.status === 1) return (error.stdout || "").toString();
    throw new ScopeError(`git ${args.join(" ")} failed: ${(error.stderr || error.message).toString().trim()}`);
  }
}
function lines(out) { return out.split("\n").map(line => line.trim()).filter(Boolean); }
function verifyRev(revision, cwd, execGit = git) {
  const out = execGit(["rev-parse", "--verify", "--quiet", `${revision}^{commit}`], cwd).trim();
  if (!out) throw new ScopeError(`Not a valid commit: "${revision}".`);
  return out;
}
function ghPr(number, cwd) {
  const { execFileSync } = require("node:child_process");
  let raw;
  try { raw = execFileSync("gh", ["pr", "view", String(number), "--json", "baseRefOid,headRefOid,number"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
  catch (error) { throw new ScopeError(`gh pr view ${number} failed — install and authenticate the GitHub CLI (gh auth login). Original error: ${(error.stderr || error.message).toString().trim()}`); }
  let data; try { data = JSON.parse(raw); } catch { throw new ScopeError(`gh pr view ${number} returned invalid JSON.`); }
  if (!data.baseRefOid || !data.headRefOid) throw new ScopeError(`PR #${number} has no base/head oid.`);
  return data;
}
export function resolveScope(opts = {}) {
  const cwd = opts.cwd || process.cwd(), picked = ["changed", "commit", "range", "pr"].filter(key => opts[key]);
  const execGit = (args) => opts.gitExec ? opts.gitExec(args, cwd) : git(args, cwd);
  const execNoIndex = (args) => opts.gitNoIndexExec ? opts.gitNoIndexExec(args, cwd) : gitNoIndex(args, cwd);
  if (picked.length > 1) throw new ScopeError(`--${picked.join(" and --")} are mutually exclusive. Pick one scope.`);
  const mode = picked[0] || "changed", filterUi = files => files.filter(file => UI_FILE_RE.test(file));
  if (mode === "changed") {
    const staged = lines(execGit(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]));
    const unstaged = lines(execGit(["diff", "--name-only", "--diff-filter=ACMR"]));
    const untracked = lines(execGit(["ls-files", "--others", "--exclude-standard"]));
    const tracked = filterUi([...new Set([...staged, ...unstaged])]).filter(file => fs.existsSync(path.resolve(cwd, file)));
    const untrackedUi = filterUi(untracked).filter(file => fs.existsSync(path.resolve(cwd, file)));
    const files = [...new Set([...tracked, ...untrackedUi])];
    const trackedDiff = tracked.length ? execGit(["diff", "HEAD", "--", ...tracked]) : "";
    const untrackedDiff = untrackedUi.map(file => execNoIndex(["diff", "--no-index", "--", "/dev/null", file])).join("");
    return { mode, base: "HEAD", head: null, files, diff: trackedDiff + untrackedDiff, readAt: file => fs.readFileSync(path.resolve(cwd, file), "utf8") };
  }
  if (mode === "commit") {
    const head = verifyRev(opts.commit, cwd, execGit), parentOut = execGit(["rev-list", "--parents", "-n", "1", head]).trim().split(/\s+/), base = parentOut[1] || EMPTY_TREE;
    const files = filterUi(lines(execGit(["diff", "--name-only", "--diff-filter=ACMR", base, head])));
    return { mode, base, head, files, diff: files.length ? execGit(["diff", base, head, "--", ...files]) : "", readAt: file => execGit(["show", `${head}:${file}`]) };
  }
  if (mode === "range") {
    const match = String(opts.range).match(/^(.+?)(\.\.\.?)(.+)$/);
    if (!match) throw new ScopeError(`--range expects "<a>..<b>" or "<a>...<b>", got "${opts.range}".`);
    const [, a, separator, b] = match, base = verifyRev(a, cwd, execGit), head = verifyRev(b, cwd, execGit);
    const range = `${base}${separator}${head}`;
    const files = filterUi(lines(execGit(["diff", "--name-only", "--diff-filter=ACMR", range])));
    return { mode, base, head, range: String(opts.range), files, diff: files.length ? execGit(["diff", range, "--", ...files]) : "", readAt: file => execGit(["show", `${head}:${file}`]) };
  }
  const pr = ghPr(opts.pr, cwd), localHead = execGit(["rev-parse", "HEAD"]).trim();
  if (localHead !== pr.headRefOid) throw new ScopeError(`HEAD (${localHead.slice(0, 8)}) is not the head of PR #${pr.number} (${pr.headRefOid.slice(0, 8)}). Steve will not check out for you. Run: git fetch origin ${pr.headRefOid} && git checkout ${pr.headRefOid}`);
  const base = pr.baseRefOid, head = pr.headRefOid, files = filterUi(lines(execGit(["diff", "--name-only", "--diff-filter=ACMR", `${base}..${head}`])));
  return { mode, base, head, files, diff: files.length ? execGit(["diff", `${base}..${head}`, "--", ...files]) : "", readAt: file => execGit(["show", `${head}:${file}`]) };
}

export function lintFiles(files, manifestPath, readAt) {
  const manifest = loadManifest(manifestPath), read = readAt || (file => fs.readFileSync(file, "utf8")), violations = [];
  for (const file of files) {
    const src = read(file);
    violations.push(...ruleNoHardcodedHex(file, src, manifest), ...ruleNoOffScaleSpacing(file, src, manifest), ...ruleNoUnknownComponent(file, src, manifest), ...ruleNoLiteralJsxString(file, src, manifest));
  }
  return violations;
}
function parseArgs(argv) {
  const args = { manifest: null, emitScope: null, files: [], changed: false, commit: null, range: null, pr: null, version: false };
  const valueFor = (flag, index) => {
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new SteveError(`${flag} requires a value.`);
    return value;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--manifest") args.manifest = valueFor(arg, i++);
    else if (arg === "--emit-scope") args.emitScope = valueFor(arg, i++);
    else if (arg === "--changed") args.changed = true;
    else if (arg === "--commit") args.commit = valueFor(arg, i++);
    else if (arg === "--range") args.range = valueFor(arg, i++);
    else if (arg === "--pr") args.pr = valueFor(arg, i++);
    else if (arg === "--version") args.version = true;
    else if (arg.startsWith("--")) throw new SteveError(`Unknown flag: ${arg}.`);
    else args.files.push(arg);
  }
  return args;
}
function isMain() { return process.argv[1] && process.argv[1].endsWith("design_lint.mjs"); }
export function runCli(argv, options = {}) {
  const cwd = options.cwd || process.cwd();
  const write = options.write || (message => console.log(message));
  const writeError = options.writeError || (message => console.error(message));
  const scopeResolver = options.scopeResolver || resolveScope;
  try {
    const args = parseArgs(argv);
    if (args.version) { write(`design-lint ${LINT_VERSION}`); return 0; }
    const scoped = args.changed || args.commit || args.range || args.pr;
    const manifestPath = resolveManifestPath(args.manifest, cwd);
    if (!fs.existsSync(manifestPath)) throw new SteveError(`no manifest at ${manifestPath} — run /steve-designer:enforce first.`);
    const scope = scoped || args.emitScope ? scopeResolver({ ...args, cwd }) : null, files = scope ? scope.files : args.files;
    if (args.emitScope) {
      const output = path.resolve(cwd, args.emitScope);
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, `${JSON.stringify({ mode: scope.mode, base: scope.base, head: scope.head, range: scope.range || null, files: scope.files, diff: scope.diff, manifest: manifestPath, lintVersion: LINT_VERSION }, null, 2)}\n`);
    }
    if (!files.length) { write("design-lint: no UI files to check in scope — clean."); return 0; }
    const violations = lintFiles(files, manifestPath, scope?.readAt || options.readAt);
    if (!violations.length) { write(`design-lint: ${files.length} file(s) clean.`); return 0; }
    for (const violation of violations) writeError(`${violation.severity.toUpperCase()} ${violation.file}:${violation.line} [${violation.rule}] ${violation.message}`);
    const errors = violations.filter(violation => violation.severity !== "warning");
    const warnings = violations.length - errors.length;
    if (!errors.length) { write(`design-lint: ${files.length} file(s) clean (${warnings} warning(s)).`); return 0; }
    writeError(`\ndesign-lint: ${errors.length} violation(s). Build blocked.`); return 1;
  } catch (error) {
    writeError(`design-lint: ${error.message}`);
    return 2;
  }
}
if (isMain()) process.exit(runCli(process.argv.slice(2)));
