# App References DNA — Canonical Mobile References

Catalog of reference apps that steve-designer proposes during Phase 3 when the project is mobile. Same format as `awwwards-dna.md`: what each app is *actually doing*, not "it looks nice".

**How to use:** During Phase 3, after Discovery reveals the project is mobile or hybrid, match the vibe/audience/tension to 2-3 entries. Users may also bring their own references (App Store screenshots, Mobbin links, real apps they use daily) — treat those the same way.

**Why this catalog exists separate from Awwwards:** mobile has constraints and idioms that web doesn't — thumb reach, safe areas, gestures, haptics, platform conventions (iOS vs Android). A reference that works beautifully on web often fails on mobile without translation.

---

## Editorial calm

Apps where restraint is the feature.

### Things 3 — culturedcode.com/things
**DNA:** Aggressive whitespace. Pale blue accent is the only color. Typography hierarchy does ALL the work — no icons-as-buttons, no color-coding for state. Every gesture has a haptic. Animations at 250-300ms with custom cubic-bezier easing, not stock. Navigation is deliberately flat (few screens deep).
**Pull from Things when:** productivity tool for focused users, craft matters more than feature count.
**Don't pull when:** novice users — Things assumes you understand its model.

### Oak (meditation) — oakmeditation.com
**DNA:** Serif display, single accent color, heavy vertical whitespace. Most screens have 1-3 interactive elements. Motion is slow (400-500ms) and organic — breathing rhythms, never spring physics. Dark mode is primary. Content-first; chrome is almost invisible.
**Pull from Oak when:** wellness/calm/focus app, audience wants to slow down.
**Don't pull from Oak when:** app has >5 primary actions per screen. Oak's sparsity works because there's little to do.

### Copilot (personal finance) — copilot.money
**DNA:** iOS-native feel refined past default. Serif for numbers and headlines, San Francisco for everything else. Category colors are muted pastels, not bright. Charts are simplified past the point of information loss and back — less data, but the data that matters. Haptic-heavy on every commit action.
**Pull from Copilot when:** financial app that needs warmth, iOS-first audience.

### Bear (notes) — bear.app
**DNA:** Monospace for code, serif for body, sans for chrome. Theme system is first-class (10+ themes ship). Markdown-first writing. Minimal iconography — text labels preferred. Swipe gestures do most of the work.
**Pull from Bear when:** writing/notes app, craft audience, multiple-theme support is a feature.

---

## High personality

Apps where voice is loud.

### Arc Search — arc.net/search
**DNA:** Bold rounded sans. Saturated orange-coral accent. Generous padding. "Browse for me" pulse animation is iconic — spring-based, visible. Type sizes are larger than iOS default. Every AI response has a friendly preamble. Pull-to-refresh has a custom animation, not stock.
**Pull from Arc Search when:** AI-first consumer app, audience wants warmth and personality.

### BeReal — bere.al
**DNA:** Black + white + yellow, nothing else. Type is default SF but used at atypical scales (huge or tiny, nothing in between). Zero skeuomorphism, zero gradients. UI feels like a magazine cover.
**Pull from BeReal when:** social/youth/authentic product, irreverence is earned.

### Cash App — cash.app
**DNA:** Black dominant, neon green accent. Monospace for the dollar amount (central to the experience). Custom cursor-equivalent on mobile — haptic on every touch. QR codes treated as primary UI, not hidden setting. Home screen is deliberately uncluttered.
**Pull from Cash App when:** consumer finance for younger audience, payment-first, irreverence welcome.

### Marvis Pro (music player) — marvis.app
**DNA:** Customization-forward. Dark backgrounds with dynamic color extraction from album art. Typography is smaller than iOS default — power-user bias. Haptics on scrubbing, playlist reordering. Very dense information architecture.
**Pull from Marvis when:** power-user app, customization is a feature, audience is enthusiasts.

---

## Density with calm

Apps that carry a lot of information without feeling heavy.

### Linear Mobile — linear.app
**DNA:** Carries the web app's DNA to mobile — same palette, same type system, same motion timings. Mobile-specific: larger tap targets, bottom sheet for most secondary actions, swipe-to-archive/swipe-to-prioritize as primary gestures. Keeps information density high without cramping.
**Pull from Linear Mobile when:** B2B tool with existing web product, engineering audience, density respected.

### Things 3 (already above, but also fits here)
See above.

### Notion Mobile — notion.so
**DNA:** Same content model as web, but navigation is restructured for thumb. Heavy use of bottom sheets. Block editing via long-press + drag. Creates density without cramping by deferring chrome — toolbar only appears when editing.
**Pull from Notion when:** content-heavy productivity app, need to carry web patterns to mobile faithfully.

### Cron (now Notion Calendar) — calendar.notion.so
**DNA:** Calendar grid honest to real time density. Uses muted event colors rather than saturated. Tight typography. Command palette accessible via gesture. Motion used to show relationships between time views (day → week → month), never decoration.
**Pull from Cron when:** scheduling/calendar app, productivity audience.

---

## Motion-forward

Apps where motion carries the experience.

