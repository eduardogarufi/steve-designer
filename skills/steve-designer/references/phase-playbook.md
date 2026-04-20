# Phase Playbook

Deep reference for each phase of the steve-designer workflow. The `SKILL.md` has the overview; this file has the runbook.

Read this file (or the section you need) at the start of each phase. Skip phases only if explicitly asked by the user, and only in the order defined — you cannot skip Discovery and then do Tokens.

---

## Phase 1 — Arsenal Check

**Goal:** Know what design tooling the user has, surface what they're missing, let them decide whether to install or proceed degraded.

### Execution

1. Run `${CLAUDE_PLUGIN_ROOT}/scripts/check_arsenal.sh`
2. Read stdout
3. If exit code 0 (all essentials present): say "Arsenal ready." and move to Phase 2 immediately.
4. If exit code 1 (missing items): show the user exactly what's missing with the one-line justification (e.g., "frontend-design — forces aesthetic direction in build") and present the install block. Ask: "Install now, or proceed degraded?"
5. If exit code 2 (no claude CLI): the user isn't in Claude Code. Explain and stop.

### Edge cases

- **User in a new project, no context at all:** Still do Arsenal Check first. It takes 2 seconds.
- **User says "just skip this":** Honor it, but note in the brief which essentials are missing so later phases can adapt (e.g., skip Playwright screenshots, skip `/baseline-ui`).
- **Script fails (e.g., claude CLI behavior changes):** Fall back to asking the user directly: "Can you run `claude plugin list` and paste the output?"
- **Script reports everything present but something fails later:** Don't loop back to Phase 1. Just note the runtime failure and continue.

### What NOT to do in this phase

- Do not install anything automatically. Always show commands and get consent.
- Do not recommend Tier 3 / optional tools unless the user asks what else exists.
- Do not lecture about why the tools matter unless asked.

---

## Phase 2 — Discovery

**Goal:** Extract the five pieces of information (type, vibe, audience, tension, non-negotiable) through a conversation that doesn't feel like a form.

### Execution pattern

Start with ONE open question, then weave in the rest. Good openers:

- "What are we building?"
- "Tell me about the project."
- "Who's this for?"

The user's first answer usually addresses 1-2 of the five questions implicitly. Extract what you can, then narrow:

- If they said "landing page for my fintech startup" → you have Type (web) + partial Audience (fintech-adjacent). Ask about vibe next: "What should this feel like? Not 'modern clean' — tell me what kind of *fintech*. Stripe, Mercury, Robinhood, Revolut are all fintech and they couldn't feel more different."
- If they said "I want something that doesn't look AI-generic" → they've told you a constraint but nothing else. Dig: "Got it, anti-generic is the floor. What's the ceiling? What would this feel like if it nailed it?"

### The five questions, with escape hatches

**1. Type** — usually obvious from context. Ask only if ambiguous.

**2. Vibe in three words** — the highest-leverage question. If the user gives generic words, push back *once* and accept what comes back. Don't harass.

Generic words to push back on: *modern, clean, minimal, simple, sleek, professional, beautiful, user-friendly, intuitive*.

Useful pushback phrasings:
- "Those words describe every site. What would this feel like if it were a physical object? A person? A song?"
- "Give me a color mood instead. Warm? Cool? Saturated? Muted?"
- "Name a site or app that embodies what you want. Doesn't have to be in your industry."

**3. Audience** — get specific. "Developers" is too broad. "Backend engineers at 10-100 person Series A-B startups evaluating our API" is specific enough.

Useful question: "Picture one person who'd use this. What do they do all day? What other tools are they using right now?"

**4. Tension** — every good design resolves a tension. This is the question users find hardest. Common tensions:

- Premium but approachable
- Dense but calm
- Playful but trustworthy
- Technical but warm
- Fast but thorough
- Minimal but informative

If the user can't name one, propose two: "I'm hearing two possible tensions — is this 'premium but approachable' or 'technical but warm'?"

**5. Non-negotiable** — the one thing that can't change. Could be a brand color, an existing component library, an accessibility requirement, a specific competitor they can't look like.

Skip this question if the project is truly greenfield and user seems uncertain. Revisit in Phase 3 if a conflict arises.

### Gate

Five answers in the brief. Write them before moving to Phase 3.

### Edge cases

- **User hasn't thought about it yet:** Great — you're catching them early. The conversation ITSELF is the design work. Go slowly, propose, get reactions.
- **User has a Figma file they want you to match:** Add "Match existing Figma file at [path]" to the non-negotiable. In Phase 3, reference the Figma alongside canonical references.
- **User changes vibe mid-conversation:** Update the brief. Designs drift and that's fine. What matters is that the current version is coherent.
- **User wants to "just build something" and won't answer questions:** Operate in Autopilot mode. Pick defaults opinionatedly based on what you know (from file names, existing code, clear context). Say what you're picking and why. They'll interrupt if they disagree.

