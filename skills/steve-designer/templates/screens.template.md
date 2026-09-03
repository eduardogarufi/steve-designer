# Screens — {{PROJECT_NAME}}

> Canonical screen inventory. Every navigable screen in scope has a row. Maintained by
> steve-designer via `build`/`handoff`; updated whenever a screen is created or conformed.

| Screen | Route | Components | States covered | Origin |
|---|---|---|---|---|
| {{SCREEN_NAME}} | {{ROUTE}} | {{COMPONENTS}} | {{STATES_COVERED}} | {{ORIGIN}} |

**Origin** — one of: `build` (Steve built it) · `handoff` (built by another executor from
a Steve contract) · `existing` (pre-dated Steve, conformed) · `imported` (brought in from
elsewhere, not yet conformed).

**States covered** — must list all of `loading, empty, error, success` plus any domain
states, or name what is missing and why (e.g. `loading, error, success — no empty state:
screen always has data`).

---

*Last updated: {{DATE}} by steve-designer.*
