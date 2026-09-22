#!/usr/bin/env node
//
// build_dist.mjs — renders the Kilo and Codex distribution bundles from the
// single portable source in skills/steve-designer/.
//
// The Claude Code adapter (.claude-plugin/, commands/, agents/, hooks/) stays at
// the repository root because the plugin layout is fixed by convention. This
// script produces the equivalent bundles for the other CLIs:
//
//   dist/kilo/    skills/steve-designer/** (incl. commands/) + command/steve-*.md
//                 + agent/steve-*.md + kilo.json
//   dist/codex/   .agents/skills/steve-designer/** (incl. commands/)
//                 + .codex/agents/steve_*.toml + .codex/mcp.toml + .codex/hooks.json
//
// Two invariants matter, and both are enforced by tests:
//
//   1. No `${CLAUDE_PLUGIN_ROOT}` may survive into a bundle.
//   2. References must be *anchored*, never bare. A generated command runs with the
//      governed project as its working directory, so a bare `scripts/foo.py` would
//      resolve against the project, not against the installed skill. Skill-owned
//      resources therefore become `<STEVE_SKILL_DIR>/...`, and install.sh replaces
//      that token with the real absolute skill directory at install time.
//
//      The one deliberate exception is `scripts/design_lint.mjs`: that file is
//      *vendored into the governed project* by `enforce`, so references to it must
//      stay project-relative. It is excluded from anchoring by name.
//
// Usage: node scripts/build_dist.mjs [--out dist]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
export const SKILL_NAME = "steve-designer";
const SKILL_SRC = path.join(REPO_ROOT, "skills", SKILL_NAME);
const COMMANDS_SRC = path.join(REPO_ROOT, "commands");
const AGENTS_SRC = path.join(REPO_ROOT, "agents");
const ADAPTERS_SRC = path.join(REPO_ROOT, "adapters");

/** Token install.sh replaces with the absolute installed skill directory. */
export const SKILL_DIR_TOKEN = "<STEVE_SKILL_DIR>";

// Directories and files that must never ship inside a bundle.
const SKIP_DIR_NAMES = new Set([".omc", "__pycache__", ".git", "node_modules", "fixtures"]);
const SKIP_FILE_NAMES = new Set(["test_ingest.py"]);
const SKIP_FILE_SUFFIXES = [".test.mjs"];

// Sandbox policy per agent, in Codex terms.
export const AGENT_SANDBOX = {
  "tokens-engineer": "workspace-write",
  "component-builder": "workspace-write",
  "design-critic": "read-only",
  "design-enforcer": "read-only",
};

const AGENT_NAMES = Object.keys(AGENT_SANDBOX);

// Commands that ship to the other CLIs. The deprecated `guard`/`patrol` aliases were
// removed in 0.4.0 and are not re-created outside Claude Code.
const COMMAND_NAMES = [
  "start",
  "resume",
  "enforce",
  "check",
  "build",
  "handoff",
  "arsenal",
  "help",
];

// Scripts that live in the installed skill and must be anchored to it.
const SKILL_SCRIPTS = [
  "check_arsenal.sh",
  "ingest_design_system.py",
  "init_project_brief.py",
  "start_preview.sh",
  "hook_design_lint.sh",
  "steve_paths.py",
];

// ---------------------------------------------------------------------------
// Path translation
// ---------------------------------------------------------------------------

const CLAUDE_ROOT = "\\$\\{CLAUDE_PLUGIN_ROOT\\}";