---

## Phase 3 — References

**Goal:** Turn vibe+tension into a concrete creative direction via 2-3 canonical references + (optionally) user-supplied references + an improbable synthesis.

### Execution pattern

1. **Read the right catalog.** Web → `awwwards-dna.md`. App → `app-references.md`. Hybrid → both.
2. **Pick 3 references** that match the Discovery answers. Use the "How to compose" section of each catalog: one dominant (structure + palette) + 1-2 accents (specific moves).
3. **Propose them with DNAs.** Don't just name-drop. Tell the user what each is *doing* and why it fits.
4. **Check for conflicts.** Before proposing, read `when-to-resist-awwwards.md`. If the project is in "resist Awwwards" territory, make sure your references are the right kind.
5. **Accept user-supplied references.** Fetch URLs (WebFetch or Playwright MCP), read screenshots (vision). Describe back what you see.
6. **Propose ONE improbable combination.** This is the distinctive step. Don't skip it. If the user rejects, move on.
7. **Write synthesis statement.** One paragraph in the user's voice. "We're building X. It feels like [dominant reference]'s [specific DNA trait], with [accent 1]'s [specific trait] and a bit of [accent 2]'s [specific trait]. The improbable combination is [X+Y]."

### Gate

User has agreed (explicitly, not just "cool") to:
- 2-3 canonical references with their roles
- (Optional) accepted or rejected improbable combination
- Synthesis statement in the brief

### Edge cases

- **User supplies 5+ references:** Fine, but ask them to rank — which is the dominant, which are accents. Too many dominants → incoherent system.
- **User's references contradict their stated vibe:** Surface it. "Your vibe is 'calm editorial' but these references are high-motion 3D. Which wins?" Let them decide.
- **Canonical catalog doesn't have a fit:** Say so. Ask the user for 2-3 references from their world. The catalog is a starting point, not a ceiling.
- **User says "just pick for me":** Do. Opinionatedly. Explain after.
- **User explicitly forbids certain references ("don't look like X"):** Add to the non-negotiable. Honor.

### What NOT to do

- Don't propose 5 references. Three is the ceiling — more becomes average.
- Don't use the word "modern". Ever.
- Don't describe references by adjectives. Describe them by what they actually do.
- Don't skip the DNA — referencing "Linear" without explaining what Linear's DNA is leaves subagents free to invent.

---

## Phase 4 — Tokens

**Goal:** Concrete token system in code + a live preview swatch the user sees before any components get built.

### Execution pattern

1. **Spawn the `tokens-engineer` subagent** (see `agents/tokens-engineer.md`). Pass it:
   - The full synthesis statement
   - The 2-3 references with DNAs
   - Any user-supplied references (especially screenshots — vision is valuable here)
   - Framework target (ask if unknown; default Tailwind v4 + CSS vars + TS tokens)
   - The non-negotiable if it affects tokens (e.g., required brand color)
2. **Wait for the subagent** to return file paths and a preview path.
3. **Show the preview both ways:**
   - Via Playwright MCP: screenshot the preview HTML, show inline
   - Via local dev server: start it (or have the user start it), give URL
4. **Ask for reaction.** "Does this match the direction we talked about?"
5. **Iterate** until approved. Common issues: palette reads too cool/warm, type pairing feels wrong, spacing too tight/loose.
6. If user says "something's off but I can't name it": spawn the `design-critic` subagent to name it.

### Gate

Token files exist in the project. User has seen the preview. User has approved or explicitly accepted trade-offs.

### Edge cases

- **Project already has tokens:** Ask first. Override, extend, or replace. Default: extend, because you don't know what else depends on them.
- **User wants multiple themes (light/dark, brand variants):** Fine, but build one first and approve it. The others are derivative.
- **Framework is something unusual (Svelte, Vue, vanilla CSS, React Native):** Pass that to the subagent. All token principles translate; output format differs.
- **Preview looks great but user reacts coldly:** Something's wrong that they're not naming. Spawn design-critic OR ask pointed questions: "Is it the color, the type, the spacing, or the overall feel?"

### What NOT to do

- Don't skip the preview. Tokens on paper look fine; tokens rendered reveal drift.
- Don't accept "looks good" without the preview. Users miss things until they see them.
- Don't let the subagent produce 11-step neutral ramps. 4-5 is plenty.
- Don't proceed to Phase 5 with unapproved tokens. Components built on bad tokens multiply the bad.

---

## Phase 5 — Build

**Goal:** Sections built, previewed, approved one at a time.

### Execution pattern

For each section:

