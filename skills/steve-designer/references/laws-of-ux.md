# Laws of UX

Eighteen well-known UX laws and heuristics, rewritten as rules Steve can check. A law
that says "reduce cognitive load" is a slogan. A law that says "one primary-variant
button per view" can be counted in a diff or on a screenshot. Each entry below follows
the same shape:

**Rule** (what must be true) → **Check** (how a reviewer verifies it, in code or on a
screenshot) → **Fix** (the concrete change when it fails).

Rules are cited by ID (`UX-1` … `UX-18`), the same way `references/hard-won-rules.md` rules are
cited by number. A finding that names a law without its ID and without a located
element is not a finding.

These are heuristics, not physics. When the brief or `docs/design/design-doc.md`
documents a deliberate exception (an expert tool that intentionally shows 20 actions, an
editorial site that breaks a convention on purpose), the documented exception wins and
the reviewer cites it instead of flagging the law.

---

## UX-1. Hick's law — fewer, clearer choices per decision

**Rule.** Each view has **one** primary action. Top-level navigation, tab bars and menus
stay at or below ~7 items before they are grouped. An option list longer than ~10 items
gets search, filtering or grouping. Advanced or rare options sit behind progressive
disclosure ("More options", an overflow menu, a secondary step), not in the main path.

**Check.** Count primary-variant buttons per view (more than one is a finding). Count
top-level nav/tab items. For `select`, radio groups and menus, count options and look
for search or grouping.

**Fix.** Demote competing actions to secondary/ghost variants. Group navigation into
sections. Replace long flat lists with a searchable combobox or grouped options.

## UX-2. Fitts's law — big enough, close enough, far from danger

**Rule.**
- Interactive targets are at least **44×44 CSS px** (44pt iOS, 48dp Android). The hard
  floor is **24×24 px** (WCAG 2.2 SC 2.5.8). Below it is a blocking finding.
- Adjacent targets have at least 8px between their hit areas.
- The primary action sits close to the content it acts on. On mobile it sits in the
  thumb zone (bottom of the screen), not the top corner.
- Destructive actions are not placed next to the frequent action they could be confused
  with (Delete next to Save, Remove next to Edit).
- When a whole row or card is the target, the whole row or card is clickable, not just
  its title. Checkbox and radio labels toggle their control.

**Check.** Measure icon buttons, close buttons, inline links in dense tables and
pagination. In code, look for icon-only buttons sized only by their glyph, and for
`<label>` elements not bound to their input.

**Fix.** Pad the hit area (padding or `::before` expansion) without growing the visual
glyph. Bind labels. Move the primary action next to its content or into a sticky bottom
bar on mobile. Separate destructive actions spatially or move them into an overflow menu
with confirmation.

## UX-3. Jakob's law — users expect your product to work like the others

**Rule.** People spend most of their time on other products, so standard patterns stay
standard: the logo links home, links look like links, search and account sit where users
look for them, native controls keep their keyboard and screen-reader behavior, and
platform conventions (iOS vs Android, `references/app-references.md`) are respected.
Personality lives in the visual layer, not in reinvented mechanics, unless the brief
documents why (see `references/when-to-resist-awwwards.md`).

**Check.** Look for reinvented standard controls (a custom select without keyboard
support, scroll hijacking, a custom scrollbar), unconventional placement of navigation
or account, and gestures that override platform behavior.

**Fix.** Use the native or inventory control and restyle it. Move navigation and account
to conventional positions. Record any deliberate break in the design doc.

---

## UX-4. Law of proximity — related things sit closer

**Rule.** The space **inside** a group is visibly smaller than the space **between**
groups, by at least one step on the spacing scale. A label is closer to its own field
than to the previous field. A heading is closer to the content it introduces than to the
content above it.

**Check.** Compare the gap above a heading with the gap below it. Compare label-to-field
spacing with field-to-next-label spacing. Equal spacing everywhere is a finding.

**Fix.** Tighten intra-group spacing and widen inter-group spacing using adjacent scale
steps (e.g. `space-2` inside, `space-6` between).

## UX-5. Miller's law — chunk what people must hold in mind

**Rule.** Information the user must remember or compare is chunked into groups of
about 5 to 9: form sections, wizard steps, comparison rows, settings groups. Long codes
and numbers are displayed in chunks (`1234 5678 9012 3456`, `+55 11 91234-5678`). The
user never has to remember information from one screen to use it on the next; the UI
shows it again.

This is not a cap on content. A scrolling list of 200 emails does not violate Miller's
law. A form with 23 ungrouped fields does.

**Check.** Count ungrouped fields in a form section, ungrouped settings, and steps in a
wizard. Look for raw unformatted long numbers. Look for a step that asks for something
shown only on a previous step.

**Fix.** Split into titled groups. Format long values with a display mask. Repeat the
needed context (a summary panel, the selected plan, the order total) where it is used.

---

## UX-6. Doherty threshold — respond in under 400ms, or show progress

**Rule.**
- Direct manipulation (press, toggle, drag) gives visual feedback within **100ms**
  (Nielsen's "instantaneous" limit; Doherty & Witt's finding is the 400ms one below).
