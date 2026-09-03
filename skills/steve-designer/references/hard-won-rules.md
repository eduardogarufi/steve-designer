# Hard-won rules

Rules earned in production, not invented in a vacuum. Each one below traces to a real
defect found in a real governed project — a floating panel that grew past the viewport, a
confirm dialog that lost focus, a success toast that said nothing useful. Steve enforces
these because someone shipped the mistake first.

Format: **Rule → why it bites → the concrete fix.**

## 1. Floating surfaces cap their height and scroll inside themselves

**Rule.** A dropdown, popover, or command palette has a `max-height` and its own
`overflow-y: auto`. It never grows past the viewport.

**Why it bites.** A list that grows with the data (categories, search results, a long
select) eventually exceeds the screen. Without a cap, the surface pushes off-screen,
clips against the browser chrome, or forces a page-level scroll that hides the trigger.

**The fix.** Set `max-height` to a fraction of the viewport (commonly `min(60vh, 24rem)`)
and let the surface's own content scroll. Never let a floating surface inherit
`overflow: visible` from its content.

## 2. `ConfirmDialog` is `role="alertdialog"`, focuses Cancel first, returns focus on close

**Rule.** Every destructive confirmation dialog uses `role="alertdialog"` (not
`role="dialog"`), opens with initial focus on the **Cancel** action, and returns focus to
the element that triggered it when it closes — confirmed, cancelled, or dismissed.

**Why it bites.** `role="dialog"` does not force screen readers to announce the body text
on open; `alertdialog` does, and the body is exactly where the consequences live. Focusing
the destructive action first makes an accidental Enter destructive. Losing the return
focus strands keyboard and screen-reader users at the top of the page after every
interaction.

**The fix.** `role="alertdialog"`; `autoFocus` (or equivalent) on Cancel; capture the
trigger element's ref before opening and call `.focus()` on it in the close handler,
including the Escape and backdrop-click paths.

## 3. A dropdown rendered inside a modal needs its own z-index tier

**Rule.** A dropdown/popover/select that can open while a modal is open uses a dedicated
`dropdown-in-modal` z-index value, strictly above the modal's, never the plain
`dropdown` value.

**Why it bites.** Most component libraries portal dropdown content to `document.body`.
If that content uses the ordinary `dropdown` z-index and the modal's overlay sits higher,
the options render visually on top but sit *under* the modal's pointer-event layer — they
appear but cannot be clicked. This reads as a broken component, not a stacking bug.

**The fix.** Ladder: `dropdown` < `modal` < `dropdown-in-modal` < `toast`. Any
dropdown-capable component used inside a modal must consume the `dropdown-in-modal` token,
not `dropdown`.

## 4. Destructive microcopy names the real consequence and the real count — with `_zero`/`_um` variants

**Rule.** A destructive confirmation states the actual, specific consequence (what data
is deleted, what cascades) and the actual count of affected items — never a generic "Are
you sure?". Any count-based message needs `_zero` and `_um` (`_one`) plural forms, not
just the plural.