const RE_SKILL_ABS = new RegExp(`${CLAUDE_ROOT}/skills/${SKILL_NAME}/`, "g");
const RE_SCRIPTS_ABS = new RegExp(`${CLAUDE_ROOT}/scripts/`, "g");
const RE_TEMPLATES_ABS = new RegExp(`${CLAUDE_ROOT}/templates/`, "g");
const RE_CMD_ABS = new RegExp(`${CLAUDE_ROOT}/commands/([a-z]+)\\.md`, "g");
const RE_AGENT_ABS = new RegExp(`${CLAUDE_ROOT}/agents/([a-z-]+)\\.md`, "g");
const RE_SKILL_REL = new RegExp(`(?<![/\\w])skills/${SKILL_NAME}/`, "g");
// `(?<!STEVE_SKILL_DIR>/)` stops an already-anchored path from being anchored twice;
// `(?<![\w-])` keeps `my-scripts/x` out while still catching `./scripts/x`.
const NOT_ANCHORED = "(?<!STEVE_SKILL_DIR>/)(?<![\\w-])";
const RE_SCRIPT_REL = new RegExp(
  `${NOT_ANCHORED}scripts/(${SKILL_SCRIPTS.map((s) => s.replace(/\./g, "\\.")).join("|")})`,
  "g",
);
const RE_TEMPLATE_REL = new RegExp(
  `${NOT_ANCHORED}templates/([A-Za-z0-9_.-]+\\.(?:md|sh|yml|json|toml))`,
  "g",
);
const RE_REFERENCE_REL = new RegExp(`${NOT_ANCHORED}references/([a-z0-9-]+\\.md)`, "g");
const RE_CMD_REL = new RegExp(
  `${NOT_ANCHORED}commands/(${COMMAND_NAMES.join("|")})\\.md`,
  "g",
);
const RE_AGENT_REL = new RegExp(`${NOT_ANCHORED}agents/(${AGENT_NAMES.join("|")})\\.md`, "g");
const RE_CLI_INVOCATION = /\/steve-designer:([a-z]+)/g;
// The arsenal is pinned to the target CLI. Only a standalone `--cli claude`
// argument is rewritten, so prose like `--cli claude|kilo|codex` is left alone.
const RE_ARSENAL_CLI = /--cli claude(?=[\s`]|$)/g;

export function agentName(name, target) {
  return target === "codex" ? `steve_${name.replace(/-/g, "_")}` : `steve-${name}`;
}

export function commandName(name) {
  return `steve-${name}`;
}

/** How a user invokes a command in each CLI. */
export function invocation(name, target) {
  if (target === "codex") return `$steve-designer ${name}`;
  if (target === "kilo") return `/${commandName(name)}`;
  return `/steve-designer:${name}`;
}

/**
 * Rewrites Claude-Code-specific and bare paths into anchored, CLI-neutral ones.
 * Throws if a `${CLAUDE_PLUGIN_ROOT}` reference survives, so a bundle can never
 * silently ship a broken path.
 */
export function portable(text, target, source = "<memory>") {
  const out = text
    // Absolute skill-owned references.
    .replace(RE_SKILL_ABS, `${SKILL_DIR_TOKEN}/`)
    .replace(RE_SCRIPTS_ABS, `${SKILL_DIR_TOKEN}/scripts/`)
    .replace(RE_TEMPLATES_ABS, `${SKILL_DIR_TOKEN}/templates/`)
    .replace(RE_CMD_ABS, (_m, name) => `${SKILL_DIR_TOKEN}/commands/${name}.md`)
    .replace(RE_AGENT_ABS, (_m, name) => agentName(name, target))
    // Bare skill-owned references (agents read these from a project cwd).
    .replace(RE_SKILL_REL, `${SKILL_DIR_TOKEN}/`)
    .replace(RE_SCRIPT_REL, (_m, script) => `${SKILL_DIR_TOKEN}/scripts/${script}`)
    .replace(RE_TEMPLATE_REL, (_m, file) => `${SKILL_DIR_TOKEN}/templates/${file}`)
    .replace(RE_REFERENCE_REL, (_m, file) => `${SKILL_DIR_TOKEN}/references/${file}`)
    .replace(RE_CMD_REL, (_m, name) => `${SKILL_DIR_TOKEN}/commands/${name}.md`)
    .replace(RE_AGENT_REL, (_m, name) => agentName(name, target))
    // Invocations, and the arsenal's CLI pin.
    .replace(RE_CLI_INVOCATION, (_m, name) => invocation(name, target))
    .replace(RE_ARSENAL_CLI, `--cli ${target}`);

  if (out.includes("CLAUDE_PLUGIN_ROOT")) {
    throw new Error(`unresolved CLAUDE_PLUGIN_ROOT in ${source}`);
  }
  return out;
}

/** Renders the thin per-CLI command file that dispatches into the installed skill. */
export function renderDispatcher(name, description, target) {
  const workflow = `${SKILL_DIR_TOKEN}/commands/${name}.md`;
  const body = [
    `Load the \`${SKILL_NAME}\` skill and execute its **${name}** workflow, defined in`,
    `\`${workflow}\`.`,
    "",
    `The skill's own resources (its scripts, references and templates) are addressed with`,
    `absolute \`${SKILL_DIR_TOKEN}/...\` paths — use them as written. Project paths such as`,
    "`docs/design/`, `.steve/`, `AGENTS.md` and the vendored `scripts/design_lint.mjs`",
    "stay relative to the governed project.",
    "",
    "Pass any user arguments through to the workflow unchanged.",
    "",
  ].join("\n");
  return `${frontmatterBlock({ description })}\n${body}`;
}

