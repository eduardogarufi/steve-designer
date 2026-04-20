# Awwwards DNA — Canonical Web References

A curated catalog of reference sites that steve-designer proposes during Phase 3 (References). Each entry documents the **DNA** — what the site is actually doing under the hood — not just "it looks nice".

**How to use this catalog:** During Phase 3, match the project's vibe/audience/tension (from Discovery) to 2–3 entries below. Explain the DNA, then propose the synthesis. If the user supplies URLs/screenshots, add them alongside; the catalog is a starting point, not an ending.

**Organization:** Grouped by dominant characteristic, not by industry. A fintech project might pull from "Editorial restraint" entries if the vibe calls for it.

---

## Editorial restraint

Sites where type does the heavy lifting and decoration is earned, not default.

### Linear — linear.app
**DNA:** Monochrome palette with one saturated accent (violet). Inter tightened to -0.02em, heavy on variable weight contrast. Information density treated as a feature, not a problem. No rounded corners on layout, only on interactive elements. Motion is sub-200ms, nearly subliminal. Deliberately fewer pixels than the user expects.
**Pull from Linear when:** the project values precision, speed, and information density. SaaS for technical users.
**Don't pull from Linear when:** the audience is consumer-first or emotional. Linear is cold by design.

### Vercel — vercel.com
**DNA:** Geist (their own font) + Geist Mono for technical labels. Black/white dominant, with geometry-driven gradient reveals only on hero. Very wide horizontal whitespace. Copy is short, declarative. "Build. Deploy. Scale." — never explained, always shown.
**Pull from Vercel when:** developer audience, product speaks for itself, want to feel engineered.
**Don't pull from Vercel when:** the audience needs persuasion or narrative.

### Stripe — stripe.com
**DNA:** The gradient animations on hero are actual canvas, not CSS — they signal technical confidence. Sohne font gives editorial warmth vs. Linear's coldness. Layout respects a 12-col grid so strictly that breaks feel intentional. Payment-diagram illustrations done as SVG line art, not 3D.
**Pull from Stripe when:** financial/trust-heavy product that needs warmth without losing precision. The gold standard for "enterprise that doesn't feel enterprise".

### Pitch — pitch.com
**DNA:** Sharp sans (GT Walsheim style) with very loose tracking on headlines, very tight on body. Dark mode is the primary theme; light is afterthought. Illustrations use a restricted palette (3–4 colors max per illustration). Scroll is smooth but motion within sections is deliberately fast (100–150ms).
**Pull from Pitch when:** creative tool for teams, dark-first makes sense, want to signal modern without being trendy.

### Aesop — aesop.com
**DNA:** Serif body (Suisse Works or similar), sans nav. No photography of models — only product. Massive whitespace. Layout shifts between column-dense and column-sparse deliberately to control reading pace. Zero motion except for the necessary (cart, menu open).
**Pull from Aesop when:** premium, crafted, mature audience. Any project where restraint signals confidence.
**Don't pull from Aesop when:** energy or approachability matters more than craft. Aesop is cold-premium, not warm-premium.

---

## High personality

Sites where voice is loud and that's the point.

### Arc Browser (marketing) — arc.net
**DNA:** Large round-cornered cards that contain illustrations of the product. Playful color blocks. Serif display font (Matter or similar) for emotional lines, sans for functional. Motion is generous — elements arrive from offscreen on scroll with spring physics. Cursor effects on interactive areas. The site feels like a product, not a page.
**Pull from Arc when:** consumer product, want to feel new, want warmth. Great for AI products that need to feel approachable.

### Teenage Engineering — teenage.engineering
**DNA:** Grotesque sans with irreverent typography sizes (headings 10x bigger than body). Restricted palette (often 2 colors + black + white). Product photography is clinical, flat, top-down. Information design borrowed from instruction manuals and airport signage. Totally unapologetic.
**Pull from TE when:** irreverence is a feature, audience appreciates craft-in-unusual-places. Great for tools, for hardware, for anyone whose product is physical-feeling.

### Rauno — rauno.me (portfolio)
**DNA:** Sharp editorial grid. Mixes prose-length blocks with tight technical specs. Type scale is unusual — very large display, very small body, nothing in between. Motion is deliberately absent except for cursor-reactive elements. Reads like a well-edited magazine.
**Pull from Rauno when:** portfolio, personal brand, thought leadership. Someone whose voice matters more than their visuals.

### Figma (marketing pages) — figma.com
**DNA:** Whisper sans + selective serif pull-quotes. Product demos as actual working embeds, not screenshots. Color blocks used to separate sections, but softer saturation than the Arc equivalent. Motion used to reveal product capability, never for decoration.
**Pull from Figma when:** product needs to demonstrate itself. Interactive-first marketing.

### Gumroad (older iterations) — gumroad.com
**DNA:** Brutalism redefined — Arial, flat colors, zero gradients, aggressive button shapes. The opposite of polish, on purpose. Pink + yellow + green as functional colors. Works because the brand is "honest, for creators".
**Pull from old-Gumroad when:** audience distrusts polish, authenticity is the brand, irreverence is earned. Warning: hard to execute — reads as "lazy" if not committed.

---

## Density with calm

Sites with lots of information that still feel breathable.

