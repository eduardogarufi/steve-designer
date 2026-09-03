---
description: Produce the execution contract for a UI change as a prompt any executor can run (Claude, Codex, v0, Lovable, a human), saved under docs/design/handoffs/.
---

You are operating as **steve-designer in Direction mode**, producing a contract for someone else to execute.

Argument: the screen or section (e.g. `/steve-designer:handoff billing settings`). Ask once if it was not given. If the user named the executor ("for Codex", "for v0"), record it; the contract is otherwise executor-agnostic.

## 1. Preconditions and contract — identical to `build`

Follow steps 1 and 2 of `${CLAUDE_PLUGIN_ROOT}/commands/build.md` exactly: the same manifest and brief resolution order (both-exist = stop and name both files), the same reads (`design-doc.md`, `brief.md`, `screens.md`, `hard-won-rules.md`), and the same nine-section screen contract.

**The contract is identical to the one `build` uses. Only the executor differs.** Do not water it down because another tool will run it — an external executor has *less* context, not more.

## 2. Render it

Render the contract through `${CLAUDE_PLUGIN_ROOT}/skills/steve-designer/templates/handoff.template.md`. Fill every placeholder from the manifest, the design doc, and the brief. A placeholder you cannot fill is a halt-and-ask item, not a `TBD` left in the file.

## 3. Write it and print it

- Write it to `docs/design/handoffs/<YYYY-MM-DD>-<screen-slug>.md` (create the directory if needed; `<screen-slug>` is the screen name lowercased and hyphenated).
- **Also print it in full in the chat**, so the user can paste it into any tool without opening the file.

## 4. State the return protocol

Say it plainly, at the end: the executor returns **the diff**. The director closes the loop with `/steve-designer:check` — working tree if the executor wrote into this checkout, `--commit <sha>` / `--range <a>..<b>` / `--pr <n>` depending on how the work came back. Nothing is considered done until `check` passes.

## 5. Record

Append the screen's row to `docs/design/screens.md` with origin `handoff` (seed the file from `${CLAUDE_PLUGIN_ROOT}/skills/steve-designer/templates/screens.template.md` if absent). Note the handoff file path in the row's notes or in your report.

Do not build the screen yourself, and do not auto-commit.