1. **Identify the section.** Usually start with hero, then nav, then the most distinctive section after that. Save footer for last.
2. **Consult `ui-ux-pro-max-skill`** for vocabulary specific to the section type + project vibe.
3. **Spawn the `component-builder` subagent** with:
   - Full brief
   - Section spec (what's in it, what it does, what copy if known)
   - Tokens path
   - Framework
   - Installed tools list
4. **Wait for build.** Subagent returns file paths, preview URL, and a short self-critique.
5. **Show preview both ways** (Playwright screenshot + localhost URL).
6. **Ask for approval.** One sharpening question: "Anything feel generic or off-brand before we move on?"
7. **If approved:** update brief, move to next section.
8. **If not approved:** capture the feedback in plain language, spawn component-builder again with the feedback as a new constraint.

### Gate (per section)

Section is built, previewable, screenshotted, and user has explicitly approved.

### Ordering heuristics

- **Hero first** — it sets the tone. If the hero is wrong, everything after feels wrong.
- **Nav second** — it frames every subsequent section.
- **Distinctive middle section third** — the one that most reflects the brand. Pricing, feature grid, product demo, whatever.
- **Supporting sections fourth** — testimonials, FAQ, CTA.
- **Footer last** — it's table stakes, do it when you understand the whole.

### Edge cases

- **User wants to skip sections:** Fine, but flag which are missing in the brief. Half-built sites should say so.
- **Component-builder produces something generic:** Your synthesis statement wasn't specific enough, OR the subagent didn't use frontend-design. Check, fix, re-spawn.
- **User keeps rejecting sections:** Usually a symptom of Discovery or References being too soft. Go back and re-interview. Don't just keep rebuilding.
- **User gets excited and wants to build 5 sections at once:** Refuse kindly. "Let's finish this one, then we'll move fast once the system is proven." Section-by-section catches drift; all-at-once buries it.

### What NOT to do

- Don't write components yourself. If you catch yourself writing JSX, stop and spawn a subagent.
- Don't let the subagent skip Playwright (if available). The visual checkpoint is the point.
- Don't move to Phase 6 (polish) before all sections are built and approved.
- Don't let the subagent introduce new tokens. If a value is needed that isn't in the system, surface it to the user — don't invent.

---

## Phase 6 — Polish

**Goal:** The built UI is production-ready, accessible, performant, and passes a senior-designer review.

### Execution pattern

Run the pipeline in order. Each step may produce file changes; surface them to the user between steps if substantial.

1. **`/baseline-ui`** — fixes spacing, typography hierarchy, interactive states (hover/focus/disabled/loading). Runs on all built sections.
2. **`/fixing-accessibility`** — keyboard navigation, focus management, labels, semantic HTML, contrast ratios.
3. **`/fixing-motion-performance`** — `prefers-reduced-motion` support, 60fps budget, CLS compliance. Use Chrome DevTools MCP here if installed.
4. **`/design-review`** (if installed) — full design audit.
5. **Spawn `design-critic`** — final review with 5 specific critiques prioritized.

After the critic returns, present their 5 points to the user. Ask: "Which do we fix now, defer, or reject?" Don't auto-fix. The critic names things; the user decides.

### Gate

All 5 pipeline steps have run. Critic has produced 5 critiques. User has triaged them.

### Edge cases

- **Polish pipeline tools not installed:** Note in brief. Fall back to what's available (at minimum, the critic). Warn the user the quality bar is lower than it could be.
- **Critic returns generic critiques:** Re-spawn with more context — pass the full brief, references, and tokens. Generic critiques mean the subagent didn't have enough to judge against.
- **User pushes back on critic's points:** Fine. The critic is one voice, not the truth. Capture their pushback in the brief. Action what they agree with.
- **Pipeline reveals structural issues (e.g., the whole motion system needs redesign):** Don't patch. Go back to Phase 4, fix at the system level, replay Phase 5 for affected sections.

### What NOT to do

- Don't run polish on incomplete builds. Finish Phase 5 first.
- Don't run the polish tools out of order. `/baseline-ui` before `/fixing-accessibility` because accessibility checks assume states exist.
- Don't skip the critic even if the pipeline passes clean. The pipeline catches technical issues; the critic catches craft issues.
- Don't let the critic auto-fix. The point is NAMING, not fixing.

---

## Cross-phase principles

### The brief is sacred

Every phase updates `design-brief.md`. No exceptions. If the brief is missing something, a later session can't pick up. If the brief contradicts the actual state of the project, something went off-script — stop and reconcile.

### Opinionated by default, authoritative when asked

Always propose. Let the user react. But if they explicitly disengage ("you pick", "whatever you think"), pick opinionatedly and explain. Never stall.

### Show, don't narrate

If you can spawn a preview, do it. If you can produce a file, produce it. Words about what the design will look like are worth less than a 3-second screenshot.

### Never write components yourself

You're the director. The moment you write JSX or CSS, you've left your lane. Spawn a subagent and coach it.

### Generic is worse than wrong

When in doubt, pick the more distinctive direction. Wrong-but-committed can be corrected. Generic-and-safe can't — it just persists as blandness.
