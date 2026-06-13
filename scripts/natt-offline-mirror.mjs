#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = process.cwd();
const defaultManifestPath = "docs/offline-mirrors/external-mirrors.json";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function resolveRepoPath(path) {
  return resolve(root, path);
}

function normalizeMirrorForSbom(mirror) {
  return {
    "bom-ref": mirror.id,
    type: mirror.type,
    name: mirror.name,
    version: mirror.version,
    licenses: [{ license: { name: mirror.license } }],
    externalReferences: [{ type: "distribution", url: mirror.source }],
    properties: [
      {
        name: "devbot:roeRequired",
        value: String(Boolean(mirror.roeRequired)),
      },
      {
        name: "devbot:licenseReviewStatus",
        value: mirror.licenseReview?.status ?? "missing",
      },
      { name: "devbot:artifactPath", value: mirror.artifactPath ?? "" },
      { name: "devbot:sha256", value: mirror.sha256 ?? "" },
    ],
  };
}

function generateSbom(manifestPath = defaultManifestPath) {
  const manifest = readJson(resolveRepoPath(manifestPath));
  const sbomPath = resolveRepoPath(manifest.sbomPath);
  mkdirSync(dirname(sbomPath), { recursive: true });

  const sbom = {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    serialNumber: `urn:uuid:devbot-natt-offline-${Date.now()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      component: {
        type: "application",
        name: "DevBot NATT external offline mirrors",
        version: manifest.schemaVersion,
      },
    },
    components: manifest.mirrors.map(normalizeMirrorForSbom),
  };

  writeFileSync(sbomPath, `${JSON.stringify(sbom, null, 2)}\n`);
  return sbomPath;
}

function writeChecksums(manifestPath = defaultManifestPath) {
  const manifest = readJson(resolveRepoPath(manifestPath));
  const checksumsPath = resolveRepoPath(manifest.checksumsPath);
  mkdirSync(dirname(checksumsPath), { recursive: true });

  const lines = [];
  for (const mirror of manifest.mirrors) {
    if (!mirror.artifactPath) continue;
    const artifactPath = resolveRepoPath(mirror.artifactPath);
    if (!existsSync(artifactPath) || !statSync(artifactPath).isFile()) continue;
    lines.push(`${sha256(artifactPath)}  ${mirror.artifactPath}`);
  }

  writeFileSync(
    checksumsPath,
    `${lines.join("\n")}${lines.length ? "\n" : ""}`,
  );
  return checksumsPath;
}

function checkManifest(manifestPath = defaultManifestPath) {
  const manifestAbs = resolveRepoPath(manifestPath);
  const manifest = readJson(manifestAbs);
  const failures = [];

  if (manifest.schemaVersion !== "devbot.offline-mirrors.v1") {
    failures.push("schemaVersion must be devbot.offline-mirrors.v1");
  }
  if (!existsSync(resolveRepoPath(manifest.policy))) {
    failures.push(`ROE policy not found: ${manifest.policy}`);
  }
  if (!Array.isArray(manifest.mirrors) || manifest.mirrors.length === 0) {
    failures.push("mirrors must include at least one entry");
  }

  for (const mirror of manifest.mirrors ?? []) {
    const prefix = `${mirror.id ?? "mirror"}:`;
    if (!mirror.id) failures.push(`${prefix} id is required`);
    if (!mirror.source) failures.push(`${prefix} source is required`);
    if (!mirror.version) failures.push(`${prefix} version is required`);
    if (!mirror.license) failures.push(`${prefix} license is required`);
    if (!mirror.licenseReview?.status) {
      failures.push(`${prefix} licenseReview.status is required`);
    }
    if (mirror.licenseReview?.status === "rejected") {
      failures.push(`${prefix} license review is rejected`);
    }
    if (mirror.roeRequired !== true && mirror.roeRequired !== false) {
      failures.push(`${prefix} roeRequired must be boolean`);
    }

    if (mirror.artifactPath || mirror.sha256) {
      if (!mirror.artifactPath)
        failures.push(`${prefix} artifactPath is required when sha256 is set`);
      if (!mirror.sha256)
        failures.push(`${prefix} sha256 is required when artifactPath is set`);
      if (mirror.artifactPath) {
        const artifactPath = resolveRepoPath(mirror.artifactPath);
        if (!existsSync(artifactPath)) {
          failures.push(`${prefix} artifact missing: ${mirror.artifactPath}`);
        } else if (statSync(artifactPath).isFile()) {
          const current = sha256(artifactPath);
          if (mirror.sha256 && current !== mirror.sha256) {
            failures.push(
              `${prefix} checksum mismatch for ${mirror.artifactPath}`,
            );
          }
        } else {
          failures.push(
            `${prefix} artifactPath must point to an archived file, not a directory`,
          );
        }
      }
    }

    if (mirror.artifactPath && mirror.licenseReview?.status !== "approved") {
      failures.push(
        `${prefix} artifact cannot be used until license review is approved`,
      );
    }
  }

  if (failures.length) {
    throw new Error(`Offline mirror check failed:\n- ${failures.join("\n- ")}`);
  }

  const sbomPath = generateSbom(manifestPath);
  const checksumsPath = writeChecksums(manifestPath);
  return { sbomPath, checksumsPath, mirrorCount: manifest.mirrors.length };
}

const [command, manifestArg] = process.argv.slice(2);
const manifestPath = manifestArg || defaultManifestPath;

try {
  if (!command || command === "check") {
    const result = checkManifest(manifestPath);
    console.log(`Offline mirror check passed (${result.mirrorCount} entries).`);
    console.log(`SBOM: ${result.sbomPath}`);
    console.log(`Checksums: ${result.checksumsPath}`);
  } else if (command === "sbom") {
    console.log(`Generated ${generateSbom(manifestPath)}`);
    console.log(`Generated ${writeChecksums(manifestPath)}`);
  } else {
    console.error(
      "Usage: node scripts/natt-offline-mirror.mjs [check|sbom] [manifestPath]",
    );
    process.exitCode = 2;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
