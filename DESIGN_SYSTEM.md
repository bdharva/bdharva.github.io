# bdharva Design System

A reference for the visual language used on bdharva.com — extracted from `css/styles.sass`, `_layouts/`, and `_includes/`. Use this as a portable spec when applying the same look elsewhere.

The aesthetic is **quiet, editorial, and engineered**: warm off-black on near-white, a single mint accent, generous whitespace, mono-typed micro-labels, and small precise hover micro-interactions. No gradients except subtle photo overlays. No drop shadows except on lifted cards and modals.

---

## 1. Foundations

### 1.1 Color tokens

**Brand**
| Token | Light | Notes |
|---|---|---|
| `--accent` | `rgb(30, 200, 150)` | Mint/jade. The only saturated color in the system. Used for hover states, active links, CTA backgrounds. |
| `--accent-hover` | `rgb(50, 220, 170)` | Lighter accent for dark-mode link hover. |
| `--accent-deep` | `rgb(20, 170, 125)` | Darker accent for light-mode link hover (about credits). |
| `--accent-bg-soft` | `rgba(30, 200, 150, 0.06)` | Hairline tint for CTA cards, active menu items. |
| `--accent-bg-medium` | `rgba(30, 200, 150, 0.10)` | Hover state of CTA card. |
| `--accent-border` | `rgba(30, 200, 150, 0.20)` | CTA outline. |

**Surfaces (Light)**
| Token | Value | Notes |
|---|---|---|
| `--bg` | `rgb(255, 255, 255)` | Page background. |
| `--bg-medium` | `rgb(244, 246, 247)` | `.section.medium` and app-icon backdrops. Cool gray-2. |
| `--bg-card` | `white` | Feature cards, app-cards, modals. |
| `--bg-overlay` | `rgba(255, 255, 255, 0.96)` | Nav and post-topbar background (with `backdrop-filter: blur(12px)` on post-topbar). |

**Surfaces (Dark)**
| Token | Value | Notes |
|---|---|---|
| `--bg` | `#141413` | Page. Warm near-black, not pure. |
| `--bg-medium` | `#1a1a18` | Section medium / living-col background. |
| `--bg-card` | `#1e1e1c` | Feature, app-card, modal, mobile menu. |
| `--bg-overlay` | `rgba(20, 20, 19, 0.96)` | Nav. |

**Ink — Light mode** (text always uses `rgba(0, 5, 10, α)` — a *cool, slightly blue* near-black, never pure black)
| Alpha | Use |
|---|---|
| `0.9` | h1–h4, primary text. |
| `0.85` | Section labels, app titles, feature titles, post-brand. |
| `0.8` | Filter button active, hp-stat number, post body h2/h3. |
| `0.75` | About body. |
| `0.7` | Body paragraphs in posts and about. |
| `0.65` | Post body, code text. |
| `0.6` | Hero bio, hp-intro. |
| `0.55` | Tertiary copy, blockquotes, modal body. |
| `0.5` | Section meta, about-label, post-tagline. |
| `0.45` | Nav links (inactive), trait text, menu items. |
| `0.4` | Feature description, label text, post-nav-label, app-desc. |
| `0.35` | Footer social, gallery-back, thinking-desc. |
| `0.3` | Mono labels, dates, tags, post-date. |
| `0.25` | Footer copyright, post-footer span, hp-stat label. |
| `0.20` | Trait icons, external badges. |
| `0.10` | Hairline dividers. |
| `0.08` | Borders (nav, hr, card edges). |
| `0.06` | Borders (feature cards, thinking-item rows). |
| `0.05` | Code background, gallery thumb borders. |
| `0.04` | Connect button background, table hover. |
| `0.03` | Hover background, post body code. |
| `0.02` | Even-row table stripes. |

**Ink — Dark mode** (always `rgba(255, 255, 255, α)`)
| Alpha | Use |
|---|---|
| `0.9` | Hero greeting, hover link. |
| `0.85` | Headings, primary titles. |
| `0.75` | Post body h2/h3. |
| `0.7` | Connect CTA. |
| `0.6` | Body text, post-nav-title, link default. |
| `0.55` | Body copy, code. |
| `0.50` | Footer logo, mono mid. |
| `0.45` | Hero bio, modal body, about-label. |
| `0.40` | Feature description, dark trait text. |
| `0.35` | Nav links inactive, app-desc. |
| `0.30` | Tertiary copy, app-icon glyphs. |
| `0.25` | Mono labels, dates. |
| `0.20` | Trait icons, footer copyright. |
| `0.10` | Blockquote border. |
| `0.06` | All borders, dividers, card edges. |
| `0.05` | Code background. |
| `0.04` | Connect CTA background, hover background. |
| `0.02` | Even-row table stripes. |

> **Rule:** never use pure `#000` or `#fff` for text. Always step down through these alpha ladders so the eye reads structure as a tonal hierarchy, not a binary.

### 1.2 Typography