- Any operation that can take longer than **400ms** shows a pending state: a skeleton
  for content, a loading state on the button that triggered an action. A trigger in
  flight is disabled, so it cannot be submitted twice.
- Beyond ~1s, the progress has context ("Uploading 3 of 12"). Beyond ~10s it is
  determinate, and the user can leave and come back.
- Low-risk, reversible actions (like, archive, reorder) are optimistic: the UI updates
  at once, offers undo, and rolls back on failure.

**Check.** Every async handler in the diff sets a pending state that the UI renders, and
the trigger is disabled while pending. Content loads show a skeleton shaped like the
content, not a full-page spinner. An async action that lacks either a rendered pending
state or a double-submit guard is a blocking finding.

**Fix.** Wire the pending state to the button (`loading`, `aria-busy`, `disabled`).
Replace generic spinners with content-shaped skeletons. Make reversible actions
optimistic with undo.

## UX-7. Von Restorff effect — one thing stands out, on purpose

**Rule.** The element that most deserves attention (usually the primary action or the
key figure) is the only one visually isolated by color, weight, size or motion. The
accent color is spent on that, not on decoration. When everything is highlighted,
nothing is. Isolation never relies on color alone: it also changes shape, weight or
label, for color-blind users and for WCAG 1.4.1.

**Check.** On a screenshot, count the elements filled with the accent or otherwise
dominant above the fold. More than one competing for the eye is a finding. In code,
look for the accent token on non-interactive decoration.

**Fix.** Keep the accent on the single primary element. Return the others to neutral
tokens. Add a non-color cue (icon, weight, label) to the isolated element.

## UX-8. Serial position effect — first and last are remembered

**Rule.** The most important items sit at the **start and end** of a sequence:
navigation, lists of options, onboarding steps, pricing tiers, settings sections. The
key action is never buried in the middle of a long menu.

**Check.** In each nav, menu or list, locate the item that maps to the screen's core
task (see UX-18). If it sits in the middle of 5+ items, flag it.

**Fix.** Move the core item to the first position (or the last, for "end" actions like
Checkout or Save). Put the rarely used items in the middle or in overflow.

## UX-9. Peak-end rule — design the peak and the ending

**Rule.** People judge an experience by its most intense moment and its end, so both are
designed on purpose. Every flow that completes something (signup, checkout, publish,
import) ends on a designed completion state. That state names the outcome with its
number (`references/hard-won-rules.md` rule 8) and offers the next step. It does not drop the user
on a blank list with a toast that disappears. Failure at the end of a flow (payment
declined, import failed) keeps everything the user entered and offers a direct way to
recover.

**Check.** For each multi-step flow in scope, find the end state. Is it a real screen or
panel with outcome and next step? Trigger the final-step error: is the user's input
preserved?

**Fix.** Add a completion state with outcome and next action. Preserve form state on
final-step errors and put the recovery action in the error message.

## UX-10. Zeigarnik effect — show what is unfinished, and keep it

**Rule.** People remember unfinished tasks. Flows with **3 or more steps** show progress
(step *n* of *m*, or a progress bar) and what remains. Leaving mid-flow never loses
work: drafts save automatically, and returning offers to resume. Onboarding and setup
use a visible checklist with completion state.

**Check.** Count the steps in each flow. With 3 or more, look for a progress indicator.
Navigate away mid-flow and come back: is the input still there?

**Fix.** Add the progress indicator. Persist drafts (local or server) and add a
"Continue where you left off" entry point.

## UX-11. Law of Prägnanz — the simplest reading wins

**Rule.** People read complex visuals in their simplest form, so the UI uses the simplest
form that carries the meaning: a small set of shapes, one radius family, edges aligned
to the grid, one container treatment per level of hierarchy, and icons whose meaning is
unambiguous (or labeled).

**Check.** On a screenshot, count distinct border, shadow and radius treatments at the
same hierarchy level, look for misaligned edges, and find icon-only controls whose
meaning is not obvious.

**Fix.** Collapse to one treatment per level using the tokens. Align to the grid. Label
ambiguous icons or replace them with text.

---

## UX-12. Law of similarity — same behavior, same look

**Rule.** Elements that behave the same look the same, and elements that behave
differently look different. All links share one style. Buttons with the same role use the
same variant on every screen. A non-interactive card or badge never looks like a button,
and an interactive element never looks like static text.

**Check.** Compare same-role elements across the diff and the existing screens: same
component, same variant? Look for clickable `div`s styled like plain text, and for static
chips styled like buttons. This overlaps `design-enforcer` check 2 (wrong component
choice). Cite `UX-12` when the harm is perceptual.

**Fix.** Use the inventory component and variant that already carries that role. Give
interactive elements the affordance tokens (hover, focus, cursor). Remove button styling
from static elements.

## UX-13. Uniform connectedness — what is connected reads as related

**Rule.** Elements that belong together are visually connected: a shared container or
background, a connecting line (stepper, timeline), or a shared border. Elements that do
not belong together are never connected by accident: no shared border running across
unrelated items, no single card holding two unrelated actions.

**Check.** In steppers, timelines, label/value pairs and grouped filters, confirm the
connection is visible. Look for containers that merge unrelated content.

