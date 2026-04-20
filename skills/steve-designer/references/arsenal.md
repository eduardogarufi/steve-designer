# Arsenal — Plugins, Skills, and MCPs that steve-designer orchestrates

steve-designer does not replace the tools below — it calls them in the right order with the right context. Read this file during Phase 1 (Arsenal Check) and whenever deciding which tool to delegate to.

**Guiding principle:** Skills > Plugins > MCPs, in that order of preference. MCPs cost tokens every session. Keep 3–5 active MCPs max. Skills initialize at ~100 tokens so more is fine.

---

## Tier 1 — Essential (install before first build)

### frontend-design (Anthropic official)
**Role in steve-designer:** Phase 5 (Build). Called by the `component-builder` subagent. Forces aesthetic direction before code.
**Why essential:** This is the single biggest leverage against "AI-generic". Without it, even with tokens defined, components drift toward Inter + rounded-2xl + gradient-purple.
**Install:** `claude plugin add anthropic/frontend-design`
**Repo:** https://github.com/anthropics/claude-code/tree/main/plugins/frontend-design

### ui-ux-pro-max-skill
**Role in steve-designer:** Phase 4 (Tokens) + Phase 5 (Build). Provides design vocabulary — 240+ style directions, 127 font pairings, 99 UX guidelines. When the synthesis statement is "editorial premium feminine", this skill returns concrete patterns.
**Why essential:** frontend-design forces direction; ui-ux-pro-max delivers vocabulary. They're complementary, not redundant.
**Install:** `claude plugin add nextlevelbuilder/ui-ux-pro-max-skill`

### Context7 MCP
**Role in steve-designer:** Phase 5 (Build). Passed to component-builder subagent for library docs (Motion, Next.js, Tailwind v4, shadcn/ui).
**Why essential:** Libraries move fast. Without Context7, subagents hallucinate old APIs or use deprecated patterns.
**Install:** `claude mcp add context7 -s user -- npx -y @upstash/context7-mcp@latest`

### Playwright MCP
**Role in steve-designer:** Phase 4 (Tokens preview) + Phase 5 (Build checkpoints). This is the "eyes" — steve-designer sees what was built, not just the code.
**Why essential:** Without Playwright, the director is blind. Every checkpoint becomes a guess.
**Install:** `claude mcp add playwright -s user -- npx @playwright/mcp@latest`

### Chrome DevTools MCP
**Role in steve-designer:** Phase 6 (Polish, when motion/performance issues appear). Optional but recommended.
**Why useful:** When animations jank or Lighthouse scores tank, subagents need to profile, not guess.
**Install:** `claude mcp add chrome-devtools -s user -- npx @anthropic-ai/chrome-devtools-mcp@latest`

---

## Tier 2 — Strong complements (install once essentials feel fluent)

### baseline-ui
**Role in steve-designer:** Phase 6 (Polish), first step. Fixes spacing, typography, interactive states.
**Install:** `npx ui-skills add baseline-ui`

### fixing-accessibility
**Role in steve-designer:** Phase 6 (Polish), second step. Keyboard, focus, labels, semantic HTML, contrast.
**Install:** `npx ui-skills add fixing-accessibility`

### fixing-motion-performance
**Role in steve-designer:** Phase 6 (Polish), third step. Reduced-motion support, 60fps budget, CLS compliance.
**Install:** `npx ui-skills add fixing-motion-performance`

### theme-factory
**Role in steve-designer:** Not core flow. Useful when the user asks for derivative artifacts (pitch deck, one-pager) that should match the site.
**Install:** `claude plugin add anthropic/theme-factory`

### Design Review Workflow (Patrick Ellis)
**Role in steve-designer:** Phase 6 (Polish), if installed. Called via `/design-review`. Automated UI/UX review with specialized subagents.
**Install:** Search "Design Review Workflow Claude Code" on GitHub.

### claude-design-engineer
**Role in steve-designer:** Long-term projects. Builds a "design memory" so new components respect old patterns.
**Note:** Useful once the project has 10+ components. Not needed early.

### planning-with-files
**Role in steve-designer:** Large projects. Steve-designer's `design-brief.md` already does persistent planning; this skill generalizes the pattern.