**Families**
- **Sans** — `'DM Sans', sans-serif`. Used for everything except mono labels. Loaded with full optical-size axis (`9..40`) and weight axis (`100..1000`).
- **Mono** — `'JetBrains Mono', monospace`. Used *only* for: mono labels, dates, stat labels, tags, code, and `.thinking-date`. Mono is the system's "engineering signature" — small, uppercase or low-case, used as connective tissue between rich content blocks.

**Weights**
- `400` body
- `500` UI labels, buttons, navigation, mono labels
- `600` headings, titles, brand, CTAs

**Type scale**
| Token | Size | Where |
|---|---|---|
| Display H1 | `2.625rem` (42px) | Default `h1`. Drops to `2rem` ≤960px, `1.5rem` ≤690px. |
| H2 | `1.5rem` (24px) | Default `h2`. Drops to `1.25rem` ≤690px. |
| H3 | `1.25rem` (20px) | |
| H4 | `1.125rem` (18px) | |
| Body | `1rem` (16px) | `p`, `li`, line-height `150%`. |
| Small | `0.875rem` (14px) | Code, table cells, descriptions. |
| Hero greeting | `1.5rem` / `600` | `.home-hero-greeting`. Drops to `1.25rem` ≤690px. |
| Hero bio | `1rem` / `400` / `1.65` lh | `.home-hero-bio`. |
| Page H1 (post/about/gallery) | `22–28px` / `600` / `-0.5px` | Pages don't reuse the display H1; they use a tighter editorial size. |
| Section label | `16px` / `500` | `.section-bar .section-label`. |
| Feature title | `17px` / `600` / `-0.2px` | `.feature .text .title`. |
| Card title | `15px` / `500–600` / `-0.2px` | `.thinking-title`, `.post-nav-title`. |
| App card title | `13px` / `600` / `-0.2px` | `.app-title`. |
| Nav link | `13px` / `500` / `-0.2px` | `nav .right a`. |
| Mono label | `11px` / `500` / `0.3px` | Dates, tags, stat labels. Often `text-transform: uppercase`. |
| Mono micro | `9–10px` / `500` / `0.5px` | `.hp-stat-label`, `.living-stat-label`. Always uppercase. |
| Trait label | `0.75rem` (12px) / `500` mono | `.home-hero-traits .trait span`. |

**Letter-spacing rules**
- Headings & titles: `-0.2px` to `-0.5px` (tighter the larger).
- Body sans: default (0).
- Mono labels: `+0.3px` to `+0.5px`.
- Logo / `.left a` in nav: `-0.5px`.

**Line-height**
- Body paragraphs: `150%` global, `1.65` for hero/about/post body.
- Headings: `1.25` (post-header h1), default for others.
- Tight UI: `1.5` (feature description).

**Text alignment**
- Default `p, li`: `text-align: justify` (global rule, but most page contexts override to `left`).
- Posts, about, hero bio: explicitly `left` or `center`.
- Hero blocks: `center`.

### 1.3 Spacing

The system uses a mix of **rems for type-relative spacing** and **px for layout grids**. There is no strict 4/8 grid — spacing is editorial, but these values appear repeatedly:

**Rem rhythm (in body flow)**
`0.25rem · 0.5rem · 0.75rem · 1rem · 1.25rem · 1.5rem · 1.75rem · 2rem · 2.5rem · 3rem · 5rem`

**Pixel rhythm (for layout)**
`4 · 6 · 8 · 10 · 12 · 14 · 16 · 20 · 24 · 28 · 32 · 40 · 48 · 52 · 64 · 84 · 96`

**Page-edge gutter (canonical)**
| Breakpoint | Gutter |
|---|---|
| Desktop | `52px` |
| ≤960px (tablet) | `2rem` (32px) |
| ≤690px (mobile) | `1.5rem` (24px) |

This `52px` value is the most distinctive measurement in the system — nav, footer, section content, gallery, living, shots, hp-header all use it.

**Section vertical rhythm**
- `.content` default: `padding: 96px` (vertical) on `800px` max-width.
- `.content.max`: `padding: 84px 52px`.
- Hero sections: `padding: 5rem 2rem` (home), `padding: 64px 52px 56px` (about hero).
- Post header: `72px 0 36px`.
- Post body: `40px 0 64px`.

### 1.4 Layout / breakpoints

| Breakpoint | Trigger |
|---|---|
| `1130px` | Side-by-side image-holder shrinks. |
| `960px` | Split-section stacks; nav padding shrinks; H1 shrinks. |
| `880px` | Nav links collapse to mobile menu; callouts/features stack; living-three stacks. |
| `768px` | Thinking page tightens; hp-header stacks. |
| `690px` | Mobile gutter; type sizes drop a step; footer stacks; gallery → 2-col grid; thinking-item compresses. |
| `600px` | Split-left features → single column. |

