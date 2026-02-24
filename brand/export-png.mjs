#!/usr/bin/env node
/**
 * brand/export-png.mjs
 * Converts DEBO SVG brand assets to PNG using sharp.
 * Run: node brand/export-png.mjs
 * Requires: npm install -g sharp-cli  OR  pnpm add -D sharp
 */

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));

let sharp;
try {
  const m = await import("sharp");
  sharp = m.default;
} catch {
  console.error(
    "\n  ❌  sharp not found. Install it:\n" +
    "     pnpm add -D sharp\n" +
    "  Then re-run: node brand/export-png.mjs\n"
  );
  process.exit(1);
}

const exports = [
  // [input svg,              output png,               width, height]
  // --- App icons (Slack requires 512–2000px square) ---
  ["icon-512.svg",         "icon-512.png",              512,   512],   // Slack minimum
  ["icon-512.svg",         "icon-1024.png",            1024,  1024],  // Slack recommended / Discord
  ["icon-512.svg",         "icon-2000.png",            2000,  2000],  // Slack maximum / App Store
  // --- Web icons ---
  ["apple-touch-icon.svg", "apple-touch-icon.png",     180,   180],
  ["favicon-32.svg",       "favicon-32.png",            32,    32],
  ["favicon-32.svg",       "favicon-16.png",            16,    16],
  // --- Wordmark ---
  ["logo.svg",             "logo-dark-2x.png",          840,   200],
  ["logo-light.svg",       "logo-light-2x.png",         840,   200],
];

for (const [src, dest, w, h] of exports) {
  const inPath  = join(__dir, src);
  const outPath = join(__dir, dest);
  const svg = readFileSync(inPath);

  await sharp(svg)
    .resize(w, h, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outPath);

  console.log(`  ✅  ${dest}  (${w}×${h})`);
}

console.log("\n  🎨  All brand assets exported to brand/\n");