**Why it bites.** A message hard-coded to the plural form ("As **1** aulas serão
removidas…") reads as broken at `n = 1`, and at `n = 0` a message like "o progresso dos
alunos será apagado" over-promises destruction of something that does not exist — the
inverse failure. A vague message also lets a user delete more than they meant to because
they never saw what would actually happen (a cascade like `ON DELETE CASCADE` on
dependent rows).

**The fix.** Confirm the real cascade in the schema/data layer before writing the
message. Provide `_zero`, `_um`/`_one`, and the general plural form; select by the actual
count, never assume plural.

## 5. Feedback text always uses the `fg` slot — never `solid`

**Rule.** Text rendered on a feedback color (success/warning/danger/info) reads from that
feedback family's `fg` token. `solid` is reserved for fills — buttons, badges, filled
icons — never for text color.

**Why it bites.** `solid` values are tuned to be legible *as a fill* (against a neutral
background), not tuned for contrast when used *as text*. Using `solid` for text produces
a color that looks "on brand" in the design tool but frequently fails WCAG contrast
against the surrounding surface.

**The fix.** Three slots per feedback color: `solid` (fills), `fg` (text/icons on a
neutral surface), `subtle` (tinted backgrounds). Text always reads `fg`.

## 6. Light text on a saturated accent fails AA — check the pair, don't assume

**Rule.** Never assume an accent color is dark enough (or light enough) to carry the
opposite text color at an acceptable ratio. Compute the ratio for every fg/bg pair that
actually appears together, including "primary button" combinations.

**Why it bites.** A brand-saturated accent (a vivid blue, a bright teal) frequently sits
right at the edge of AA and slides under it once designers nudge the hue for
"personality". The bug hides in plain sight because the pairing looks fine to a
sighted reviewer at full attention and fails only under the numeric ratio.

**The fix.** Every accent gets a computed `foreground` paired specifically for AA
(commonly this means a near-black or near-white foreground chosen by measurement, not by
habit). This is exactly what `docs/design/contrast.md` exists to catch — see
`tokens-engineer`'s contrast-matrix output.

## 7. An empty state says what will happen when the list fills, not just "add your first item"

**Rule.** An empty state names the *purpose* of the eventual content, not just a call to
action to add the first item.

**Why it bites.** A generic "No items yet. Add your first item." tells the user nothing
about what the section is for or what changes once it has content. For a genuinely empty
section that is empty *by design* (e.g., a module with zero lessons), a bare empty state
is indistinguishable from a broken product.

**The fix.** State what appears here once populated and, where relevant, what happens for
the end user while it stays empty (e.g., "Sem módulos ainda. Quando você publicar o
primeiro, ele aparece aqui para o aluno."). An empty collapsible/accordion should render a
real `EmptyState`, never nothing.

## 8. A success message reports the number that matters, not "Success!"

**Rule.** A success confirmation states the concrete outcome with its number when a
number is meaningful ("3 invoices sent", "12 lessons removed") — never a bare "Success!"
or "Done!".

**Why it bites.** A generic success toast gives the user no way to sanity-check that the
action did what they expected (correct count, correct scope). For bulk or cascading
actions this is the only feedback the user gets that the blast radius matched their
intent.

**The fix.** Compose the message from the actual result of the operation, not a static
string. If the operation has no countable outcome, name the specific thing that changed
instead of the generic verb.

## 9. Never pre-select a value in a field the user cannot change afterwards

**Rule.** If a field becomes immutable after submission (a plan tier, a slug, a
one-time choice), never ship it with a default pre-selected. Force an explicit choice.

**Why it bites.** A pre-selected default in an immutable field is the single easiest way
to produce silent, expensive user error — the user tabs through the form trusting the
default and locks in a choice they never made deliberately.

**The fix.** Leave the field unselected (or require an explicit confirm step) whenever
its value cannot be changed later. Mutable fields can default; immutable ones cannot.

## 10. A 409 conflict gets its own message naming the conflicting field — never the generic error toast

**Rule.** A `409 Conflict` (or equivalent optimistic-concurrency / uniqueness failure)
surfaces a message that names the specific field or resource in conflict. It never falls
through to a generic "Something went wrong" error toast.

**Why it bites.** A generic error toast on a conflict leaves the user re-submitting the
same doomed request, or abandoning the flow, because they have no idea what actually
collided (a duplicate slug, a stale edit, a race with another admin).

**The fix.** Map `409` to a dedicated message template that interpolates the conflicting
field/value, distinct from the catch-all error path used for `5xx`/network failures.

## 11. Every rule above is checkable in review — cite the rule number

**Rule.** Every rule in this file is written to be checkable by inspection, not by
vibes. When `design-enforcer` flags a violation of one of rules 1–10, it cites the rule
number (e.g., "Rule 5: feedback text using `solid` instead of `fg`").

**Why it bites.** An enforcer that says "this feels off" instead of citing a rule cannot
be argued with, cannot be automated further, and trains reviewers to distrust the report.
A rule number is falsifiable — either the diff violates it or it doesn't.

**The fix.** Findings that invoke this file always include the rule number. If a finding
doesn't map to a numbered rule here, it belongs under manifest/AGENTS.md drift instead,
not under "hard-won rules".

---

## How to use this file

- **`component-builder`** checks its own output against this list before returning to the
  director. A screen that violates one of these rules is not done, even if it otherwise
  matches the tokens and the brief.
- **`design-enforcer`** cites rule numbers in findings when a violation matches one of the
  eleven rules above, instead of describing the same problem in free text.