**Container max-widths**
| Width | Use |
|---|---|
| `680px` | Post body (with `+4rem` padding it becomes `calc(680px + 4rem)`). |
| `680px` | About inner. |
| `800px` | Default `.section .content`. |
| `960px` | Thinking page, gallery page. |
| `1200px` | `.content.full`, `.connect`. |
| none | `.content.max` (full-bleed with 52px gutter). |

**Grid patterns**
- **Feature grid** — `repeat(auto-fill, minmax(340px, 1fr))`, gap `16px`.
- **Split-left features** — `1fr 1fr` desktop, `1fr` ≤600px.
- **Split section** — `flex 2 / flex 1` with `48px` padding either side of a `1px` divider; stacks at 960px.
- **Living three** — `repeat(3, 1fr)` with `20px` gap; stacks at 960px.
- **Living banner** — `repeat(4, 1fr)`; → 2 cols ≤690px.
- **Gallery grid** — `repeat(auto-fill, minmax(200px, 1fr))`, gap `8px`; → 2 cols ≤690px.
- **Shots grid** — `repeat(auto-fill, minmax(260px, 1fr))`, gap `12px`; → 2 cols ≤690px.
- **Thinking item** — `60px 1fr 1.2fr auto`, gap `16px`; → `auto 1fr auto` ≤690px.
- **Footer / post-footer / post-nav** — `1fr auto 1fr` 3-col grid; stacks ≤690px.

### 1.5 Radius

A small, tight scale. The system never uses pill-rounding except on the dark-toggle, accent CTA pill, and circular avatars/badges.

| Token | Value | Use |
|---|---|---|
| `xs` | `3px` | Stripe row badges, table tints. |
| `sm` | `4px` | Image inline default (`0.25em`), gallery items. |
| `md` | `6px` | Feature cards, post-body code blocks, gallery toggle, filter buttons, shots. |
| `lg` | `8px` | Section content images, app-icon, post body images, slideshow buttons. |
| `xl` | `10px` | Shot modal, gallery thumb, CTA icon. |
| `2xl` | `12px` | Polaroids, living-col, mobile menu, dark-toggle pill (9px height). |
| `3xl` | `14px` | App-card. |
| `pill` | `24px` | Nav `.cta` (`height/2`). |
| `full` | `50%` | Headshot, accent badge, avatar. |

### 1.6 Borders

- All borders are **1px solid** with the alpha-token color.
- Light: `rgba(0, 5, 10, 0.06)` for cards/dividers, `0.08` for nav/hr/section dividers, `0.10` for hr.
- Dark: `rgba(255, 255, 255, 0.06)` (almost universal).
- Hover often steps borders up by one alpha step (`0.06 → 0.12`).

### 1.7 Shadows

A short, intentional set:

| Token | Value | Use |
|---|---|---|
| `shadow-avatar` | `0 2px 12px rgba(0, 0, 0, 0.08)` | Headshots, polaroids. |
| `shadow-card-hover` | `0 2px 16px rgba(0, 0, 0, 0.06)` | Feature card on hover (light); `0.20` (dark). |
| `shadow-app-hover` | `0 1px 8px rgba(0, 0, 0, 0.04)` | App-card hover. |
| `shadow-modal` | `0 12px 48px rgba(0, 0, 0, 0.20)` | Shot modal. |
| `shadow-popover` | `0 8px 32px rgba(0,5,10,0.08), 0 2px 8px rgba(0,5,10,0.04)` | Mobile menu (dual-layer). |
| `shadow-polaroid` | `0 0 8px rgba(0, 0, 0, 0.30)` | Polaroid, profile image. |

> Dark mode increases shadow alpha to `0.2–0.3`.

### 1.8 Motion

**Durations**
- `0.15s` — small color/background swaps (filter buttons, gallery toggles).
- `0.2s` — default UI transition (links, nav, hover color, CTA).
- `0.25s` — modal fade, mobile menu transform.
- `0.3s` — feature card box-shadow / transform.
- `0.4–0.7s` — image scale on hover (`scale(1.04)` zoom).

**Easings**
- `ease` — default for color/opacity.
- `cubic-bezier(0.22, 1, 0.36, 1)` — the system's signature easing. Used for any *transform* (scale, translate, modal pop, mobile menu spring). It is "easeOutQuint"-like — fast launch, soft landing.

**Hover micro-interactions** (be precise — these are signature)
- Feature card: `transform: translateY(-2px)` + box-shadow + child `.image` `transform: scale(1.03)`.
- Thinking item: `transform: translateX(8px)` + title turns accent.
- Gallery image: `transform: scale(1.04)` (0.4s signature ease).
- Shot/living-banner image: `transform: scale(1.04)` with longer duration (0.5–0.7s).
- Section link / app card: title color → accent.
- App card: icon background `rgb(244,246,247) → rgba(30,200,150,0.1)`, glyph color → accent.
- Mobile menu open: scale `0.92 → 1`, translateY `-8 → 0`, items stagger every `30ms`.

