#!/usr/bin/env node
import { analyzeCCOT, formatCCOTMarkdown } from "../src/reasoning/ccot.js";

const studentAnalysis = analyzeCCOT({
  subject: "Tolani Labs student terminal workflow",
  domain: "student_learning",
  baselineLabel: "first API lesson",
  currentLabel: "reviewed PR lesson",
  decisionContext: "Prepare the next DEBO mentor prompt.",
  evidence: [
    {
      id: "lesson-log",
      source: "DEBO terminal lesson log",
      summary: "Student moved from vague prompt to tests-first implementation.",
      reliability: 0.9,
    },
    {
      id: "pr-packet",
      source: "review evidence packet",
      summary: "Checks and changed files were attached before review.",
      reliability: 0.85,
    },
  ],
  events: [
    {
      id: "tests-first",
      timestamp: "2026-06-14",
      label: "Tests-first habit introduced",
      description: "The student accepted a plan that wrote tests before code.",
      significance: 0.85,
      evidenceIds: ["lesson-log"],
    },
  ],
  observations: [
    {
      id: "planning",
      label: "Planning behavior",
      category: "learning",
      before: "goal was vague and unscoped",
      after: "goal is translated into scoped implementation steps",
      status: "changed",
      direction: "introduced",
      significance: 0.8,
      evidenceIds: ["lesson-log"],
    },
    {
      id: "review-gate",
      label: "Human review gate",
      category: "governance",
      before: "review required before release claims",
      after: "review still required before release claims",
      status: "continued",
      direction: "stabilized",
      significance: 0.9,
      evidenceIds: ["pr-packet"],
    },
  ],
});

const warroomAnalysis = analyzeCCOT({
  subject: "BetTorsAce warroom assumption review",
  domain: "bettorsace_warroom",
  baselineLabel: "morning board",
  currentLabel: "pre-event board",
  decisionContext: "Review assumptions without generating picks or stake advice.",
  evidence: [
    {
      id: "market-log",
      source: "synthetic market movement log",
      summary: "Afternoon movement exceeded the review threshold.",
      reliability: 0.8,
    },
  ],
  observations: [
    {
      id: "market-movement",
      label: "Market movement",
      category: "risk_signal",
      before: "stable within expected range",
      after: "movement exceeded review threshold",
      status: "changed",
      direction: "increased",
      significance: 0.75,
      evidenceIds: ["market-log"],
    },
    {
      id: "responsible-gaming",
      label: "Responsible-gaming posture",
      category: "guardrail",
      before: "no chase decisions",
      after: "no chase decisions",
      status: "continued",
      direction: "stabilized",
      significance: 0.95,
      evidenceIds: [],
    },
  ],
});

console.log(formatCCOTMarkdown(studentAnalysis));
console.log("\n" + "=".repeat(80) + "\n");
console.log(formatCCOTMarkdown(warroomAnalysis));
