import { describe, expect, it } from "vitest";
import { analyzeCCOT, formatCCOTMarkdown } from "@/reasoning/ccot";

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
    expect(analysis.riskLevel).toBe("high");
    expect(analysis.evidenceGaps).toContain("Bankroll policy: no linked evidence");
    expect(analysis.guardrails.join(" ")).toContain("Do not present CCOT as betting advice");
    expect(analysis.decisionImplications.join(" ")).toContain("avoid certainty");
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
});