### commit + create-pr
**Role in steve-designer:** End of Phase 6. Called to ship.
**Install:** Via `awesome-claude-plugins` marketplace.

### ship
**Role in steve-designer:** Full deploy workflow. Called at session end.

---

## Tier 3 — Situational

### threejs-skills
**When to call:** Only if the user explicitly wants 3D/WebGL (rotating ornament, shader effects).
**Don't install by default.**

### Figma MCP (Dev Mode)
**When to call:** If the user has an existing Figma file with mockups or tokens.
**Install:** `claude mcp add --transport sse figma-dev-mode-mcp-server http://127.0.0.1:3845/sse`

### claude-code-frontend-dev (hemangjoshi37a)
**When to call:** Alternative to Playwright + Chrome DevTools MCP combo. Try if the combo feels insufficient.
**Repo:** https://github.com/hemangjoshi37a/claude-code-frontend-dev

---

## Component libraries (reference, not blanket install)

These are sources the `component-builder` subagent pulls from. **Never install all** — pull specific components and retheme to the project's tokens.

### shadcn/ui — https://ui.shadcn.com
**Role:** Accessible primitives over Radix. Copy-paste, Tailwind-styled. Default first stop for form, input, dialog, toast, tooltip, popover, select.
**Install per component:** `npx shadcn@latest add [component-name]`

### MagicUI — https://magicui.design
**Role:** Animated components. Use as reference — copy the component logic, retheme to project palette.
**Best-fit pulls:** `<NumberTicker />`, `<TextReveal />`, `<BlurFade />`.

### Aceternity UI — https://ui.aceternity.com
**Role:** More visually "premium" animated components. Hover effects, transitions.

### React Bits — https://reactbits.dev
**Role:** Creative effects (text effects, backgrounds, scroll-triggered).

### 21st.dev — https://21st.dev
**Role:** "npm for design engineers". Browse for component inspiration, copy the prompt, feed to component-builder.

### Motion Primitives — https://motion-primitives.com
**Role:** Framer Motion / Motion primitives library. Pull for motion patterns specifically.

**Rule enforced by component-builder subagent:** Every component pulled from a library MUST be rethemed to the project tokens. No defaults, no exceptions.

---

## "Awesome lists" for discovery

When the user asks about a plugin steve-designer doesn't know about:

- https://github.com/ComposioHQ/awesome-claude-plugins
- https://github.com/jqueryscript/awesome-claude-code
- https://github.com/hesreallyhim/awesome-claude-code
- https://github.com/VoltAgent/awesome-claude-code-subagents
- https://github.com/wilwaldon/Claude-Code-Frontend-Design-Toolkit

---

## Minimum viable install (the "Just enough" setup)

If the user wants to start fast without installing everything:

```bash
# Design engines
claude plugin add anthropic/frontend-design
claude plugin add nextlevelbuilder/ui-ux-pro-max-skill

# Eyes and docs
claude mcp add context7 -s user -- npx -y @upstash/context7-mcp@latest
claude mcp add playwright -s user -- npx @playwright/mcp@latest

# Polish pipeline
npx ui-skills add baseline-ui
npx ui-skills add fixing-accessibility
npx ui-skills add fixing-motion-performance
```

`scripts/check_arsenal.sh` emits exactly these commands for anything missing.

---

## Degraded mode

If the user refuses to install essentials, steve-designer still operates but announces the trade-off clearly:

- **Without frontend-design:** Component-builder falls back to bare prompts. Output will be more generic. Compensate by extending the design-critic pass.
- **Without ui-ux-pro-max:** No vocabulary library. Steve-designer uses only its own reference catalog (awwwards-dna.md + app-references.md). Narrower palette of directions.
- **Without Playwright MCP:** No automatic checkpoints. User must open browser manually. All previews become manual.
- **Without Context7 MCP:** Component-builder may use outdated APIs. Flag this risk to the user.
- **Without baseline-ui / a11y / motion:** Polish phase shrinks to design-critic only. Ship quality drops measurably.

Degraded mode is valid for prototyping. For production work, lobby for installation.
