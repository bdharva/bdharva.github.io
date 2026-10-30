# Apps on bdharva.com

How interactives and hubs are built, styled, packaged and hosted on this site. Read this alongside `DESIGN_SYSTEM.md` (the visual language) before starting or porting an app.

## 1. Shapes

| Shape | URL | Example | Site entry |
|---|---|---|---|
| **Interactive**: one self-contained app | `/slug/` | Bracket Buddy, NYC CFB Bar Crawler | one carousel card |
| **Hub**: a gallery of related pieces | `/slug/`, pieces at `/slug/piece/` | Personal Geographies (yarnball) | one carousel card for the hub; the hub lists its pieces |

- URLs are clean folders (`/slug/piece/`), never `piece.html`.
- Everything is hosted on this site. No embeds on other pages.

## 2. Where the code lives

**Each app is developed in its own private repo. This repo holds only the release.**

- The dev repo is the source of truth: app code, tests, importers, raw and private data, and tuning or debug tools that never ship.
- The site folder (`/slug/`) is output. It's written by the publish workflow (section 7) and never edited by hand here. A fix made here would be overwritten on the next publish.
- This keeps the site repo (2.2 GB of history) out of day-to-day app work and gives each app its own history, tests and data pipeline.

## 3. The manifest: `site.json` in the dev repo

What ships is an explicit list. A new file in the dev repo stays private until it's added here.

```json
{
  "slug": "cfb-bar-crawler",
  "shape": "interactive",
  "title": "NYC CFB Bar Crawler",
  "seo_title": "NYC CFB Bar Crawler: College Football Alumni Bars in New York",
  "title_split": ["CFB", "Bar Crawler"],
  "description": "Plan college football Saturdays around NYC alumni game-watch bars",
  "card": { "icon": "beer", "title": "CFB Bar Crawler", "desc": "NYC alumni game-watch bar planner" },
  "making": { "description": "One or two lines for the Making page", "url_text": "Try CFB Bar Crawler", "date": "2026-10" },
  "preview": "docs/screens/preview.webp",
  "share_image": "docs/screens/share.jpg",
  "share_alt": "What the share image shows, for screen readers",
  "ship": ["index.html", "*.js", "app.css", "data/*.json"],
  "data_updated_from": "data/schedule.json#updated",
  "runtime_services": ["tiles.openfreemap.org", "routing.openstreetmap.de", "a.espncdn.com"]
}
```

- `ship` is an allowlist of globs, relative to the dev repo. Nothing else is copied.
- `title_split` drives the header title: first part plain, second part in the accent color.
- `card` is the homepage carousel entry (Lucide icon name, title, one-line description).
- `making` is the entry in `_data/shots.yml` (the Making page), with `preview` as its image and the tag `Bits`.
- `seo_title` is the `<title>` for search results (about 60 characters, the keywords people search for). `title` stays the short name used in link previews.
- `description` is the meta and link-preview description: 150-160 characters, written for someone searching.
- `preview` is a 1200×630 screenshot, published to `/assets/making/<slug>.webp` for the Making page.
- `share_image` is a designed 1200×630 JPEG for link previews (iMessage, Slack, X, LinkedIn): name, one line, one picture, legible at thumbnail size. Published to `/assets/share/<slug>.jpg` and used for `og:image` and `twitter:image`. JPEG or PNG, not WebP: some previewers skip WebP. Keep its source (HTML and a render script) in the dev repo. `share_alt` is its alt text.
- `runtime_services` lists every outside host the public page calls, so it's clear what can break.
- A hub adds `"pieces": [{ "slug": "yarnball", "ship": [...] }, …]`; each piece publishes to `/slug/piece/`.

## 4. Dev versus production

The dev repo usually does more than the public page: tuning sliders, raw-data views, importers, debug overlays.

- **Dev tools ship by omission.** Put them in their own files (`dev.html`, `tune.js`, `debug.css`) and leave them out of `ship`. Don't hide them behind a `?dev` flag: the code would still ship and anyone can read it.
- **Public data is built, not copied.** Raw inputs go through a build script that writes cleaned public files (for example `data/*.json`). Only those are listed in `ship`.
- **Private data never ships.** Location history, home coordinates, contacts, people's names and email addresses stay in the dev repo (`private-data/`, gitignored). A hub built on private data (yarnball) publishes aggregates, renders or synthetic stand-ins, never the raw records.
- **No runtime calls to private services.** The public page reads only its shipped files and the `runtime_services` it declares.

## 5. Page contract

Every published page has:

**Head** (written by the publish workflow from `site.json`; the dev copy can be simpler)

```html
---
layout: null
---
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{seo_title} - bdharva</title>
<meta name="description" content="{description}">
<link rel="icon" type="image/png" href="/assets/favicon.png">
<link rel="canonical" href="https://bdharva.com/{slug}/">
<meta property="og:title" content="{title}">            <!-- + og:description, og:url, og:type=website, og:site_name, og:locale -->
<meta property="og:image" content="https://bdharva.com/assets/share/{slug}.jpg"> <!-- + og:image:width/height/alt -->
<meta name="twitter:card" content="summary_large_image"> <!-- + twitter:title/description/image/image:alt, twitter:creator=@bdharva -->
<link rel="apple-touch-icon" href="/assets/favicon.png">
<script type="application/ld+json">{WebApplication: name, url, description, image, author}</script>
<script>(function(){try{var d=localStorage.getItem('darkMode');if(d==='true'||(d===null&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}})();</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/apps.css">
<link rel="stylesheet" href="app.css">
```

