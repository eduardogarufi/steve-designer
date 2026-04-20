# Design context — {{PROJECT_NAME}}

> This section is managed by steve-designer. Do not hand-edit — update the design-brief.md instead, and re-export this snippet.

## Project identity

{{ONE_LINE_PROJECT_DESCRIPTION}}

**Audience:** {{AUDIENCE}}
**Tension:** {{TENSION}}
**Vibe:** {{VIBE_THREE_WORDS}}

## Visual system

**Dominant reference:** {{REFERENCE_1_NAME}} — {{REFERENCE_1_DNA_SHORT}}
**Accent references:** {{REFERENCE_2_NAME}}, {{REFERENCE_3_NAME}}

**Synthesis:**
> {{SYNTHESIS_STATEMENT}}

## Tokens (source of truth)

Token file: `{{TOKENS_PATH}}`

Never hardcode values in components. Always read from the token system:

- Colors: `var(--color-bg-base)`, `var(--color-fg-base)`, `var(--color-accent)`, etc.
- Spacing: `var(--space-1)` through `var(--space-n)`
- Radii: `var(--radius-sm|md|lg|full)`
- Motion: `var(--duration-fast|base|slow)`, `var(--ease-out|in|inOut)`

## Non-negotiables

- {{NON_NEGOTIABLE_1}}
- Responsive mobile-first (375px → 1920px)
- `prefers-reduced-motion` respected on all motion
- Semantic HTML, keyboard navigable, visible focus states

## Build workflow

For new sections/components, use `/steve-designer:resume` — it reads the brief and either guides the build or delegates to the `component-builder` subagent.

Manual builds should still:
1. Read this section of CLAUDE.md for context
2. Read `{{TOKENS_PATH}}` for the token values
3. Consult `frontend-design` plugin to force aesthetic direction
4. Use Context7 MCP for library APIs (Motion, Next.js, etc.)
5. Preview via Playwright MCP before declaring done
6. Run `/baseline-ui`, `/fixing-accessibility`, `/fixing-motion-performance` before shipping

## Anti-patterns — avoid

See the full list in `design-brief.md`. The most common:
- Purple-to-pink gradients
- Inter without a display font companion
- Rounded-2xl on every single element
- "Modern, clean, minimal" as the vibe
- Three-column emoji feature grids
- 80px vertical padding everywhere
- Averaging safe references

## Related files

- `design-brief.md` — full project memory
- `{{TOKENS_PATH}}` — token system
- `tokens-preview.html` — live swatch of the token system

---

*Last updated: {{DATE}} by steve-designer.*
