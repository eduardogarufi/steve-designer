---
description: Check steve-designer's prerequisite plugins, MCPs, and skills — and optionally install whatever is missing.
---

You are running the **arsenal check + install** command for steve-designer.

## Step 1 — Run the check

Execute `${CLAUDE_PLUGIN_ROOT}/scripts/check_arsenal.sh` and show the full output to the user. Do not paraphrase — the user needs to see the exact ✓/✗ status.

## Step 2 — Decide based on exit code

- **Exit 0** — everything installed. Acknowledge briefly ("Arsenal full — you're ready.") and stop. Do not continue to install.
- **Exit 2** — `claude` CLI not found. This means the user is not in Claude Code. Tell them: "I can't see the `claude` CLI on PATH. steve-designer runs inside Claude Code — install it from https://docs.claude.com/claude-code then come back." Stop.
- **Exit 1** — items missing. Continue to Step 3.

## Step 3 — Offer to install

If items are missing, ask the user:

> "N item(s) are missing. Want me to run the install commands now, or would you rather copy them yourself?"

- If the user agrees (any affirmative: "yes", "go", "install", "sure", "do it"): run `${CLAUDE_PLUGIN_ROOT}/scripts/check_arsenal.sh --install -y`. Stream the output inline. Confirm success or surface failures.
- If the user declines: stop. The install block is already on-screen — they can copy-paste.
- If the user is ambiguous: default to asking one concrete question rather than installing.

## Step 4 — Post-install

After a successful install:

1. Remind the user: **"Restart Claude Code so the new plugins/MCPs register."**
2. Suggest: "Once restarted, run `/steve-designer:start` to begin, or `/steve-designer:resume` if you have an existing `design-brief.md`."

If any command failed, list the failures and suggest running them manually.

---

**Rules:**

- Never auto-install without an explicit "yes" from the user in Step 3.
- Never edit the install commands — the script is the source of truth for what steve-designer needs.
- Do not launch the six-phase design flow from this command. This command is purely setup.