**Fix.** Wrap the related items in one surface, or add the connector. Split the
accidental container into two.

## UX-14. Tesler's law — the system absorbs the complexity

**Rule.** Every task has irreducible complexity, and the product, not the user, carries
as much of it as possible. The UI never asks for data the system already has or can
infer: locale, timezone, currency, card brand, the address from a postal code, the
user's own email. It offers smart defaults, **except** in fields that cannot be changed
later (`references/hard-won-rules.md` rule 9 wins). Experts keep a path to the full control that the
defaults hide.

**Check.** Look for fields that duplicate known profile or session data, card-brand or
country pickers that could be detected, and empty fields with an obvious default.

**Fix.** Prefill and let the user edit. Detect instead of asking. Put the advanced
control behind an "Advanced" disclosure instead of removing it.

## UX-15. Postel's law — liberal in what you accept, strict in what you show

**Rule.** Inputs accept the common variants of a value. Phone numbers come with or
without punctuation. Dates use the locale's format. Codes and emails are pasted with
stray spaces, and emails in any case. The UI normalizes them silently instead of
rejecting them. Validation runs on blur or submit, not on every keystroke while the user
is still typing. Every error message says how to fix the value, not only that it is
wrong. Output stays consistent: one display format per data type across the product.

**Check.** Look for strict `pattern` attributes or validators that reject formatting
characters, `maxLength` limits that cut off pasted values with separators, validation
wired to `onChange`, and errors that say only "Invalid". Look for the same data type
displayed in two formats.

**Fix.** Strip and normalize before validating. Use input masks that format as the user
types instead of rejecting. Move validation to blur or submit. Rewrite errors to state
the expected form ("Use 8 digits, e.g. 01310-100").

---

## UX-16. Parkinson's law — make the task take less time

**Rule.** The UI shortens the task instead of letting it expand: fewer fields, autofill
everywhere it applies, the correct mobile keyboard, and no steps that exist only for
ceremony. When a task is necessarily long, the UI says how long ("about 2 minutes").

**Check.** Every form input has the correct `type` (`email`, `tel`, `url`, `number`
only for real quantities), `inputmode` where needed, and `autocomplete` tokens
(`email`, `name`, `street-address`, `cc-number`, `one-time-code`, `new-password`…).
Look for confirmation steps or fields that collect nothing the task needs.

**Fix.** Add `type`, `inputmode` and `autocomplete`. Remove optional fields that serve
no downstream use. Merge ceremonial steps. Add a time estimate to long flows.

## UX-17. Occam's razor — nothing without a job

**Rule.** Every element on the screen earns its place by serving the user's task. If an
element can be removed without hurting the task, remove it. That covers duplicated
information, decorative containers, explanatory copy that restates the label, and a
third button variant nobody needed. Between two designs that both work, ship the one with
fewer elements, variants and states.

**Check.** For each element, ask: what breaks if it is gone? Look for the same data shown
twice on one screen, copy that restates its heading, and decorative elements with no
information.

**Fix.** Remove it. If it is kept, the reason goes into the screen contract.

## UX-18. Pareto principle — the vital few get the best of everything

**Rule.** Roughly 20% of the features carry 80% of the use. The screen contract (or the
brief) names the **core tasks**, and those tasks get the top-level placement, the
shortest path, the primary action and most of the polish budget. Rarely used features
live in secondary navigation, overflow menus or settings.

**Check.** Does the screen contract name its core tasks? Is the view's single primary
action (UX-1) one of them? Is a rare feature occupying prime position or the accent?

**Fix.** Name the core tasks in the screen contract. Move the rare features out of prime
position. Spend the critic's critical and high fixes on the core flows first.

---

## Severity

| Severity | Laws | When |
|---|---|---|
| **Blocking** | UX-2 | Target below the 24×24 px WCAG floor |
| **Blocking** | UX-6 | Async action that lacks a pending state or a double-submit guard |
| **Warning** | All others, and UX-2 between 24 px and 44 px | Located, citable departures from the rule |

A Warning becomes Blocking only when `docs/design/design-doc.md` §10 marks the law as
"cravado" (nailed down). In that case it is enforced as a paid rule (enforcer check 8).

## How to use this file

- **`component-builder`** checks its output against UX-1, UX-2, UX-4, UX-6, UX-12,
  UX-15 and UX-16 before returning. These are the ones verifiable in the code it just
  wrote. It reports any departure in its self-critique, with the law ID.
- **`design-enforcer`** checks the diff for the laws visible in code: UX-1, UX-2, UX-3,
  UX-6, UX-10, UX-12, UX-14, UX-15 and UX-16. It cites the ID in each finding and uses the
  severity table above.
- **`design-critic`** scores the **Usability** dimension against all eighteen, using the
  screenshots. The perceptual laws (UX-4, UX-5, UX-7, UX-8, UX-9, UX-11, UX-13, UX-17,
  UX-18) can only be judged there. Every usability critique cites its law ID.
- **The director** uses UX-18 when writing a screen contract: it names the core tasks, so
  UX-1 and UX-8 have something to check against.