**Scroll behaviors (JS)**
- Nav and `.post-topbar` get class `.tucked` (top: -60px) on scroll-down, slide back on scroll-up. Transition `top 0.2s ease`.
- Apps carousel: `requestAnimationFrame` loop, `0.5px/frame`, infinite by cloning children. Pauses on `mouseenter`.
- Hero `.is-visible` class on load (room for bg-zoom intro).
- `IntersectionObserver` keeps autoplay videos paused off-screen.

**Reduced motion**
```sass
@media (prefers-reduced-motion: reduce)
  .mobile-menu, .mobile-menu a
    transition-duration: 0.01ms !important
    transition-delay: 0ms !important
```
Apply this pattern to any spring/stagger animation you add.

---

## 2. Components

### 2.1 Navigation

**Top nav** — fixed, full-bleed white-overlay strip with hairline bottom border.
```
┌──────────────────────────────────────────────────────────┐
│ [logo] bdharva                About Making Thinking [◐] │
└──────────────────────────────────────────────────────────┘
```
- Container: `position: fixed; top: 0; width: 100%; z-index: 100;`
- Background: `rgba(255, 255, 255, 0.96)` (no blur on top nav, blur reserved for `.post-topbar`).
- Inner padding: `16px 52px 14px`.
- Left logo: 28px image + name, gap `10px`, font `19px / 400 / -0.5px`, color `0.9` ink.
- Right links: `13px / 500 / -0.2px`, color `0.45` ink, active/hover `0.9`. Gap `24px`.
- Behavior: tucks via `.tucked { top: -60px }`.

**Dark toggle** — custom `36×18px` pill with `12×12` circular knob, `0.2s ease` slide.

**Mobile menu** — popover positioned `top: 56px; right: 52px; width: 200px`. Spring open with stagger (`30ms` per item). Each row: lucide icon + label, 13px/500 text, accent active state with `rgba(30,200,150,0.06)` bg.

### 2.2 Footer
3-column grid (`1fr auto 1fr`). Left: small logo + name (18px image, 13px/600). Center: copyright span (12px, 0.25 ink). Right: social text links (12px/500, 0.35 ink, hover 0.7). Hairline top border. Stacks centered ≤690px.

### 2.3 Home hero
```sass
.home-hero-layout
  display: flex
  flex-direction: column
  align-items: center
  text-align: center
  max-width: 680px
  margin: 0 auto
  padding: 5rem 2rem
```
- 120px circular headshot with `shadow-avatar`.
- Greeting `1.5rem / 600 / 1.3 / -0.3px`.
- Bio paragraph `1rem / 400 / 1.65`, `0.65` ink, centered.
- Trait row (`flex-wrap`, gap `0.5rem 1.25rem`): each trait = 14px lucide icon (`0.25` ink) + mono `0.75rem / 500` label (`0.45` ink).

### 2.4 Apps carousel
Full-bleed strip with hairline top/bottom borders, infinite horizontal scroll. Header label is `<i data-lucide> + section-label` text.
- Card: `display: flex; gap: 12px; padding: 8px 16px 8px 8px; border-radius: 14px; background: white; border: 1px solid rgba(0,5,10,0.06)`.
- Icon: 40×40, radius 8px, `bg-medium`. Hover → accent-tinted bg + accent glyph + accent title.
- External card variant: 10px lucide arrow badge `top: 6px; right: 6px`.
- JS clones children to fill `window.innerWidth * 3`, advances `0.5px/frame`, pauses on hover.

### 2.5 Section bar
A thin row above any list/grid:
```html
<div class="section-bar">
  <span class="section-label"><i data-lucide="hammer"></i> Selected Making</span>
  <a href="/making" class="section-link">View all <i data-lucide="arrow-right"></i></a>
</div>
```
- Label `16px / 500 / 0.85` ink with 16px lucide icon.
- Link `13px / 500 / 0.4` ink → `0.8` on hover. 13px arrow icon trailing.
- `margin-bottom: 28px`.

### 2.6 Feature card (the workhorse)
```
┌────────────────────┐
│   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓   │  ← image-holder, min/max-height 200px
│   ▓▓▓ image ▓▓▓▓   │
├────────────────────┤
│ ⌐ ATOMS / BITS     │  ← .label  (mono 11px/500/0.5px, 0.4 ink)
│ Title goes here    │  ← .title  (17px/600/-0.2px, 0.9 ink)
│ Description copy.  │  ← .description (14px/400/0.5 ink, 1.5 lh)
└────────────────────┘
```
- Card: white bg, `1px solid rgba(0,5,10,0.06)`, radius `6px`, `overflow: hidden`.
- Text region padding: `24px 28px 28px`.
- Hover: `translateY(-2px)`, `shadow-card-hover`, child `.image` `scale(1.03)`. Transition: `box-shadow 0.3s ease, transform 0.3s ease`. Image transition: `transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)`.
- WIP variant: muted `rgba(0,0,0,0.02)` bg, no hover lift.