// ---------------------------------------------------------------------------
// Markdown / TOML helpers
// ---------------------------------------------------------------------------

export function splitFrontmatter(markdown) {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(markdown);
  if (!match) return { data: {}, body: markdown };
  const data = {};
  for (const line of match[1].split("\n")) {
    const index = line.indexOf(":");
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }
  return { data, body: markdown.slice(match[0].length) };
}

function yamlString(value) {
  // Always quote: command descriptions contain colons, backticks, and em dashes.
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function frontmatterBlock(pairs) {
  const lines = Object.entries(pairs)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}: ${yamlString(value)}`);
  return `---\n${lines.join("\n")}\n---\n`;
}

function tomlString(value) {
  // A JSON string literal is a valid TOML basic string for our content.
  return JSON.stringify(value);
}

export function renderKiloAgent(name, source) {
  const { data, body } = splitFrontmatter(source);
  return `${frontmatterBlock({
    description: portable(
      data.description || `${SKILL_NAME} ${name} subagent`,
      "kilo",
      `agent ${name} description`,
    ),
    mode: "subagent",
  })}\n${portable(body, "kilo", `agent ${name}`).trimStart()}`;
}

export function renderCodexAgent(name, source) {
  const { data, body } = splitFrontmatter(source);
  const instructions = portable(body, "codex", `agent ${name}`).trim();
  const description = portable(
    data.description || `${SKILL_NAME} ${name} subagent`,
    "codex",
    `agent ${name} description`,
  );
  return [
    `name = ${tomlString(agentName(name, "codex"))}`,
    `description = ${tomlString(description)}`,
    `sandbox_mode = ${tomlString(AGENT_SANDBOX[name] || "workspace-write")}`,
    `developer_instructions = ${tomlString(instructions)}`,
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Filesystem helpers
// ---------------------------------------------------------------------------

function shouldSkip(relativePath) {
  const parts = relativePath.split(path.sep);
  if (parts.some((part) => SKIP_DIR_NAMES.has(part))) return true;
  const base = parts[parts.length - 1];
  if (SKIP_FILE_NAMES.has(base)) return true;
  return SKIP_FILE_SUFFIXES.some((suffix) => base.endsWith(suffix));
}

function walk(dir, prefix = "") {
  const entries = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const relative = prefix ? path.join(prefix, entry.name) : entry.name;
    if (shouldSkip(relative)) continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) entries.push(...walk(absolute, relative));
    else if (entry.isFile()) entries.push({ relative, absolute });
  }
  return entries;
}

function writeFile(target, contents, mode) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
  if (mode !== undefined) fs.chmodSync(target, mode);
}

function copyPortableFile(source, destination, target) {
  const stat = fs.statSync(source);
  const contents = portable(
    fs.readFileSync(source, "utf8"),
    target,
    path.relative(REPO_ROOT, source),
  );
  writeFile(destination, contents, stat.mode & 0o777);
}

function copyAdapterFile(source, destination, target) {
  const stat = fs.statSync(source);
  const contents = portable(
    fs.readFileSync(source, "utf8"),
    target,
    path.relative(REPO_ROOT, source),
  );
  writeFile(destination, contents, stat.mode & 0o777);
}

function copySkillTree(destination, target) {
  for (const { relative, absolute } of walk(SKILL_SRC)) {
    copyPortableFile(absolute, path.join(destination, relative), target);
  }
  // The command workflows are part of the portable skill: the generated per-CLI
  // command files are thin dispatchers into them.
  for (const name of COMMAND_NAMES) {
    const source = path.join(COMMANDS_SRC, `${name}.md`);
    if (!fs.existsSync(source)) continue;
    copyPortableFile(source, path.join(destination, "commands", `${name}.md`), target);
  }
}

// ---------------------------------------------------------------------------
// Bundles
// ---------------------------------------------------------------------------

function buildKilo(outDir) {
  const kilo = path.join(outDir, "kilo");
  copySkillTree(path.join(kilo, "skills", SKILL_NAME), "kilo");

  for (const name of COMMAND_NAMES) {
    const source = path.join(COMMANDS_SRC, `${name}.md`);
    if (!fs.existsSync(source)) continue;
    const { data } = splitFrontmatter(fs.readFileSync(source, "utf8"));
    writeFile(
      path.join(kilo, "command", `${commandName(name)}.md`),
      renderDispatcher(name, data.description || `${SKILL_NAME} ${name}`, "kilo"),
    );
  }

  for (const name of AGENT_NAMES) {
    const source = path.join(AGENTS_SRC, `${name}.md`);
    if (!fs.existsSync(source)) continue;
    writeFile(
      path.join(kilo, "agent", `${agentName(name, "kilo")}.md`),
      renderKiloAgent(name, fs.readFileSync(source, "utf8")),
    );
  }

  copyAdapterFile(
    path.join(ADAPTERS_SRC, "kilo", "kilo.json.template"),
    path.join(kilo, "kilo.json"),
    "kilo",
  );
  copyAdapterFile(
    path.join(ADAPTERS_SRC, "kilo", "README.md"),
    path.join(kilo, "README.md"),
    "kilo",
  );
}

function buildCodex(outDir) {
  const codex = path.join(outDir, "codex");
  copySkillTree(path.join(codex, ".agents", "skills", SKILL_NAME), "codex");

  for (const name of AGENT_NAMES) {
    const source = path.join(AGENTS_SRC, `${name}.md`);
    if (!fs.existsSync(source)) continue;
    writeFile(
      path.join(codex, ".codex", "agents", `${agentName(name, "codex")}.toml`),
      renderCodexAgent(name, fs.readFileSync(source, "utf8")),
    );
  }

  copyAdapterFile(
    path.join(ADAPTERS_SRC, "codex", "mcp.toml.template"),
    path.join(codex, ".codex", "mcp.toml"),
    "codex",
  );
  copyAdapterFile(
    path.join(ADAPTERS_SRC, "codex", "hooks.json.template"),
    path.join(codex, ".codex", "hooks.json"),
    "codex",
  );
  copyAdapterFile(
    path.join(ADAPTERS_SRC, "codex", "README.md"),
    path.join(codex, "README.md"),
    "codex",
  );
}

/** Renders every bundle under outDir. Returns the list of written file paths. */
export function buildAll(outDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  buildKilo(outDir);
  buildCodex(outDir);
  return listFiles(outDir);
}

export function listFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(absolute));
    else out.push(absolute);
  }
  return out;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  let outDir = "dist";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") {
      const value = argv[i + 1];
      if (!value) throw new Error("--out requires a value");
      outDir = value;
      i++;
    } else if (argv[i] === "--help") {
      console.log("Usage: node scripts/build_dist.mjs [--out dist]");
      process.exit(0);
    } else {
      throw new Error(`unknown flag: ${argv[i]}`);
    }
  }
  return { outDir: path.resolve(REPO_ROOT, outDir) };
}

function main() {
  let outDir;
  try {
    ({ outDir } = parseArgs(process.argv.slice(2)));
    const files = buildAll(outDir);
    console.log(
      `build_dist: wrote ${files.length} file(s) to ${path.relative(REPO_ROOT, outDir) || outDir}`,
    );
  } catch (error) {
    console.error(`build_dist: ${error.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith("build_dist.mjs")) main();
