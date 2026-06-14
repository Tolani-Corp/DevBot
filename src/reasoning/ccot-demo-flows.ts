import {
  createBettorsAceAARCCOTPacket,
  createBettorsAceWarroomCCOTPacket,
  createDevBotReviewCCOTPacket,
  createStudentLearningCCOTPacket,
  type CCOTPacket,
} from "./ccot.js";

export function createCCOTDemoPackets(): CCOTPacket[] {
  const student = createStudentLearningCCOTPacket(
    {
      subject: "Tolani Labs student terminal workflow",
      baselineLabel: "first terminal lab",
      currentLabel: "review-ready terminal lab",
      decisionContext: "Prepare mentor feedback and the next practice task.",
      evidence: [
        {
          id: "lesson-log",
          source: "DEBO terminal lesson log",
          timestamp: "2026-06-14",
          summary: "Student moved from vague prompts to scoped terminal steps with checkpoint language.",
          reliability: 0.9,
        },
        {
          id: "work-product",
          source: "student repository diff",
          timestamp: "2026-06-14",
          summary: "Student added a focused component and verified it with a local preview.",
          reliability: 0.86,
        },
      ],
      events: [
        {
          id: "checkpoint-habit",
          label: "Checkpoint habit introduced",
          timestamp: "2026-06-14",
          description: "The student began pausing for evidence before asking for the next step.",
          significance: 0.82,
          evidenceIds: ["lesson-log"],
        },
      ],
      observations: [
        {
          id: "terminal-scoping",
          label: "Terminal scoping",
          category: "learning",
          before: "Commands were copied without naming intent.",
          after: "Commands are tied to a goal, expected output, and recovery path.",
          status: "changed",
          direction: "introduced",
          significance: 0.86,
          evidenceIds: ["lesson-log"],
          implication: "Next lab should practice reading failures before rerunning commands.",
        },
        {
          id: "student-curiosity",
          label: "Student curiosity",
          category: "learning",
          before: "Asked why after seeing output.",
          after: "Still asks why after seeing output.",
          status: "continued",
          direction: "stabilized",
          significance: 0.74,
          evidenceIds: ["work-product"],
        },
      ],
    },
    "demo-tolani-student-terminal",
  );

  const release = createDevBotReviewCCOTPacket(
    {
      subject: "DEBO release readiness review",
      domain: "release",
      baselineLabel: "candidate build",
      currentLabel: "release gate",
      policyMode: "strict",
      decisionContext: "Decide whether release claims are supported by checks and evidence.",
      evidence: [
        {
          id: "test-run",
          source: "local verification run",
          timestamp: "2026-06-14",
          summary: "Targeted tests passed for the changed reasoning module.",
          reliability: 0.9,
        },
        {
          id: "build-run",
          source: "typecheck/build output",
          timestamp: "2026-06-14",
          summary: "Typecheck and package export checks completed before release narration.",
          reliability: 0.88,
        },
      ],
      observations: [
        {
          id: "claim-discipline",
          label: "Release claim discipline",
          category: "release",
          before: "Claims were drafted before verification was complete.",
          after: "Claims are tied to test/build evidence before release wording.",
          status: "changed",
          direction: "introduced",
          significance: 0.88,
          evidenceIds: ["test-run", "build-run"],
        },
        {
          id: "human-review",
          label: "Human review",
          category: "governance",
          before: "Human review required for production claims.",
          after: "Human review still required for production claims.",
          status: "continued",
          direction: "stabilized",
          significance: 0.86,
          evidenceIds: ["build-run"],
        },
      ],
    },
    "demo-debo-release-readiness",
  );

  const aar = createBettorsAceAARCCOTPacket({
    id: "demo-bettorsace-aar-model-adjustment",
    subject: "BettorsACE AAR-to-model adjustment",
    baselineLabel: "pre-AAR racing model",
    currentLabel: "post-AAR guarded model",
    aarSource: "Santa Anita 2026-05-15 AAR",
    aarTimestamp: "2026-05-16",
    previousModelBehavior: "Position/pace top pick was allowed to act like a single-key win signal.",
    currentModelBehavior: "Position/pace top pick is treated as contender-core evidence unless independent win-key support exists.",
    stableStrengths: "Top-three and top-four contender coverage remained useful as lower-variance context.",
    recurringFailures: "Straight exotics and position-only win keys remained brittle on chaotic turf and fade-risk races.",
    changedContext: "Late-surface chaos and front-speed fade risk now require explicit review flags.",
    actionTaken: "Guard straight exotics, preserve board confidence, and send fragile lanes through historical-intelligence gates.",
  });

  const warroom = createBettorsAceWarroomCCOTPacket(
    {
      subject: "BettorsACE War Room assumption drift",
      baselineLabel: "morning board",
      currentLabel: "pre-event board",
      decisionContext: "Review assumption drift without generating picks, odds forecasts, or stake advice.",
      evidence: [
        {
          id: "market-log",
          source: "internal market movement log",
          timestamp: "2026-06-14",
          summary: "Afternoon movement exceeded the internal review threshold.",
          reliability: 0.82,
        },
      ],
      observations: [
        {
          id: "assumption-drift",
          label: "Assumption drift",
          category: "assumption",
          before: "Morning assumptions were aligned with stable context.",
          after: "Pre-event movement requires stale-context review.",
          status: "changed",
          direction: "increased",
          significance: 0.8,
          evidenceIds: ["market-log"],
        },
        {
          id: "no-stake-policy",
          label: "No stake guidance",
          category: "guardrail",
          before: "War Room avoids stake sizing.",
          after: "War Room still avoids stake sizing.",
          status: "continued",
          direction: "stabilized",
          significance: 0.94,
          evidenceIds: ["market-log"],
        },
      ],
    },
    "demo-bettorsace-warroom-drift",
  );

  const claimScanner = createDevBotReviewCCOTPacket(
    {
      subject: "DevBot stale-claim scanner",
      domain: "customer",
      baselineLabel: "draft customer note",
      currentLabel: "evidence-reviewed customer note",
      policyMode: "strict",
      decisionContext: "Remove or qualify stale claims before customer-facing copy is approved.",
      evidence: [
        {
          id: "scanner-output",
          source: "claims scanner",
          timestamp: "2026-06-14",
          summary: "Scanner flagged an unsupported latest/best claim and missing timestamp.",
          reliability: 0.84,
        },
      ],
      observations: [
        {
          id: "latest-claim",
          label: "Latest claim",
          category: "customer_claim",
          before: "Copy asserted latest capability without timestamped evidence.",
          after: "Copy now requires timestamped evidence or a qualified statement.",
          status: "changed",
          direction: "introduced",
          significance: 0.9,
          evidenceIds: ["scanner-output"],
        },
        {
          id: "customer-tone",
          label: "Customer tone",
          category: "customer_claim",
          before: "Copy stayed concise and customer-safe.",
          after: "Copy remains concise and customer-safe.",
          status: "continued",
          direction: "stabilized",
          significance: 0.72,
          evidenceIds: ["scanner-output"],
        },
      ],
    },
    "demo-devbot-stale-claim-scanner",
  );

  return [student, release, aar, warroom, claimScanner];
}