### 2.7 Thinking row
```html
<a class="thinking-item">
  <span class="thinking-date">Apr 2026</span>
  <span class="thinking-title">Title here</span>
  <span class="thinking-desc">Optional description</span>  <!-- 1.2fr column, hidden on mobile -->
  <span class="thinking-tag"><i data-lucide="lightbulb"></i>Spitballing</span>
</a>
```
- Grid: `60px 1fr 1.2fr auto` / gap `16px`.
- Top + bottom hairline borders (`first-child` gets a top border too).
- Date: mono 11px/500, `0.3` ink, uppercase.
- Title: 15px/500/-0.2px, `0.85` ink.
- Tag: mono 10px/500, 12px lucide icon.
- Hover: `translateX(8px)` + title → accent.

### 2.8 Split section
Used to render two columns of unequal weight (e.g. Selected Making 2/3 + Recent Thinking 1/3).
- `flex` row, `flex: 2` left, `flex: 1` right.
- Right column has `border-left: 1px solid rgba(0,5,10,0.08)` and `padding-left: 48px`. Left column has `padding-right: 48px`.
- Left features grid is forced to `1fr 1fr` inside the split (overrides `auto-fill`).
- ≤960px: stacks; right column gets `border-top` instead of `border-left`, `padding-top: 32px`.

### 2.9 CTA pill (accent)
```html
<a href="…" class="home-cta">
  <div class="home-cta-text">
    <span class="home-cta-main">Play My New Game</span>
    <span class="home-cta-sub">It's like if Risk, Catan, and Jackbox had a baby</span>
  </div>
  <i data-lucide="play" class="home-cta-ext"></i>
</a>
```
- Container: `padding: 14px 24px 14px 16px; gap: 16px; border-radius: 12px; background: --accent-bg-soft; border: 1px solid --accent-border;`
- Hover: bg → `--accent-bg-medium`, border alpha `0.20 → 0.35`, `translateY(-1px)`.
- Optional `.home-cta-icon`: `44×44`, radius 10px, solid accent bg, white 22px lucide glyph.
- Trailing `.home-cta-ext`: 14px lucide in 30px circular accent-tinted badge (`box-sizing: content-box`).

### 2.10 Stats block
Used in highpoints and living columns. Pattern:
```
| 12   | 23   | 8       |
| ↑    | △    | ⛰        |
| MTNS | DAYS | STATES  |
```
- Hp variant: vertical-divider columns (`border-left`), `padding: 16px 24px`. Number `22px / 600 / -0.5px / 0.8 ink`, mono label `9px / 500 / 0.5px uppercase / 0.3 ink`.
- Living variant: equal flex columns separated by `border-right`, `padding: 14px 8px`, number `18px / 600`. Same mono label.
- 16px lucide icon above number, `0.2` ink, stroke `1.5`.

### 2.11 Living column card
3-up card with: image hero (180px) → stats row → vertical list of items → "more" link.
- Container: `border: 1px solid 0.08; border-radius: 12px; overflow: hidden; flex column`.
- Hero text overlay: `linear-gradient(180deg, transparent, rgba(0,0,0,0.55))`, white 18px/600 title, white-60 12px sub.
- Item row: 40px thumb, 13px/500 title, 11px sub, hover bg `rgba(0,5,10,0.03)`.
- "more" footer: hairline top border, 13px/500, accent on hover.

### 2.12 Living banner (4-up image strip)
Edge-to-edge `repeat(4, 1fr)` image grid. Each cell:
- 180px image with `cubic-bezier(0.22, 1, 0.36, 1)` 0.7s `scale(1.04)` on hover.
- Bottom-aligned label band: `linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.5))`, mono 11px label + 13px lucide icon, `opacity: 0.75 → 1` on hover.

### 2.13 Gallery (photography / highpoints detail)
- **Header**: 120px square thumb (radius 10px) + title (22px/600/-0.5px) + meta row (mono 11px) + count (12px).
- **Toggle**: rounded `6px` 1px-bordered button group. Active = `0.85` ink bg, white glyph.
- **Grid**: `repeat(auto-fill, minmax(200px, 1fr))`, gap `8px`, `aspect-ratio: 4/3`, radius `4px`. Hover scale `1.04`.
- **Slideshow**: `min-height: 60vh`, `background: #0a0a0a`, radius `8px`. Prev/next: `44×44` semi-transparent white squares. Counter: mono 11px white-40 bottom-center. Fullscreen button top-right (`36×36`).

### 2.14 Shot grid + modal
- Grid: `repeat(auto-fill, minmax(260px, 1fr))`, gap `12px`, `aspect-ratio: 4/3`, radius `6px`.
- Hover overlay: `linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.6))`, opacity 0→1, white 13px/500 title bottom-left.
- **Modal**: `max-width: 720px`, white card with `shadow-modal`, fade-in `0.2s`. Image area `padding-bottom: 56%` (16:9). Body padded `24px 28px 28px`, h2 18px/600. Tag row uses `.shot-tag` (mono 10px, 1px border, radius 4px, 3px 8px padding). External link is mono-style 13px/500 with lucide icon.

