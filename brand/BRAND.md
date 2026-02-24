# DEBO™ Brand Identity Guide

> **DEBO™** is a registered trademark of **Tolani Corp**.
> All assets in this directory are proprietary and protected by copyright.

---

## The Name

```
DE▋BO
```

The blinking cursor `▋` between **DE** and **BO** is the defining mark of the DEBO identity.  
It signals that DEBO is always active, always thinking — never idle.

**Pronunciation:** `DEE-boh`  
**Full name:** DEBO — Autonomous AI Software Engineer  
**Short tagline:** *Building Beyond*  
**Legal name:** DEBO™ by Tolani Corp

---

## Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--debo-black` | `#0a0e14` | Primary background |
| `--debo-surface` | `#0d1117` | Card / icon background |
| `--debo-border` | `#21262d` | Borders, dividers |
| `--debo-white` | `#e6edf3` | Primary text |
| `--debo-muted` | `#7d8590` | Secondary text, taglines |
| `--debo-green` | `#00d97e` | **Signature cursor green** — use sparingly |
| `--debo-green-dim` | `#16a34a` | Cursor on light backgrounds |
| `--debo-blue` | `#388bfd` | Links, interactive elements |

**Cursor green `#00d97e` is the brand's single accent color. Never use more than one accent color simultaneously.**

---

## Typography

**Primary:** `JetBrains Mono` (Google Fonts)  
**Fallback:** `Courier New`, `monospace`

| Role | Weight | Size | Color |
|---|---|---|---|
| Wordmark | 700 Bold | 72px | `#e6edf3` |
| Tagline | 400–600 | 11–14px | `#7d8590` |
| UI headings | 700 | 16–32px | `#e6edf3` |
| Body / code | 400 | 14px | `#e6edf3` |
| Muted / meta | 400 | 12px | `#7d8590` |

---

## Logo Files

| File | Size | Usage |
|---|---|---|
| `logo.svg` | 420×100 | README headers, website hero, dark backgrounds |
| `logo-light.svg` | 420×100 | Print, light-mode integrations |
| `icon-512.svg` | 512×512 | **Slack app icon**, Discord server icon, npm |
| `apple-touch-icon.svg` | 180×180 | iOS home screen, web app manifest |
| `favicon-32.svg` | 32×32 | Browser tab favicon |

---

## Slack App Setup

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Select your DEBO app → **Basic Information** → **Display Information**
3. **App name:** `DEBO`
4. **Short description:** `Autonomous AI Software Engineer`
5. **App icon:** Upload `icon-512.svg` (convert to PNG 512×512 if required)
6. **Background color:** `#0a0e14`

> Slack requires a **PNG** at least 512×512. Export `icon-512.svg` to PNG using:
> ```bash
> # Using Inkscape (free)
> inkscape icon-512.svg --export-png icon-512.png --export-width 512
>
> # Using ImageMagick
> convert -background none icon-512.svg -resize 512x512 icon-512.png
>
> # Using Node.js + sharp
> npx sharp-cli --input icon-512.svg --output icon-512.png --width 512
> ```

---

## Discord Server / Bot Setup

1. [discord.com/developers/applications](https://discord.com/developers/applications) → Your app → **General Information**
2. Upload `icon-512.svg` (as PNG) as the **App Icon**
3. Bot username: `DEBO`
4. Bot avatar: same icon

---

## Favicon (HTML)

```html
<!-- Paste into <head> -->
<link rel="icon" type="image/svg+xml" href="/brand/favicon-32.svg">
<link rel="apple-touch-icon" href="/brand/apple-touch-icon.svg">
<meta name="theme-color" content="#0a0e14">
```

---

## Web App Manifest (PWA)

```json
{
  "name": "DEBO — Autonomous AI Software Engineer",
  "short_name": "DEBO",
  "description": "Building Beyond — AI-powered software engineering for your team.",
  "theme_color": "#0a0e14",
  "background_color": "#0a0e14",
  "display": "standalone",
  "icons": [
    { "src": "/brand/favicon-32.svg",       "sizes": "32x32",   "type": "image/svg+xml" },
    { "src": "/brand/apple-touch-icon.svg", "sizes": "180x180", "type": "image/svg+xml" },
    { "src": "/brand/icon-512.svg",         "sizes": "512x512", "type": "image/svg+xml", "purpose": "maskable" }
  ]
}
```

---

## Usage Rules

✅ **Do**
- Use the wordmark on dark (`#0a0e14`) or medium-dark backgrounds
- Use `logo-light.svg` on white / light gray backgrounds
- Keep the cursor green `#00d97e` as the only accent
- Maintain clear space of at least `½ × icon height` around the logo

❌ **Don't**
- Recolor the cursor (green only — it's the trademark element)
- Stretch, skew, or rotate any asset
- Place the logo on busy photographic backgrounds
- Remove the blinking cursor from the wordmark
- Use the logo at sizes below 120px wide (use the icon instead)

---

## Trademark Notice

DEBO™ and the blinking cursor mark are trademarks of **Tolani Corp**.  
© 2024–2026 Tolani Corp. All rights reserved.

For licensing inquiries: legal@tolani.dev