### Are.na — are.na
**DNA:** Swiss grid, monospace for metadata, serif/sans mix for body. Density is treated as content, not clutter. Minimal UI chrome. Content-first to an extreme — navigation is small, content is huge. Feels like a library.
**Pull from Are.na when:** content is the product, user scrolls to learn, density should feel like abundance not overload.

### The Browser Company (thebrowser.company)
**DNA:** Arc's marketing parent. Warmer illustrations, more narrative-driven than Arc itself. Heavy use of video demos inline. Serif display for quotes, sans for everything else. Typography-driven storytelling.
**Pull from TBC when:** narrative matters, multiple product lines to surface, warmth + depth.

### NYT Cooking — cooking.nytimes.com
**DNA:** Editorial grid inherited from print. Recipe metadata (time, yield) typographically distinct from body. Large photography, but cropped editorially rather than heroized. Type scale is smaller than web average — trusts the reader to lean in.
**Pull from NYT Cooking when:** content-dense, serious-but-friendly, editorial heritage matters.

### Substack (writer pages) — substack.com
**DNA:** Serif body, generous leading, minimal UI. The page disappears behind the content. Monetization prompts are small and deferred. Everything says "this is about the writing".
**Pull from Substack when:** content-first, writer/creator product, want invisible UI.

---

## Motion-forward

Sites where motion is load-bearing, not decoration.

### Framer (product pages) — framer.com
**DNA:** Their own engine, shown off. Sections morph, transition, scroll-sync. Type is secondary to motion. Danger zone — easy to over-borrow and end up with motion-for-motion's-sake.
**Pull from Framer when:** motion is a feature, audience expects it. Creative/design tools specifically.

### Apple (product pages) — apple.com
**DNA:** Scroll-synced video, generous whitespace between moments, type reveals keyed to scroll position. Heavy but performant — 60fps or nothing. Dark mode used when drama is needed, light when clarity is needed, sometimes transitioning mid-page.
**Pull from Apple when:** product deserves theatrical reveal, budget exists for the performance work.
**Don't pull from Apple when:** the team can't hit the 60fps bar. Fails hard if janky.

### Awwwards SOTD / Site of the Day homepage picks
**DNA:** Varies. Use as mood library, not template. The user's favorite — always welcome as a source.
**Pull when:** user explicitly references a recent SOTD or wants to "feel current".

---

## Financial / trust-heavy

Sites where the vibe must not read as frivolous.

### Mercury (mercury.com)
**DNA:** Warm sans (Söhne-adjacent). Soft palette — cream, deep blue, sparingly muted coral. Typography is primary, illustration is secondary. Data visualizations are honest (not decorative). Never puts marketing copy where a number should go.
**Pull from Mercury when:** fintech, B2B finance, needs warmth without losing seriousness.

### Wise (wise.com)
**DNA:** Brand green used aggressively. Accessible-first color contrast. Information design clear to the point of illustration. No stock photography, all custom illustration. Family-friendly sans.
**Pull from Wise when:** consumer financial product, approachability matters, global audience.

### Ramp (ramp.com)
**DNA:** Dark navy + white + muted orange. Product screenshots dominate, never stock. Type is Söhne-ish. Layouts are tight and gridded. Micro-interactions on hover are deliberately subtle — 100–150ms, 4–8px translations.
**Pull from Ramp when:** finance SaaS, B2B, wants to feel modern without being flashy.

---

## How to compose

During Phase 3, pick **one "dominant" reference** and **one or two "accent" references** from different categories. The dominant defines structure and palette. Accents provide specific moves (a typographic treatment, a motion pattern, a layout rhythm).

### Example compositions

**"Editorial premium feminine" for a food magazine:**
- Dominant: Aesop (editorial restraint, serif authority)
- Accent 1: NYT Cooking (editorial density, recipe metadata treatment)
- Accent 2: Teenage Engineering (irreverent typographic accents, sparingly)

**"Technical confidence with warmth" for a developer tool:**
- Dominant: Stripe (engineered warmth, gradient discipline)
- Accent 1: Linear (density, monochrome + violet accent)
- Accent 2: Rauno (editorial pacing in long-form content)

**"Approachable AI product" for consumers:**
- Dominant: Arc (round cards, warmth, motion generosity)
- Accent 1: Figma (interactive product demos)
- Accent 2: Mercury (warm palette restraint, serious enough to trust)

**"Content-dense publisher":**
- Dominant: Are.na (library-like density)
- Accent 1: Substack (serif warmth, invisible UI)
- Accent 2: NYT Cooking (editorial grid, metadata typography)

---

## When user supplies their own Awwwards links

Don't replace them — **add** them as a fourth reference alongside your proposed trio. Extract the DNA (palette, type, motion, density) visually, then describe it back to the user to confirm you saw what they saw. Do NOT just agree — if the Awwwards site's DNA conflicts with the Discovery answers, flag it.

Example: user says vibe is "calm and editorial" but sends an Awwwards link heavy with 3D motion and aggressive color. Say: "This one's doing a lot more than calm — the 3D and color palette are fighting your 'calm editorial' brief. Is the calm description still right, or did seeing this change what you want?"

---

## When no canonical reference fits

If Discovery produced something none of the above matches (rare but happens — e.g., a niche cultural project, a non-Western design context), say so. Then ask the user for 2–3 references from their world. Your catalog is a starting point, not a ceiling.
