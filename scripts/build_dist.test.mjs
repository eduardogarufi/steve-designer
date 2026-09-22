import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  AGENT_SANDBOX,
  SKILL_DIR_TOKEN,
  agentName,
  buildAll,
  commandName,
  invocation,
  listFiles,
  portable,
  renderCodexAgent,
  renderDispatcher,
  renderKiloAgent,
  splitFrontmatter,
} from "./build_dist.mjs";

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "steve-build-"));
}

function readAll(dir) {
  const out = new Map();
  for (const file of listFiles(dir)) {
    out.set(path.relative(dir, file), {
      contents: fs.readFileSync(file, "utf8"),
      mode: fs.statSync(file).mode & 0o777,
    });
  }
  return out;
}

test("portable anchors skill-owned resources and leaves vendored ones alone", () => {
  const source = [
    "${CLAUDE_PLUGIN_ROOT}/skills/steve-designer/SKILL.md",
    "${CLAUDE_PLUGIN_ROOT}/skills/steve-designer/scripts/ingest_design_system.py",
    "${CLAUDE_PLUGIN_ROOT}/skills/steve-designer/scripts/design_lint.mjs",
    "`references/hard-won-rules.md`",
    "`templates/brief.template.md`",
    "`scripts/check_arsenal.sh`",
    "`scripts/design_lint.mjs`",
    "${CLAUDE_PLUGIN_ROOT}/agents/design-enforcer.md",
    "`agents/design-critic.md`",
    "${CLAUDE_PLUGIN_ROOT}/commands/enforce.md",
    "`commands/handoff.md`",
    "run /steve-designer:check",
  ].join("\n");

  const kilo = portable(source, "kilo");
  assert.ok(!kilo.includes("CLAUDE_PLUGIN_ROOT"));
  assert.ok(kilo.includes(`${SKILL_DIR_TOKEN}/SKILL.md`));
  assert.ok(kilo.includes(`${SKILL_DIR_TOKEN}/scripts/ingest_design_system.py`));
  assert.ok(kilo.includes(`${SKILL_DIR_TOKEN}/scripts/design_lint.mjs`));
  assert.ok(kilo.includes(`${SKILL_DIR_TOKEN}/references/hard-won-rules.md`));
  assert.ok(kilo.includes(`${SKILL_DIR_TOKEN}/templates/brief.template.md`));
  assert.ok(kilo.includes(`${SKILL_DIR_TOKEN}/commands/enforce.md`));
  assert.ok(kilo.includes(`${SKILL_DIR_TOKEN}/commands/handoff.md`));
  assert.ok(kilo.includes("steve-design-enforcer"));
  assert.ok(kilo.includes("steve-design-critic"));
  assert.ok(kilo.includes("/steve-check"));

  // The vendored linter stays project-relative: `enforce` copies it into the repo.
  assert.ok(kilo.includes("`scripts/design_lint.mjs`"));
  assert.ok(!kilo.includes(`\`${SKILL_DIR_TOKEN}/scripts/design_lint.mjs\``));
});

test("portable never doubles the skill anchor", () => {
  const once = portable("`scripts/check_arsenal.sh --cli claude`", "kilo");
  assert.equal(once, `\`${SKILL_DIR_TOKEN}/scripts/check_arsenal.sh --cli kilo\``);
  assert.equal(portable(once, "kilo"), once);
});

test("portable rewrites an explicit --cli claude, only as a standalone argument", () => {
  assert.match(portable("`scripts/check_arsenal.sh --cli claude`", "kilo"), /--cli kilo/);
  assert.match(
    portable("`scripts/check_arsenal.sh --cli claude --install -y`", "codex"),
    /--cli codex --install -y/,
  );
  // A prose enumeration is documentation, not an argument list.
  assert.match(portable("(`--cli claude|kilo|codex`)", "kilo"), /--cli claude\|kilo\|codex/);
  // A quoted filename must never receive the flag inside the quotes.
  assert.match(
    portable('bash "scripts/check_arsenal.sh" --install', "kilo"),
    /"<STEVE_SKILL_DIR>\/scripts\/check_arsenal\.sh" --install/,
  );
});

test("portable anchors ./scripts but leaves my-scripts alone", () => {
  assert.match(
    portable("python3 ./scripts/ingest_design_system.py", "kilo"),
    new RegExp(`${SKILL_DIR_TOKEN}/scripts/ingest_design_system\\.py`),
  );
  assert.equal(
    portable("python3 my-scripts/ingest_design_system.py", "kilo"),
    "python3 my-scripts/ingest_design_system.py",
  );
});

test("portable refuses to leave a placeholder behind", () => {
  assert.throws(() => portable("${CLAUDE_PLUGIN_ROOT}/hooks/hooks.json", "kilo"), /unresolved/);
});

test("invocation differs per CLI", () => {
  assert.equal(invocation("check", "kilo"), "/steve-check");
  assert.equal(invocation("check", "codex"), "$steve-designer check");
  assert.equal(invocation("check", "claude"), "/steve-designer:check");
});

test("splitFrontmatter reads description and strips the block", () => {
  const { data, body } = splitFrontmatter('---\ndescription: "Do a thing"\n---\n\nBody text.\n');
  assert.equal(data.description, "Do a thing");
  assert.equal(body.trim(), "Body text.");
});

test("renderDispatcher is thin and points at the skill's workflow", () => {
  const rendered = renderDispatcher("check", "Verify UI work", "kilo");
  assert.match(rendered, /^---\ndescription: "Verify UI work"\n---\n/);
  assert.ok(rendered.includes(`${SKILL_DIR_TOKEN}/commands/check.md`));
  assert.ok(rendered.length < 900, "dispatcher should be thin, not a full workflow");
  assert.ok(!rendered.includes("design_lint.mjs --changed"));
});

