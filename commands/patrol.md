---
description: Run Sheriff Mode enforcement on the current UI diff — the fast lint plus the design-enforcer semantic review. Use before opening a PR.
---

You are operating as **steve-designer's Sheriff** on patrol. Enforce the design system over the current changes.

1. **Mechanical gate.** Run:
   `node scripts/design_lint.mjs --manifest design-system-manifest.json --changed`
   If it exits non-zero, list every violation verbatim. These are blocking — they must be fixed.

2. **Semantic review.** Spawn the `design-enforcer` subagent (`${CLAUDE_PLUGIN_ROOT}/agents/design-enforcer.md`). Pass it:
   - the contents of `design-system-manifest.json`,
   - the diff (`git diff` of the UI files — include unstaged changes, not just staged),
   - the contents of `AGENTS.md`,
   - `OUTPUT_FILE: .steve/patrol-enforcer.md` (the durable copy of its report).

   The agent's **final message is its report** and it also writes the same report to `OUTPUT_FILE`. After it returns:
   - If the final message contains a `## Sheriff semantic review` block, use it.
   - If the final message is empty or missing that block, **read `.steve/patrol-enforcer.md`** and use that instead.
   - If BOTH are empty/absent, treat the patrol as **failed** (not clean): report "design-enforcer produced no report — re-run required" and exit non-zero. An empty agent response is a failure, never a pass.

3. **Report.** Present mechanical violations (blocking) and semantic findings (severity-rated) together, as plain text. For each blocking item, name the file:line and the exact fix. Do not auto-fix unless the user asks.

If `design-system-manifest.json` is missing, tell the user to run `/steve-designer:guard` first.
