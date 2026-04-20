# Anti-patterns — What to actively avoid

The catalog of moves that make AI-generated UI look AI-generated. Steve-designer exists in large part to prevent these. Read during build phases; reference during critique.

---

## Visual anti-patterns

### The default purple gradient
`bg-gradient-to-br from-purple-500 to-pink-500` or any variant. If you see pink-to-purple, pink-to-blue, or pink-to-orange gradients on a hero, it's AI-default. **Fix:** pick ONE saturated accent and use it with neutrals; if gradient is used, make it from your actual palette (e.g., two shades of your primary color).

### Inter + system fallback with no display font
`font-family: Inter, system-ui, sans-serif` as the only type stack. Inter is fine but it's the AI default — it needs a distinct display font companion to feel crafted. **Fix:** pair Inter (or Geist, or SF) with a display font (Fraunces, Instrument Serif, Tiempos, GT Walsheim, a custom).

### Four saturated category colors
You'll see e-commerce or dashboard UIs where features get arbitrary bright colors — bright blue, bright green, bright orange, bright pink — none of them justified. **Fix:** limit palette to 3-4 total colors including neutrals. Category differentiation via type weight, position, or a single accent tier.

### Rounded-2xl everything
Card rounded-2xl, button rounded-2xl, image rounded-2xl, avatar rounded-2xl. Uniform large radii read generic. **Fix:** a radii ladder — cards smaller than buttons, buttons smaller than avatars, OR commit to a sharp radii identity (all 4px, all 0px).

### Soft shadow everywhere
`shadow-lg` or `shadow-xl` on every card, modal, button. **Fix:** shadows are hierarchical — main content flat, elevated content subtle, modals heavier. Three levels max.

### Emoji as UI decoration
Feature lists with 🚀 ⚡ 🎨 💡 🔥 next to each item. Screams AI-generated content. **Fix:** custom icons from a discipline set (Lucide, Phosphor, custom), or no icons.

### The three-column feature grid
Three icons across, each with a 2-word headline and a 15-word description. Universally identifiable as AI-generic. **Fix:** break the grid. Use alternating rows. Use a single strong feature section instead of three weak ones. Or own the three-column pattern by making the content genuinely different from what LLM averages produce.

### Trust logos at 40% opacity
"Trusted by" strip with gray logos at low opacity. Nothing about the company actually says what the logos should say. **Fix:** either commit (single-color treatment, legible at 100%, real testimonial quote attached) or cut.

### Dark mode as an afterthought
Site is clearly designed in light mode first; dark mode is auto-inverted and reads muddy. **Fix:** pick ONE primary mode. Dark mode is not a free feature.

### Glassmorphism on everything
Frosted glass cards, frosted glass nav, frosted glass modals. Even if it's on-trend (2026 sees Apple's Liquid Glass return), overuse reads generic. **Fix:** use glassmorphism on ONE element per page, not every element.

---

## Motion anti-patterns

### All animations are 200ms ease-in-out
No hierarchy in motion timing. Everything feels the same speed. **Fix:** three timings — fast (100-150ms for tight interactions), base (200-300ms for reveals), slow (400-600ms only for heroic moments).

### Fade-in on every scroll
Every element fades from opacity-0 to opacity-100 as it enters viewport. **Fix:** motion is load-bearing — use it when it carries meaning (revealing important content, guiding attention). Static is often better.

### Bouncy spring physics for serious products
Using Framer Motion spring defaults on a fintech app. Reads playful when the product is serious. **Fix:** spring physics only where warmth is the brand. Ease curves for anything precise.

### Scroll-triggered parallax
Everything moves at different speeds on scroll. Disorienting, accessibility-hostile, and 2017. **Fix:** parallax is almost never justified. If you must, use it on ONE decorative element.

### Custom cursor everywhere
Cursor follows with a circle, or becomes a dot, or leaves trails. Fun for portfolios, wrong for tools. **Fix:** see `when-to-resist-awwwards.md`. Tools and conversion-first sites should have default cursors.

### Motion without `prefers-reduced-motion`
Nothing respects the OS-level motion preference. Accessibility failure. **Fix:** every animation wrapped or respects the media query. Non-negotiable.

---

## Copy anti-patterns

### "Elevate your workflow"
And all its cousins: "empower your team", "unlock productivity", "transform your business", "supercharge your growth". **Fix:** write what the product actually does. "Track invoices" beats "elevate your financial management".