test("renderKiloAgent emits subagent frontmatter", () => {
  const rendered = renderKiloAgent("design-critic", "---\ndescription: Critique\n---\n\nBe sharp.\n");
  assert.match(rendered, /^---\ndescription: "Critique"\nmode: "subagent"\n---\n/);
});

test("renderCodexAgent emits the required TOML keys", () => {
  const toml = renderCodexAgent(
    "design-enforcer",
    "---\ndescription: Semantic review\n---\n\nBe strict.\n",
  );
  assert.match(toml, /^name = "steve_design_enforcer"$/m);
  assert.match(toml, /^description = "Semantic review"$/m);
  assert.match(toml, /^sandbox_mode = "read-only"$/m);
  assert.match(toml, /^developer_instructions = "/m);
});

test("naming helpers are stable", () => {
  assert.equal(commandName("handoff"), "steve-handoff");
  assert.equal(agentName("tokens-engineer", "kilo"), "steve-tokens-engineer");
  assert.equal(agentName("tokens-engineer", "codex"), "steve_tokens_engineer");
  assert.deepEqual(Object.keys(AGENT_SANDBOX).sort(), [
    "component-builder",
    "design-critic",
    "design-enforcer",
    "tokens-engineer",
  ]);
});

test("buildAll produces anchored, placeholder-free bundles", () => {
  const out = tempDir();
  try {
    buildAll(out);
    const files = [...readAll(out).keys()];

    assert.ok(files.includes(path.join("kilo", "skills", "steve-designer", "SKILL.md")));
    assert.ok(files.includes(path.join("kilo", "skills", "steve-designer", "scripts", "design_lint.mjs")));
    assert.ok(files.includes(path.join("kilo", "skills", "steve-designer", "commands", "enforce.md")));
    assert.ok(files.includes(path.join("kilo", "command", "steve-enforce.md")));
    assert.ok(files.includes(path.join("kilo", "agent", "steve-design-enforcer.md")));
    assert.ok(files.includes(path.join("codex", ".agents", "skills", "steve-designer", "SKILL.md")));
    assert.ok(files.includes(path.join("codex", ".codex", "agents", "steve_design_enforcer.toml")));
    assert.ok(files.includes(path.join("codex", ".codex", "mcp.toml")));
    assert.ok(files.includes(path.join("codex", ".codex", "hooks.json")));

    for (const [relative, { contents }] of readAll(out)) {
      assert.ok(!contents.includes("CLAUDE_PLUGIN_ROOT"), `placeholder leaked into ${relative}`);
    }

    // Codex prompts are deliberately not shipped (user-level + deprecated upstream).
    assert.ok(!files.some((file) => file.includes(path.join("codex", ".codex", "prompts"))));
    // The retired invalid TOML hook must not come back.
    assert.ok(!files.some((file) => file.endsWith("hooks.toml")));

    const hooks = JSON.parse(
      readAll(out).get(path.join("codex", ".codex", "hooks.json")).contents,
    );
    const handler = hooks.hooks.PostToolUse[0].hooks[0];
    assert.equal(handler.type, "command");
    assert.equal(typeof handler.timeout, "number");
    assert.ok(handler.timeout < 100, "Codex timeout is in seconds");
    assert.ok(handler.command.includes(`${SKILL_DIR_TOKEN}/scripts/hook_design_lint.sh`));
    assert.match(hooks.hooks.PostToolUse[0].matcher, /apply_patch/);

    // Deprecated aliases and dev-only files must not ship.
    assert.ok(!files.some((file) => /steve-guard|steve-patrol/.test(file)));
    assert.ok(!files.some((file) => file.endsWith(".test.mjs")));
    assert.ok(!files.some((file) => file.includes("__pycache__") || file.includes(".omc")));
    assert.ok(!files.some((file) => file.includes("fixtures")));
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test("executable scripts keep their mode in the bundle", () => {
  const out = tempDir();
  try {
    buildAll(out);
    const files = readAll(out);
    for (const relative of [
      path.join("kilo", "skills", "steve-designer", "scripts", "check_arsenal.sh"),
      path.join("kilo", "skills", "steve-designer", "scripts", "hook_design_lint.sh"),
      path.join("codex", ".agents", "skills", "steve-designer", "scripts", "check_arsenal.sh"),
    ]) {
      const entry = files.get(relative);
      assert.ok(entry, `missing ${relative}`);
      assert.ok(entry.mode & 0o111, `${relative} lost its executable bit (mode ${entry.mode.toString(8)})`);
    }
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test("executable artifacts never instruct a Claude-only invocation", () => {
  const out = tempDir();
  try {
    buildAll(out);
    const executable = [...readAll(out)].filter(([relative]) => {
      const parts = relative.split(path.sep);
      return (
        (parts[0] === "kilo" && (parts[1] === "command" || parts[1] === "agent")) ||
        (parts[0] === "codex" && parts[1] === ".codex")
      );
    });
    assert.ok(executable.length > 0);
    for (const [relative, { contents }] of executable) {
      assert.ok(!contents.includes("/steve-designer:"), `Claude invocation leaked into ${relative}`);
    }
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test("buildAll is idempotent", () => {
  const out = tempDir();
  try {
    buildAll(out);
    const first = readAll(out);
    buildAll(out);
    const second = readAll(out);

    assert.deepEqual([...second.keys()].sort(), [...first.keys()].sort());
    for (const [relative, entry] of first) {
      assert.equal(second.get(relative).contents, entry.contents, `content drift in ${relative}`);
      assert.equal(second.get(relative).mode, entry.mode, `mode drift in ${relative}`);
    }
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});
