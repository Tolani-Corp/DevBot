import { describe, expect, it } from "vitest";
import {
  analyzeCCOT,
  buildCCOTSurfaceModel,
  createBettorsAceAARCCOTPacket,
  createBettorsAceWarroomCCOTPacket,
  createCCOTDemoPackets,
  createStudentLearningCCOTPacket,
  formatCCOTMarkdown,
  resolveCCOTPolicyMode,
} from "@/reasoning";

describe("reasoning/ccot", () => {
  it("separates changes, continuities, turning points, and evidence for student learning", () => {
    const analysis = analyzeCCOT({
      subject: "Tolani Labs student API project",
      domain: "student_learning",
      baselineLabel: "lesson 1",
      currentLabel: "lesson 4",
      decisionContext: "Prepare mentor feedback for the next lab session.",
      evidence: [
        {
          id: "commit-tests",
          source: "git commit abc123",
          summary: "Student added tests before implementing the notes route.",
          reliability: 0.95,
        },
        {
          id: "review-rubric",
          source: "mentor review rubric",
          summary: "Naming and validation comments still need work.",
          reliability: 0.8,
        },
      ],
      events: [
        {
          id: "turning-point-tests",
          timestamp: "2026-06-10",
          label: "Tests-first workflow adopted",
          description: "The student wrote failing tests before implementation.",
          significance: 0.9,
          evidenceIds: ["commit-tests"],
        },
      ],
      observations: [
        {
          id: "test-discipline",
          label: "Testing discipline",
          category: "engineering_practice",
          before: "manual checks only",
          after: "focused Vitest coverage before route implementation",
          status: "changed",
          direction: "introduced",
          significance: 0.9,
          evidenceIds: ["commit-tests"],
          implication: "Student is ready for contract-testing practice.",
        },
        {
          id: "validation-boundary",
          label: "API validation boundary",
          category: "architecture",
          before: "validation explained verbally",
          after: "validation is still present and enforced at the route boundary",
          status: "continued",
          direction: "stabilized",
          significance: 0.75,
          evidenceIds: ["review-rubric"],
        },
      ],
    });

    expect(analysis.domain).toBe("student_learning");
    expect(analysis.changes).toHaveLength(1);
    expect(analysis.continuities).toHaveLength(1);
    expect(analysis.turningPoints[0].label).toBe("Tests-first workflow adopted");
    expect(analysis.evidenceGaps).toHaveLength(0);
    expect(analysis.confidence).toBeGreaterThan(0.7);
    expect(analysis.policyMode).toBe("lightweight");
    expect(analysis.actions.some((action) => action.type === "change")).toBe(true);
    expect(analysis.guardrails).toContain("Return a learner-facing explanation and a next practice step.");
    expect(analysis.decisionImplications.join(" ")).toContain("misconception check");
  });

  it("keeps bettorsace warroom output non-predictive and escalates evidence gaps", () => {
    const analysis = analyzeCCOT({
      subject: "BetTorsAce warroom market read",
      domain: "bettorsace_warroom",
      baselineLabel: "morning review",
      currentLabel: "pre-event review",
      decisionContext: "Review whether assumptions changed since the prior warroom note.",
      evidence: [
        {
          id: "odds-log",
          source: "internal odds movement log",
          summary: "Line movement changed during the afternoon window.",
          reliability: 0.85,
        },
      ],
      observations: [
        {
          id: "line-movement",
          label: "Line movement",
          category: "market_signal",
          before: "stable morning range",
          after: "afternoon movement exceeded normal review threshold",
          status: "changed",
          direction: "increased",
          significance: 0.8,
          evidenceIds: ["odds-log"],
        },
        {
          id: "bankroll-policy",
          label: "Bankroll policy",
          category: "risk_control",
          before: "daily exposure cap applies",
          after: "daily exposure cap still applies",
          status: "continued",
          direction: "stabilized",
          significance: 0.9,
          evidenceIds: [],
        },
      ],
    });

    expect(analysis.domain).toBe("bettorsace_warroom");
    expect(analysis.policyMode).toBe("strict");
    expect(analysis.riskLevel).toBe("high");
    expect(analysis.evidenceGaps).toContain("Bankroll policy: no linked evidence");
    expect(analysis.guardrails.join(" ")).toContain("Do not present CCOT as betting advice");
    expect(analysis.decisionImplications.join(" ")).toContain("avoid certainty");
    expect(analysis.actions.some((action) => action.type === "escalate")).toBe(true);
  });

  it("formats an auditable markdown report", () => {
    const analysis = analyzeCCOT({
      subject: "Release readiness",
      domain: "release",
      baselineLabel: "candidate build",
      currentLabel: "release review",
      evidence: [
        {
          id: "ci",
          source: "CI run",
          summary: "Build and tests passed.",
          reliability: 0.9,
        },
      ],
      observations: [
        {
          id: "ci-status",
          label: "CI status",
          category: "verification",
          before: "not run",
          after: "passing",
          status: "changed",
          evidenceIds: ["ci"],
        },
      ],
    });

    const markdown = formatCCOTMarkdown(analysis);
    expect(markdown).toContain("# CCOT Analysis: Release readiness");
    expect(markdown).toContain("## Changes");
    expect(markdown).toContain("## Action Queue");
    expect(markdown).toContain("## Guardrails");
    expect(markdown).toContain("Require strict evidence");
  });

  it("rejects empty observations", () => {
    expect(() =>
      analyzeCCOT({
        subject: "Empty case",
        baselineLabel: "before",
        currentLabel: "after",
        observations: [],
      }),
    ).toThrow("CCOT requires at least one observation.");
  });

  it("resolves strict policy mode for high-risk domains", () => {
    expect(resolveCCOTPolicyMode("release")).toBe("strict");
    expect(resolveCCOTPolicyMode("security")).toBe("strict");
    expect(resolveCCOTPolicyMode("customer")).toBe("strict");
    expect(resolveCCOTPolicyMode("bettorsace_warroom")).toBe("strict");
    expect(resolveCCOTPolicyMode("engineering")).toBe("lightweight");
  });

  it("creates reusable student packet and UI surface model", () => {
    const packet = createStudentLearningCCOTPacket(
      {
        subject: "Student CSS workflow",
        baselineLabel: "before layout review",
        currentLabel: "after layout review",
        evidence: [
          {
            id: "preview",
            source: "local preview",
            summary: "Student validated the layout in a browser preview.",
            reliability: 0.86,
          },
        ],
        observations: [
          {
            id: "preview-habit",
            label: "Preview habit",
            category: "learning",
            before: "did not check responsive state",
            after: "checks responsive state before handoff",
            status: "changed",
            significance: 0.84,
            evidenceIds: ["preview"],
          },
        ],
      },
      "student-css-workflow",
    );
    const surface = buildCCOTSurfaceModel(packet.analysis);

    expect(packet.kind).toBe("student_learning");
    expect(surface.timeline.map((item) => item.kind)).toContain("baseline");
    expect(surface.evidenceChips[0].source).toBe("local preview");
    expect(surface.prompts.join(" ")).toContain("What changed");
    expect(surface.actionQueue.length).toBeGreaterThan(0);
  });

  it("converts BettorsACE AAR content into strict CCOT actions and drift surface", () => {
    const packet = createBettorsAceAARCCOTPacket({
      subject: "AAR model adjustment",
      baselineLabel: "pre-AAR",
      currentLabel: "post-AAR",
      aarSource: "Santa Anita AAR",
      previousModelBehavior: "single-key win labels were too aggressive",
      currentModelBehavior: "single-key win labels require independent support",
      stableStrengths: "top-three contender coverage remained useful",
      recurringFailures: "straight exotics remained brittle",
      changedContext: "late-surface chaos needs review",
      actionTaken: "guard brittle lanes through historical-intelligence gate",
    });
    const surface = buildCCOTSurfaceModel(packet.analysis);

    expect(packet.kind).toBe("bettorsace_aar");
    expect(packet.analysis.policyMode).toBe("strict");
    expect(packet.analysis.actions.some((action) => action.type === "change")).toBe(true);
    expect(surface.warroomDriftPanel?.aarDeltas.length).toBeGreaterThan(0);
    expect(surface.warroomDriftPanel?.safetyFlags.join(" ")).toContain("betting advice");
  });

  it("keeps warroom packets non-predictive with no-pick/no-stake guardrails", () => {
    const packet = createBettorsAceWarroomCCOTPacket({
      subject: "War Room drift",
      baselineLabel: "morning board",
      currentLabel: "pre-event board",
      evidence: [
        {
          id: "market-log",
          source: "market log",
          summary: "Movement exceeded review threshold.",
          reliability: 0.8,
        },
      ],
      observations: [
        {
          id: "drift",
          label: "Assumption drift",
          category: "assumption",
          before: "stable",
          after: "review threshold exceeded",
          status: "changed",
          significance: 0.82,
          evidenceIds: ["market-log"],
        },
      ],
    });

    expect(packet.analysis.guardrails.join(" ")).toContain("Do not present CCOT as betting advice");
    expect(packet.analysis.decisionImplications.join(" ")).toContain("avoid certainty");
  });

  it("seeds polished demo packets for marketing and workflow demos", () => {
    const packets = createCCOTDemoPackets();
    expect(packets.map((packet) => packet.id)).toEqual(
      expect.arrayContaining([
        "demo-tolani-student-terminal",
        "demo-debo-release-readiness",
        "demo-bettorsace-aar-model-adjustment",
        "demo-bettorsace-warroom-drift",
        "demo-devbot-stale-claim-scanner",
      ]),
    );
    expect(packets.every((packet) => packet.analysis.actions.length > 0)).toBe(true);
  });
});