- The inline theme script is the same one the site uses (`darkMode` in localStorage, `html.dark`), so the reader's theme carries across the site and every app.
- `/js/apps.js` at the end of the body wires up the theme switch, info modal and toasts.

**Header:** `.app-header` with the favicon logo linking to `/`, the two-part title, "by bdharva", and actions on the right (the theme switch, and the info button on any page that needs explaining; a hub whose own page already says what it is can skip it). See `/apps-kit/`.

**Info modal instead of a footer:** a `<dialog class="app-modal">` that says what the app is, how to use it, where the data comes from, and "Data updated {date}", with a link back to bdharva.com. Full-screen tools have no room for a footer, and hubs skip it too: the header's logo already links home.

**Paths:** everything relative to the app's folder, except the shared `/css/apps.css`, `/js/apps.js` and `/assets/favicon.png`. Crawl or view state goes in the URL hash, so shared links survive the move to `/slug/`.

**Jekyll rules:**
- Jekyll skips files and folders whose names start with `_` or `.`, so don't ship any.
- A file with front matter is run through Liquid. Only `index.html` gets front matter (`layout: null`), so Liquid's double-brace syntax inside JS and JSON is left alone.
- Keep each app's folder under about 5 MB. Large media goes in `/assets/<slug>/`.

## 6. Styles

Styles form a three-level stack. Each level builds only on the ones below it.

| Level | File | Contents |
|---|---|---|
| 1. Tokens | `_sass/_tokens.sass` | the CSS custom properties of `DESIGN_SYSTEM.md` §5 (colors, ink ladder, type, radii, shadows, motion, gutter), plus text roles, with light values on `:root` and dark on `html.dark`. Loaded by both the site and apps. |
| 2. App layer | `_sass/_apps-layer.sass` → `/css/apps.css` | Shared app elements: app base, header, buttons, segmented, switch, fields, search, tags and badges, info modal, popover, toast, app shell and panels, hub gallery. |
| 3. App | `app.css` in the dev repo | Only what is truly specific to one app. |

The site itself is `/css/styles.css` = tokens + reset + site dark overrides + base + site components. Apps never load it: its page-level rules (`body` flex, heading sizes, justified paragraphs) would fight app layouts.

**Rules for app CSS**
- Use tokens, never raw colors. The text roles (`--text`, `--text-body`, `--text-muted`, `--text-caption`, `--text-faint`) cover most needs, and `rgb(var(--ink) / α)` covers any other step of the ink ladder. Built this way, dark mode needs no extra rules.
- Start `app.css` with a comment listing which app-layer elements it uses and what it adds.
- Look in `/apps-kit/` and `_apps-layer.sass` before writing a new element.

**Promotion**
- An element that appears in a **second** app moves from that app's CSS into `_apps-layer.sass`.
- An app-layer element that matches a site element moves into `_tokens.sass`, or into a shared base.
- Record each move in `DESIGN_SYSTEM.md` §9 ("Apps layer"), so the next app starts from the current set.
- Changes to the app layer go through a reviewed PR: they reach every app at once.

**Previewing:** `bundle exec jekyll serve`, then open `/apps-kit/` to check every shared element in both themes.

## 7. Publishing

One shared workflow (the `publish-to-site` skill), run from the dev repo:

1. **Gates:** the dev repo's tests and validators, plus a privacy scan of everything `ship` selects. The scan fails on `private-data`, email addresses, or coordinate-like data outside the declared public data files.
2. **Sync:** update a permanent sparse checkout of this repo (`~/sites/bdharva.github.io`, holding only the app's folder and the files it touches). Copy the `ship` files into `/slug/`, deleting stale ones. Write the head from `site.json`.
3. **Commit:**
   - **Data-only changes** (only files under `data/` changed) commit and push straight to `master`. Scheduled refreshes go live without review.
   - **Code, style or markup changes** go on a branch with a PR. Preview it with `jekyll serve` before merging.
4. **First publish only**, in the same PR: the carousel card in `index.html`, the Making entry in `_data/shots.yml`, the `sitemap.xml` entry, and the preview image in `/assets/making/`.

## 8. Scheduled refreshes

Apps with changing data (schedules, rankings, prices) refresh in the dev repo, never here:

- launchd on claudetop runs the job: a plain script, or headless Claude for research that needs judgment.
- The job runs the gates, commits to the dev repo, then publishes (data-only, so it pushes directly).
- A failed gate commits to a branch in the dev repo and publishes nothing.

## 9. New app checklist

- [ ] Private dev repo with `site.json`, tests, and private data gitignored
- [ ] Header, info modal (with "Data updated") and theme switch, per §5
- [ ] `app.css` on tokens and the app layer; shared candidates noted for promotion
- [ ] Works at `/slug/` (relative paths, hash state), on a phone, and in both themes
- [ ] Preview image, share image, SEO title and description, carousel card, Making entry and sitemap entry
- [ ] First publish through a PR, previewed with `jekyll serve`