### 2.15 Filter button row
Generic chip filters (used on Shots).
- `display: inline-flex`, font `12px / 500`, mono icon at 12px.
- Padding `6px 14px`, `1px solid 0.08` border, radius `6px`.
- Active = `0.85` ink bg, white text.

### 2.16 Tag chip (mono)
```sass
.shot-tag, .shot-modal-tags .shot-tag
  display: inline-flex
  gap: 4px
  font-family: 'JetBrains Mono'
  font-size: 10px
  font-weight: 500
  color: rgba(0, 5, 10, 0.4)
  border: 1px solid rgba(0, 5, 10, 0.08)
  border-radius: 4px
  padding: 3px 8px
  letter-spacing: 0.3px
```
A canonical "engineered" micro-label.

### 2.17 Post page
- Width: `max-width: calc(680px + 4rem); padding: 0 2rem`. Self-contained — no global `.scroll-content` width.
- **Topbar**: full-width within page, fixed, `backdrop-filter: blur(12px)`, brand on left + dark-toggle + menu on right. Tucks identically to nav.
- **Header**: `padding: 72px 0 36px`. Meta row (mono date + tag with 11px icon) above 28px/600 title (line-height 1.25, `-0.5px` tracking). Optional 16px tagline (0.5 ink) below.
- **Body**: `padding: 40px 0 64px`. p `0 0 1.25rem / 0.7 ink`, h2 `20px/600/-0.3px / 2.5rem 0 0.75rem`, h3 `16px/600/-0.2px`, h4 `14px/600`. Code mono `0.8125rem` with `rgba(0,5,10,0.04)` bg + 6px radius. Pre with hairline border + 6px radius + 1.25rem padding. Blockquote with 2px left border `rgba(0,5,10,0.1)` + 1.25rem left padding. Tables: mono uppercase thead, hover row tint.
- **Post-nav**: 3-col grid (`1fr auto 1fr`). Prev / "All posts" / Next. Labels are 12px/500, titles 15px/500. Stacks ≤690px with "All" reordered first.
- **Post-footer**: identical 3-col grid pattern as global footer.

### 2.18 About page
- **Hero**: bordered bottom, centered. 120px circular headshot, 24px/600 H1, 15px/1.7 lead paragraph (0.6 ink).
- **Body**: bordered sections separated by hairline `0.08` borders (no border on last). Each section padded `48px 0`.
- **Section label**: 13px/500, 0.5 ink, gap with 14px lucide icon. `margin-bottom: 20px`.
- **Section content**: 15px/1.75 paragraphs in 0.75 ink.
- **Credits block**: vertical list of category groups. Each group: h4 (13px/600/-0.2px, 0.85 ink, with 13px lucide icon at 0.35 ink) + ul of 13px/1.6 items in 0.5 ink, accent links.

### 2.19 Highpoints page
- **Header**: flex row, gap 40px, padded `40px 52px`, hairline bottom border. Left: intro paragraph (15px/1.7/0.6 ink). Right: stats block with vertical dividers.
- **Grid**: reuses feature grid via `.hp-grid .content.max { padding: 32px 52px 64px }`.

### 2.20 Connect (socials) page
- Container: `padding: 64px; max-width: 1200px`.
- **Logo lockup**: 32px image + 20px/600 name, hairline bottom border.
- **Cluster row**: flex-wrap, each cluster `flex: 1 1 0; min-width: 300px`, margin 24px.
- **Profile lockup**: 120×120 rounded square (`12px` radius) with shadow + name/handle/blurb/location stack.
- **Button row**: Stacked CTAs at `min-height: 64px`, `padding: 0 24px`, radius 12px, `1px solid 0.05` border. Icon block on left with vertical separator. Hover → accent text + accent-tinted background.

---

## 3. Iconography

- **Library**: Lucide (`https://unpkg.com/lucide@1.7.0`). FontAwesome kit also loaded for brand glyphs (`fa-brands`).
- **Default sizing**: `[data-lucide] { width: 18px; height: 18px; stroke-width: 1.5 }`. Component overrides commonly use `11–22px`.
- **Stroke-width**: `1.5` everywhere (not 2). Exceptions: `.tictactag` and `.feature .label` inline icons use `2`.
- **Color**: usually inherits from text alpha; explicit `0.2–0.35` ink for "decorative" glyphs (trait icons, hp-stat icons).
- **Margin**: global `margin: 0 4px 2px -2px` to optically baseline-align with sans text. Reset to `0` inside flex layouts.
- **Naming convention**: home, user, hammer, book-open, mountain-snow, lightbulb, wrench, route, camera, trees, trophy, flame, map, globe, layout-grid, arrow-right, external-link, play, x, menu, compass, cpu, pen-tool, pencil-ruler, box, binary, circle.

---

## 4. Tone, voice, and content rules

These aren't CSS but they are part of the design system and are visible on every page.

