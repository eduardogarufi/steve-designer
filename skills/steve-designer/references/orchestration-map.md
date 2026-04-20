# Orchestration Map

Decision table: given a moment in the workflow, which tool should steve-designer invoke? Read `arsenal.md` for *what* each tool does; this file is *when*.

---

## Master table

| Phase | Moment | Primary tool | Secondary / conditional |
|-------|--------|--------------|------------------------|
| 1 | Checking what's installed | `scripts/check_arsenal.sh` | — |
| 1 | User wants to install something | User runs `claude plugin add ...` themselves | (Never auto-install) |
| 2 | Conducting Discovery | Steve-designer directly (no delegation) | — |
| 2 | Reading user's existing project files | Read tool | `git log` via Bash if useful |
| 3 | Reading canonical catalogs | `references/awwwards-dna.md` (web) OR `references/app-references.md` (app) | Both if hybrid |
| 3 | Fetching user-supplied URL | WebFetch | Playwright MCP if rich rendering needed |
| 3 | Reading user-supplied screenshot | Native vision (just look at the image) | — |
| 3 | Checking "resist" logic | `references/when-to-resist-awwwards.md` | — |
| 4 | Generating tokens | `tokens-engineer` subagent | — |
| 4 | Token subagent consults vocabulary | `ui-ux-pro-max-skill` plugin (if installed) | — |
| 4 | Previewing the swatch | Playwright MCP (screenshot) + local dev server URL | If neither, guide user to open HTML manually |
| 4 | Naming "something feels off" | `design-critic` subagent | — |
| 5 | Building a section | `component-builder` subagent | — |
| 5 | Component subagent forces aesthetic | `frontend-design` plugin (if installed) | Degraded: subagent works harder on own |
| 5 | Component subagent gets vocabulary | `ui-ux-pro-max-skill` plugin | — |
| 5 | Component subagent gets library docs | Context7 MCP | — |
| 5 | Component subagent previews | Playwright MCP + local dev server | Local dev server only if no Playwright |
| 6 | First polish pass | `/baseline-ui` slash command | — |
| 6 | Accessibility pass | `/fixing-accessibility` slash command | — |
| 6 | Motion/performance pass | `/fixing-motion-performance` slash command | Chrome DevTools MCP for profiling |
| 6 | Full design audit | `/design-review` slash command | If installed |
| 6 | Final critique | `design-critic` subagent | — |

---

## Decision rules

### "Should I call a subagent or handle it myself?"

Call a subagent when:
- The task involves writing code (tokens file, components)
- The task benefits from a fresh context window (deep research, long build)
- The task is parallelizable (multiple sections at once in Phase 5, though usually avoid)
- The task benefits from a specific persona (critic, tokens-engineer)

Handle yourself when:
- The task is conversational (Discovery, References synthesis)
- The task is small (update a token value, read a file)
- The task requires full context of the conversation

### "Should I call a plugin or a subagent?"

Plugins are external — they have their own workflows and may fight for control. Subagents run your prompt in a fresh context.

Prefer plugins when:
- The plugin is designed for the task (`/baseline-ui` for baseline polish)
- The plugin has assets you don't have (ui-ux-pro-max's 240+ vocabularies)
- The plugin's opinions align with yours (frontend-design — fights generic)

Prefer subagents when:
- You want control over the prompt and persona (tokens-engineer, design-critic)
- The task is specific to your flow (component-builder)
- No plugin covers it

### "Should I call an MCP or just do it myself?"

MCPs cost context tokens. Use them when:
- **Context7** — any non-trivial library call. Motion, Next.js, shadcn/ui. Hallucinated APIs are worse than a slow lookup.
- **Playwright** — any time you want to see the output. Automatic checkpoints.
- **Chrome DevTools** — only in Phase 6 when profiling or debugging perf issues.

Skip MCPs for trivial tasks. Don't Playwright-screenshot a static HTML you just wrote — open the file with the Read tool.

---

## Parallelization

Most steve-designer work is sequential (user feedback required between phases). But some tasks CAN run parallel:

**Good parallelization candidates:**
- Running multiple section builds in Phase 5 when the user says "build the rest of these 3 sections" (but user must approve each after, not simultaneously)
- Running `/baseline-ui` + `/fixing-accessibility` + `/fixing-motion-performance` in parallel IF they don't touch the same files (rare — usually sequential is safer)
- Fetching multiple URLs in Phase 3 (WebFetch them all at once)

**Bad parallelization candidates:**
- Spawning component-builder for multiple sections at once (the first section's decisions inform the next)
- Running Phase 4 and Phase 5 in parallel (tokens must exist before components)
- Running design-critic while polish is still in progress (critic needs final state)

---

## Degraded mode — what to do when tools are missing

| Missing tool | Impact | Workaround |
|--------------|--------|------------|
| `frontend-design` plugin | Build output more generic | Extend the design-critic pass; be more specific in synthesis statement |
| `ui-ux-pro-max-skill` plugin | Fewer vocabulary options | Rely on own catalog (awwwards-dna.md + app-references.md); narrower palette of directions |
| `context7` MCP | Subagents may use stale APIs | Flag risk to user; use WebFetch for docs manually when subagent reports trouble |
| `playwright` MCP | No automatic visual checkpoints | All previews become manual; user must open browser each time |
| `chrome-devtools` MCP | Can't profile motion/perf | Skip Phase 6 step 3; rely on eye-test + Lighthouse via CLI |
| `/baseline-ui` | Typography/spacing drift not caught | Longer design-critic pass; manual review |
| `/fixing-accessibility` | A11y issues ship | Strongly recommend manual audit; note in brief |
| `/fixing-motion-performance` | Motion jank ships | User test on real device required |
| `/design-review` | No external audit | Design-critic is only external voice |

When operating in degraded mode, SAY SO. Tell the user in the relevant phase: "I can proceed without [tool], but expect [specific impact]."

---

## Tool sequencing in Phase 5 (the busiest phase)

When building a section, the component-builder subagent's internal sequence is:

```
1. Receive task from steve-designer (includes brief, tokens, target, installed tools)
2. Consult ui-ux-pro-max-skill    → get design patterns for this section type
3. Consult Context7 MCP            → get library API syntax
4. Defer to frontend-design        → forces aesthetic direction
5. Write code using tokens only
6. Start dev server (if not running)
7. Playwright screenshot @ 375 and 1440
8. Self-critique (1-3 bullets)
9. Return to steve-designer
```

If any of 2/3/4 is missing, skip and continue with a note in the self-critique about what would have improved with that tool.

---

## When to NOT call anything

Some moments want silence, not tools:

- **Discovery conversation** — resist the urge to WebFetch references the user mentions. Use your knowledge first. Only fetch if they specifically ask you to.
- **User approving a section** — don't immediately move to the next section without celebrating what's working. A beat of recognition matters.
- **User pushing back** — don't immediately re-spawn a subagent with the feedback. Ask questions first. Half the time the pushback reveals a Discovery gap, not a build gap.
- **Brief updates** — just edit the file. No tools needed.