### Apple Invites / iOS default apps
**DNA:** Apple's HIG taken to its limit. Spring physics (iOS-native) on every transition. Content transforms rather than fades. Haptics calibrated per interaction type. Never add motion that wasn't free.
**Pull from Apple when:** iOS-first audience, platform-native feel is a goal.

### Duolingo — duolingo.com
**DNA:** Mascot-driven personality. Spring-based bouncy motion on success states. Custom sound for every interaction. Haptics on correct/incorrect. Streaks, XP, leagues gamification woven into core UI. Bright rounded sans (Feather).
**Pull from Duolingo when:** education/habit/gamified app, audience includes non-adults, engagement is the product.

### Rise (sleep tracking) — risescience.com
**DNA:** Visualization-first. Sleep data as flowing organic shapes. Motion tied to actual data (your sleep curve wiggles based on your actual night). Palette shifts from blue (evening) to orange (morning) across the app. Haptic patterns themed to the "zone" of the app.
**Pull from Rise when:** wellness data app, visualization is the primary output.

---

## Utility-first

Apps where the UI disappears so the task can happen.

### Halide (camera) — halide.cam
**DNA:** Pro-camera app that hides depth. Main screen has fewer controls than iOS Camera. Advanced controls accessed via swipe, not menu. Text labels minimal; iconography + gesture does most work.
**Pull from Halide when:** pro tool for consumer audience, power under simplicity.

### iA Writer — ia.net/writer
**DNA:** Writing app stripped to the plank. Default theme is black text on paper-white. Single font (custom, IBM Plex-based). No formatting toolbar visible until needed. Zero color. Focus mode dims everything except current line.
**Pull from iA Writer when:** single-purpose tool, audience wants to focus.

### Instapaper — instapaper.com
**DNA:** Reader that respects typography as primary UX. Font choices are declared theological positions (Lyon, Whitney, etc.). Night mode shifts across three levels. Annotations inline. Navigation is secondary to reading surface.
**Pull from Instapaper when:** reading/content consumption app, typography-first.

---

## Financial / trust-heavy

Mobile finance that avoids the generic bank-app look.

### Revolut — revolut.com
**DNA:** Card-metaphor UI. Every major action is a card that flips or reveals. Categorized spending with emoji/icon per merchant. Color-coding used sparingly. Chart animations are educational, not decorative.
**Pull from Revolut when:** modern bank/fintech for digitally native audience.

### Monzo — monzo.com
**DNA:** Distinctive hot coral in physical card translated to digital restraint. Clean sans throughout. Savings pots as discrete visual objects. Transaction details include merchant logos and maps — honest, useful.
**Pull from Monzo when:** UK or EU-based fintech, approachable + trustworthy balance.

### Stripe Dashboard Mobile — stripe.com
**DNA:** Web app ported with discipline. Same color system, same type system. Navigation simplified to 3-4 primary sections. Charts are readable at mobile sizes (the web's aren't, directly). Data density preserved.
**Pull from Stripe Mobile when:** B2B fintech mobile companion to existing web.

---

## Platform discipline matters

A note that doesn't apply to web:

**iOS-first projects** should heavily lean on apps that respect iOS conventions (Things, Halide, Apple's own). Motion feels *wrong* if it's not spring-based. Navigation patterns (bottom tab, nav stack, modal) should be default unless there's a reason not to be.

**Android-first projects** should pull from Material You apps (Google's own, Plex, PocketCasts). Rounded corners, larger touch targets, elevation as depth, FAB for primary action.

**Cross-platform projects** usually need a stronger brand identity to override the platform conventions — because you're going against the grain on at least one platform. Pull from apps that explicitly don't follow iOS or Android conventions (Discord, Spotify) and succeed through brand weight.

---

## Composition examples

**"Focus tool for writers":**
- Dominant: iA Writer (typography-first, zero chrome)
- Accent 1: Bear (theme system, swipe gestures)
- Accent 2: Things 3 (motion timing, haptic discipline)

**"Modern fintech for Gen Z":**
- Dominant: Cash App (neon accent, monospace for amounts, irreverent)
- Accent 1: Revolut (card metaphor, education-through-animation)
- Accent 2: BeReal (type at atypical scales, minimal color)

**"AI companion app":**
- Dominant: Arc Search (warmth, spring motion, friendly copy)
- Accent 1: Duolingo (personality, sound, haptic richness) — use cautiously, can become infantile
- Accent 2: Copilot (serif numbers, iOS discipline) — balance the warmth with craft

**"Meditation / wellness":**
- Dominant: Oak (sparse, slow motion, dark primary)
- Accent 1: Rise (data-tied motion)
- Accent 2: Things 3 (haptic calibration)

---

## When user supplies their own app references

Accept:
- **App Store screenshots** — read visually, extract DNA
- **Mobbin links** — fetch and analyze (if possible)
- **App names** — ask the user what specifically drew them. Don't assume.
- **Video/GIF of interaction** — read for motion DNA

Same rule as web: describe back what you see, don't just agree. If an app the user loves conflicts with their Discovery answers, flag it.

## When no canonical reference fits

Some mobile categories are barely represented in "design reference" culture — enterprise B2B apps, regulated industries, specific cultural contexts. If Discovery produces something the catalog doesn't cover, say so and ask the user for 2-3 apps from their world.