- **Section names**: single warm verbs/nouns — "Building / Thinking / Living / Making". Never "Projects", "Blog", "Portfolio".
- **Section labels** are paired with a lucide icon: `Selected Making`, `Recent Thinking`, `Interactives`.
- **Mono labels** are uppercase, terse, and act as filing-cabinet tabs ("MTNS", "DAYS", "STATES", "Apr 2026", "Spitballing").
- **Tags** for thinking posts: `Spitballing` (lightbulb), `Tinkering` (wrench), `Wandering` (route).
- **Tags** for making shots: `Atoms` (box), `Bits` (binary), `Pixels` (pencil-ruler).
- **Trait phrases** use parallel construction: "Hands of a craftsman / Eyes of an architect / Mind of an engineer / Heart of an artist".
- Copy is sentence-case. CTAs are imperative ("Play My New Game", "View all").

---

## 5. Reusable token export (CSS custom properties)

Drop this in any new project to recreate the system without Sass:

```css
:root {
  /* Brand */
  --accent: rgb(30, 200, 150);
  --accent-hover: rgb(50, 220, 170);
  --accent-deep: rgb(20, 170, 125);
  --accent-bg-soft: rgba(30, 200, 150, 0.06);
  --accent-bg-medium: rgba(30, 200, 150, 0.10);
  --accent-border: rgba(30, 200, 150, 0.20);

  /* Surfaces — light */
  --bg: #ffffff;
  --bg-medium: rgb(244, 246, 247);
  --bg-card: #ffffff;
  --bg-overlay: rgba(255, 255, 255, 0.96);

  /* Ink — light (use as rgba(var(--ink) / α) via color-mix or hardcode) */
  --ink: 0 5 10;

  /* Border alphas */
  --border-strong: rgba(0, 5, 10, 0.10);
  --border: rgba(0, 5, 10, 0.08);
  --border-soft: rgba(0, 5, 10, 0.06);
  --border-faint: rgba(0, 5, 10, 0.04);

  /* Type */
  --font-sans: 'DM Sans', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
  --weight-body: 400;
  --weight-medium: 500;
  --weight-heading: 600;

  --fs-display: 2.625rem;
  --fs-h2: 1.5rem;
  --fs-h3: 1.25rem;
  --fs-h4: 1.125rem;
  --fs-body: 1rem;
  --fs-small: 0.875rem;
  --fs-mono: 0.6875rem; /* 11px */
  --fs-mono-xs: 0.5625rem; /* 9px */
  --tracking-tight: -0.5px;
  --tracking-snug: -0.3px;
  --tracking-ui: -0.2px;
  --tracking-mono: 0.3px;
  --tracking-mono-wide: 0.5px;

  /* Spacing — page edge gutter */
  --gutter: 52px;
  --gutter-tablet: 2rem;
  --gutter-mobile: 1.5rem;

  /* Radius */
  --radius-xs: 3px;
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 10px;
  --radius-2xl: 12px;
  --radius-3xl: 14px;

  /* Shadows */
  --shadow-avatar: 0 2px 12px rgba(0, 0, 0, 0.08);
  --shadow-card-hover: 0 2px 16px rgba(0, 0, 0, 0.06);
  --shadow-app-hover: 0 1px 8px rgba(0, 0, 0, 0.04);
  --shadow-modal: 0 12px 48px rgba(0, 0, 0, 0.20);
  --shadow-popover: 0 8px 32px rgba(0, 5, 10, 0.08), 0 2px 8px rgba(0, 5, 10, 0.04);
  --shadow-polaroid: 0 0 8px rgba(0, 0, 0, 0.30);

  /* Motion */
  --ease-spring: cubic-bezier(0.22, 1, 0.36, 1);
  --t-fast: 0.15s ease;
  --t-base: 0.2s ease;
  --t-card: 0.3s ease;
  --t-image: 0.6s var(--ease-spring);

  /* Layout */
  --max-post: 680px;
  --max-content: 800px;
  --max-page: 960px;
  --max-wide: 1200px;
  --nav-height: 52px;
}

html.dark {
  --bg: #141413;
  --bg-medium: #1a1a18;
  --bg-card: #1e1e1c;
  --bg-overlay: rgba(20, 20, 19, 0.96);
  --ink: 255 255 255;
  --border-strong: rgba(255, 255, 255, 0.10);
  --border: rgba(255, 255, 255, 0.08);
  --border-soft: rgba(255, 255, 255, 0.06);
  --border-faint: rgba(255, 255, 255, 0.04);
  --shadow-card-hover: 0 2px 16px rgba(0, 0, 0, 0.20);
  --shadow-modal: 0 12px 48px rgba(0, 0, 0, 0.40);
}
```