### Generic testimonial structure
"Product X changed my life! — Happy Customer, Title, Company". Fake-feeling, non-specific. **Fix:** real names if possible, specific outcomes ("cut my support tickets by 40%"), skip if no real testimonials exist.

### "For teams that want to move fast"
Copy that describes no one in particular. **Fix:** get specific. "For engineering teams of 5-50". "For solo founders shipping weekly."

### The three-feature headline
"Fast. Beautiful. Simple." **Fix:** pick ONE thing the product is actually good at. Lead with that. "Simple" is never the thing.

### Placeholder lorem ipsum shipping to production
The component-builder subagent sometimes leaves lorem ipsum. **Fix:** no placeholder text ever. Ask the user for real copy, or write something specific and flag it.

---

## Layout anti-patterns

### Everything centered at max-width-7xl
Every section uses the same container. No variation in rhythm. **Fix:** vary container widths intentionally — some sections break out full-width, some constrain tighter. Rhythm is the point.

### 80px vertical padding between every section
Same rhythm everywhere reads uncommitted. **Fix:** a rhythm scale (e.g., 48/80/128/200) with deliberate usage. Some breathing rooms bigger than others.

### No visual hierarchy between sections
Every section has a 2-line headline + 1-line description + CTA + feature grid. Reads as a template. **Fix:** vary section structure. Text-only sections. Image-dominant sections. Long-scroll sections. Each doing a specific job.

### The infinite scroll landing page
22 sections, all equal weight, 10,000 pixels tall. **Fix:** 5-7 sections maximum. Each section earns its place.

### Two columns that add up to everything
Left column text, right column image, left column text, right column image... **Fix:** mix layouts. Two-column occasionally, but break to single-column, asymmetric, or grid when the content wants it.

---

## Token anti-patterns

### The 11-step neutral ramp you'll never use
`neutral-50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950`. You use maybe 4. **Fix:** 4-6 semantic tiers. `bg-base, bg-subtle, bg-muted, fg-base, fg-subtle, fg-muted`.

### Type scale with 10 levels
`text-xs text-sm text-base text-lg text-xl text-2xl text-3xl text-4xl text-5xl text-6xl`. Too many options → inconsistent use. **Fix:** 5-6 type sizes actively used. Label them semantically (display/headline/body/caption) rather than size-based.

### Every shadcn/ui default shipped as-is
Token file is just `@shadcn/ui`'s defaults. No project identity. **Fix:** keep shadcn as primitives, override the theme file completely with your tokens.

### Hardcoded hex values in components
Component uses `#1a1a1a` instead of `var(--fg-base)`. Breaks token system. **Fix:** every color reads from the token system. Every value. No exceptions.

---

## Process anti-patterns (the meta ones)

### Skipping Discovery for speed
User says "just build me a landing page", you skip Phase 2. Output is generic because you never decided what it should be. **Fix:** the 5-minute Discovery saves 2 hours of rework. Always.

### Accepting "modern, clean, minimal" as a vibe
Those three words describe every AI-generated site ever made. **Fix:** push back every time. Get specifics.

### Averaging three safe references
Linear + Vercel + Stripe. All excellent. Combined, they produce the average of excellent SaaS sites — which is... every SaaS site. **Fix:** one canonical + one accent + ONE improbable combination.

### Building the whole site before checkpointing
User asks for 5 sections, component-builder builds all 5, you show them all at once. Now you can't correct the first section without ripping the others. **Fix:** section-by-section, approval between each.

### Critic-last, then never again
Critic runs at Phase 6, produces 5 points, nothing happens with them. **Fix:** critic's output gets triaged with the user. Some fixed, some deferred (written down), some rejected (also written down).

### Forgetting the brief
Designer drift across 3 sessions because nobody read the brief on re-entry. **Fix:** read `design-brief.md` on every new session. Append every phase. Treat it as the truth.

---

## How to use this file during build

The `component-builder` subagent should check its output against this list before returning. If it finds itself doing any of these, stop and re-plan.

The `design-critic` subagent should reference this list when writing critiques — many critiques are instances of these anti-patterns, and naming the anti-pattern is more useful than just saying "this is off".

Steve-designer itself should reference this file in Discovery and References phases — especially when pushing back on generic vibes. "The vibe you described ('modern, clean, minimal') maps to these anti-patterns. Let's go deeper."
