#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();

const scannedRoots = [
  "README.md",
  "package.json",
  "scripts/devbot-governance.mjs",
  "scripts/natt-offline-mirror.mjs",
  "scripts/natt-offline-vendor.mjs",
  "docs/autonomous-delivery",
  "docs/evals",
  "docs/release-governance.md",
  "docs/natt-offline-vendoring.md",
  "docs/enhancements",
  "docs/adr",
  "docs/design-reviews",
  "docs/offline-mirrors",
  "web/src",
  "web/package.json",
];

const forbidden = [
  /\bTBD\b/i,
  /placeholder/i,
  /coming soon/i,
  /not implemented/i,
  /isn't just/i,
  /future of autonomous/i,
  /should be positioned/i,
  /should sell/i,
  /would load/i,
  /mock active/i,
  /mock logic/i,
  /simple implementation for now/i,
  /avatar placeholder/i,
];

const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".yml",
  ".yaml",
]);

function extension(path) {
  const match = path.match(/\.[^.]+$/);
  return match ? match[0].toLowerCase() : "";
}

function collect(path) {
  const abs = join(root, path);
  if (!existsSync(abs)) return [];

  const stats = statSync(abs);
  if (stats.isFile()) {
    return textExtensions.has(extension(abs)) ? [abs] : [];
  }

  return readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name === ".next") return [];
    return collect(join(path, entry.name));
  });
}

const failures = [];
const ignoredFiles = new Set([
  "docs/adr/0000-template.md",
  "docs/enhancements/TEMPLATE.md",
  "docs/design-reviews/TEMPLATE.md",
]);

for (const file of scannedRoots.flatMap(collect)) {
  const rel = relative(root, file).replaceAll("\\", "/");
  if (ignoredFiles.has(rel)) continue;
  const lines = readFileSync(file, "utf8").split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const pattern of forbidden) {
      if (pattern.test(line)) {
        failures.push(`${rel}:${index + 1}: ${pattern} -> ${line.trim()}`);
      }
    }
  });
}

if (failures.length) {
  console.error("Commercial readiness check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Commercial readiness check passed.");