**Ink helper** (so you can write `color: var(--ink-65)`):
```css
:root {
  --ink-90: rgb(0 5 10 / 0.90);
  --ink-85: rgb(0 5 10 / 0.85);
  --ink-75: rgb(0 5 10 / 0.75);
  --ink-65: rgb(0 5 10 / 0.65);
  --ink-50: rgb(0 5 10 / 0.50);
  --ink-40: rgb(0 5 10 / 0.40);
  --ink-30: rgb(0 5 10 / 0.30);
  --ink-20: rgb(0 5 10 / 0.20);
}
html.dark {
  --ink-90: rgb(255 255 255 / 0.90);
  --ink-85: rgb(255 255 255 / 0.85);
  --ink-75: rgb(255 255 255 / 0.75);
  --ink-65: rgb(255 255 255 / 0.60);
  --ink-50: rgb(255 255 255 / 0.45);
  --ink-40: rgb(255 255 255 / 0.40);
  --ink-30: rgb(255 255 255 / 0.30);
  --ink-20: rgb(255 255 255 / 0.20);
}
```
> Note dark mode collapses the alpha ladder slightly — the eye needs less contrast on dark warm-black.

---

## 6. Pattern recipes

### 6.1 Editorial card
```html
<article class="feature">
  <div class="image-holder">
    <div class="image" style="background-image:url(…)"></div>
  </div>
  <div class="text">
    <div class="label"><i data-lucide="box"></i>Atoms / Bits</div>
    <div class="title">Workshop dust collector</div>
    <div class="description">Cyclone separator for the wood shop.</div>
  </div>
</article>
```

### 6.2 List row
```html
<a class="thinking-item">
  <span class="thinking-date">Apr 2026</span>
  <span class="thinking-title">A note on noticing</span>
  <span class="thinking-desc">On the small data of attention.</span>
  <span class="thinking-tag"><i data-lucide="lightbulb"></i>Spitballing</span>
</a>
```

### 6.3 Stat block
```html
<div class="hp-stats">
  <div class="hp-stat">
    <i data-lucide="mountain-snow" class="hp-stat-icon"></i>
    <div class="hp-stat-num">23</div>
    <div class="hp-stat-label">Summited</div>
  </div>
  …
</div>
```

### 6.4 CTA pill
```html
<a href="…" class="home-cta">
  <div class="home-cta-text">
    <span class="home-cta-main">Read the essay</span>
    <span class="home-cta-sub">Five minutes, one idea</span>
  </div>
  <i data-lucide="arrow-right" class="home-cta-ext"></i>
</a>
```

### 6.5 Page header (post style)
```html
<header class="post-header">
  <div class="post-meta">
    <span class="post-date">APR 2026</span>
    <span class="post-tag"><i data-lucide="lightbulb"></i>Spitballing</span>
  </div>
  <h1>Title in sentence case, tight tracking</h1>
  <p class="post-tagline">Optional dek explaining the idea in one line.</p>
</header>
<hr class="post-divider"/>
```

---

## 7. Anti-patterns (don't break the system)

- ❌ No additional accent colors. The mint is the only saturated hue. Status colors live in tables only (`installed/no-install/removed` etc.).
- ❌ No drop shadows on body text or icons.
- ❌ No gradients except subtle photo-overlay darkening (`linear-gradient(180deg, transparent, rgba(0,0,0,0.5))`).
- ❌ No pure black `#000` or white `#fff` for text — use the alpha ladder.
- ❌ No rounded-pill buttons except the nav `.cta` and dark-toggle. Cards are `6–14px` radius, not pills.
- ❌ No mono font for body copy, headings, or descriptions. Mono is reserved for labels, dates, tags, code.
- ❌ No center-aligned body paragraphs except in hero/about contexts.
- ❌ No emoji as iconography. Lucide only (FA only for brand glyphs).
- ❌ No `letter-spacing: 0` on display headings — always tighten by `-0.2 to -0.5px`.
- ❌ No animation easings other than `ease` (color/opacity) and `cubic-bezier(0.22, 1, 0.36, 1)` (transforms).

---

## 8. Quick visual signature checklist

If you can answer "yes" to all of these, you're rendering in the bdharva visual language:

- [ ] DM Sans 400/500/600, JetBrains Mono 500 only.
- [ ] Mint accent `rgb(30, 200, 150)` is the *only* saturated color.
- [ ] All text uses `rgba(0, 5, 10, α)` (light) or `rgba(255, 255, 255, α)` (dark), never pure.
- [ ] 52px page-edge gutter on desktop.
- [ ] 6–14px corner radius (no pills, no sharp corners).
- [ ] Mono micro-labels (9–11px, +0.3–0.5px tracking, often UPPERCASE) flank rich content.
- [ ] Lucide icons at stroke-width 1.5.
- [ ] Hover transforms use `cubic-bezier(0.22, 1, 0.36, 1)` and are subtle (`scale(1.03–1.04)`, `translateY(-2px)`, `translateX(8px)`).
- [ ] Dividers are 1px hairlines at 6–10% ink alpha.
- [ ] Dark mode reads `#141413` page / `#1e1e1c` cards / `#1a1a18` muted, not pure black.
