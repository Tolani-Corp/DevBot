#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildCCOTSurfaceModel,
  createCCOTDemoPackets,
  createCustomerClaimCCOTPacket,
  createPrHandoffCCOTPacket,
  createReleaseReadinessCCOTPacket,
  createSecurityReviewCCOTPacket,
  type CCOTPacket,
  type CCOTSurfaceModel,
} from "../src/reasoning/index.js";

function argValue(name: string): string | undefined {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const outputDir = path.resolve(argValue("--out-dir") ?? path.join("output", "ccot"));
const jsonPath = path.join(outputDir, "demo-packets.json");
const markdownPath = path.join(outputDir, "demo-packets.md");

const runtimePackets = [
  createReleaseReadinessCCOTPacket({
    subject: "Runtime release readiness packet",
    baselineLabel: "candidate branch",
    currentLabel: "release review",
    checksPassed: ["targeted tests passed", "typecheck passed", "build passed"],
    evidence: [
      {
        id: "release-verification",
        source: "local CI-equivalent run",
        timestamp: "2026-06-14",
        summary: "Targeted tests, typecheck, and build completed before release narration.",
        reliability: 0.9,
      },
    ],
  }),
  createSecurityReviewCCOTPacket({
    subject: "Runtime security review packet",
    baselineLabel: "pre-review implementation",
    currentLabel: "security review",
    mitigations: ["no secrets emitted", "strict evidence required for high-impact claims"],
    residualRisks: ["human approval required before production deployment"],
    evidence: [
      {
        id: "security-review",
        source: "security review checklist",
        timestamp: "2026-06-14",
        summary: "Review confirmed conservative handling and human approval requirement.",
        reliability: 0.86,
      },
    ],
  }),
  createCustomerClaimCCOTPacket({
    subject: "Runtime customer claim packet",
    baselineLabel: "draft customer copy",
    currentLabel: "qualified customer copy",
    previousClaim: "Feature is latest and production-ready.",
    revisedClaim: "Feature is available in this build after the listed verification checks.",
    evidence: [
      {
        id: "claim-scan",
        source: "claim scanner",
        timestamp: "2026-06-14",
        summary: "Scanner required timestamped evidence for latest or production-ready claims.",
        reliability: 0.84,
      },
    ],
  }),
  createPrHandoffCCOTPacket({
    subject: "Runtime PR/demo handoff packet",
    baselineLabel: "before implementation",
    currentLabel: "demo handoff",
    implementedChanges: ["CCOT packet builders added", "snapshot export generated", "UI surface model available"],
    unchangedGuardrails: ["high-risk claims require evidence", "review remains human-approved"],
    evidence: [
      {
        id: "handoff-diff",
        source: "local git diff",
        timestamp: "2026-06-14",
        summary: "Changed files show CCOT runtime and export additions.",
        reliability: 0.8,
      },
    ],
  }),
];

const packets = [...createCCOTDemoPackets(), ...runtimePackets];
const payload = {
  generatedAt: new Date().toISOString(),
  audiences: ["youtube-video-agents", "dashboard-seed-data", "figma-design-handoff", "docs"],
  packets: packets.map((packet) => ({
    ...packet,
    surface: buildCCOTSurfaceModel(packet.analysis),
  })),
};

function formatPacketIndex(items: Array<CCOTPacket & { surface: CCOTSurfaceModel }>): string {
  const lines: string[] = [];
  lines.push("# CCOT Demo Packet Index");
  lines.push("");
  lines.push(`Generated: ${payload.generatedAt}`);
  lines.push(`Audiences: ${payload.audiences.join(", ")}`);
  lines.push("");
  for (const packet of items) {
    lines.push(`## ${packet.title}`);
    lines.push("");
    lines.push(`- id: ${packet.id}`);
    lines.push(`- kind: ${packet.kind}`);
    lines.push(`- domain: ${packet.analysis.domain}`);
    lines.push(`- policy: ${packet.analysis.policyMode}`);
    lines.push(`- risk: ${packet.analysis.riskLevel}`);
    lines.push(`- confidence: ${(packet.analysis.confidence * 100).toFixed(0)}%`);
    lines.push(`- timeline items: ${packet.surface.timeline.length}`);
    lines.push(`- evidence chips: ${packet.surface.evidenceChips.length}`);
    lines.push(`- actions: ${packet.analysis.actions.map((action) => `${action.type}:${action.label}`).join("; ")}`);
    lines.push("");
    lines.push(packet.analysis.summary);
    lines.push("");
  }
  return `${lines.join("\n").trim()}\n`;
}

await mkdir(outputDir, { recursive: true });
await writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
await writeFile(markdownPath, formatPacketIndex(payload.packets), "utf8");
console.log(`Wrote ${packets.length} CCOT packets to ${jsonPath}`);
console.log(`Wrote CCOT packet index to ${markdownPath}`);
