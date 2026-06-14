import {
  createCCOTPacket,
  type CCOTEvidence,
  type CCOTObservation,
  type CCOTPacket,
} from "./ccot.js";

export interface ReleaseReadinessCCOTInput {
  subject: string;
  baselineLabel: string;
  currentLabel: string;
  checksPassed: string[];
  checksMissing?: string[];
  evidence: CCOTEvidence[];
}

export interface SecurityReviewCCOTInput {
  subject: string;
  baselineLabel: string;
  currentLabel: string;
  mitigations: string[];
  residualRisks?: string[];
  evidence: CCOTEvidence[];
}

export interface CustomerClaimCCOTInput {
  subject: string;
  baselineLabel: string;
  currentLabel: string;
  previousClaim: string;
  revisedClaim: string;
  unchangedTone?: string;
  evidence: CCOTEvidence[];
}

export interface PrHandoffCCOTInput {
  subject: string;
  baselineLabel: string;
  currentLabel: string;
  implementedChanges: string[];
  unchangedGuardrails?: string[];
  evidence: CCOTEvidence[];
}

function firstEvidenceIds(evidence: CCOTEvidence[]): string[] {
  return evidence.slice(0, 3).map((item) => item.id);
}

function joined(items: string[], fallback: string): string {
  return items.length > 0 ? items.join("; ") : fallback;
}

export function createReleaseReadinessCCOTPacket(input: ReleaseReadinessCCOTInput): CCOTPacket {
  const evidenceIds = firstEvidenceIds(input.evidence);
  const observations: CCOTObservation[] = [
    {
      id: "release-checks",
      label: "Release checks",
      category: "release",
      before: "Release claims were not yet tied to completed checks.",
      after: joined(input.checksPassed, "No completed release checks were supplied."),
      status: input.checksPassed.length > 0 ? "changed" : "uncertain",
      direction: input.checksPassed.length > 0 ? "introduced" : "unknown",
      significance: 0.88,
      evidenceIds,
    },
    {
      id: "release-gaps",
      label: "Release gaps",
      category: "release",
      before: "Open checks required review before release.",
      after: joined(input.checksMissing ?? [], "No missing release checks were declared."),
      status: input.checksMissing?.length ? "uncertain" : "continued",
      direction: input.checksMissing?.length ? "unknown" : "stabilized",
      significance: input.checksMissing?.length ? 0.82 : 0.68,
      evidenceIds: input.checksMissing?.length ? [] : evidenceIds,
    },
  ];

  return createCCOTPacket("devbot_review", input.subject, {
    subject: input.subject,
    domain: "release",
    policyMode: "strict",
    baselineLabel: input.baselineLabel,
    currentLabel: input.currentLabel,
    decisionContext: "Decide whether release wording is supported by completed checks.",
    evidence: input.evidence,
    observations,
  });
}

export function createSecurityReviewCCOTPacket(input: SecurityReviewCCOTInput): CCOTPacket {
  const evidenceIds = firstEvidenceIds(input.evidence);
  const observations: CCOTObservation[] = [
    {
      id: "security-mitigations",
      label: "Security mitigations",
      category: "security",
      before: "Risk controls required review.",
      after: joined(input.mitigations, "No mitigations were supplied."),
      status: input.mitigations.length > 0 ? "changed" : "uncertain",
      direction: input.mitigations.length > 0 ? "introduced" : "unknown",
      significance: 0.9,
      evidenceIds,
    },
    {
      id: "residual-risk",
      label: "Residual risk",
      category: "security",
      before: "Residual risk must be explicit before approval.",
      after: joined(input.residualRisks ?? [], "No residual risks were declared."),
      status: input.residualRisks?.length ? "uncertain" : "continued",
      direction: input.residualRisks?.length ? "unknown" : "stabilized",
      significance: 0.86,
      evidenceIds: input.residualRisks?.length ? [] : evidenceIds,
    },
  ];

  return createCCOTPacket("devbot_review", input.subject, {
    subject: input.subject,
    domain: "security",
    policyMode: "strict",
    baselineLabel: input.baselineLabel,
    currentLabel: input.currentLabel,
    decisionContext: "Escalate incomplete or high-impact security claims.",
    evidence: input.evidence,
    observations,
  });
}

export function createCustomerClaimCCOTPacket(input: CustomerClaimCCOTInput): CCOTPacket {
  const evidenceIds = firstEvidenceIds(input.evidence);
  return createCCOTPacket("devbot_review", input.subject, {
    subject: input.subject,
    domain: "customer",
    policyMode: "strict",
    baselineLabel: input.baselineLabel,
    currentLabel: input.currentLabel,
    decisionContext: "Qualify customer-facing claims unless timestamped evidence supports them.",
    evidence: input.evidence,
    observations: [
      {
        id: "customer-claim",
        label: "Customer claim",
        category: "customer_claim",
        before: input.previousClaim,
        after: input.revisedClaim,
        status: "changed",
        direction: "introduced",
        significance: 0.9,
        evidenceIds,
      },
      {
        id: "customer-tone",
        label: "Customer tone",
        category: "customer_claim",
        before: input.unchangedTone ?? "Copy should remain concise, accurate, and non-exaggerated.",
        after: input.unchangedTone ?? "Copy remains concise, accurate, and non-exaggerated.",
        status: "continued",
        direction: "stabilized",
        significance: 0.72,
        evidenceIds,
      },
    ],
  });
}

export function createPrHandoffCCOTPacket(input: PrHandoffCCOTInput): CCOTPacket {
  const evidenceIds = firstEvidenceIds(input.evidence);
  return createCCOTPacket("devbot_review", input.subject, {
    subject: input.subject,
    domain: "engineering",
    policyMode: "lightweight",
    baselineLabel: input.baselineLabel,
    currentLabel: input.currentLabel,
    decisionContext: "Summarize what changed, what stayed stable, and what reviewers should inspect.",
    evidence: input.evidence,
    observations: [
      {
        id: "implemented-changes",
        label: "Implemented changes",
        category: "handoff",
        before: "Requested work was not implemented.",
        after: joined(input.implementedChanges, "No implemented changes were supplied."),
        status: input.implementedChanges.length > 0 ? "changed" : "uncertain",
        direction: input.implementedChanges.length > 0 ? "introduced" : "unknown",
        significance: 0.82,
        evidenceIds,
      },
      {
        id: "unchanged-guardrails",
        label: "Unchanged guardrails",
        category: "governance",
        before: joined(input.unchangedGuardrails ?? [], "Existing guardrails remained in force."),
        after: joined(input.unchangedGuardrails ?? [], "Existing guardrails remained in force."),
        status: "continued",
        direction: "stabilized",
        significance: 0.74,
        evidenceIds,
      },
    ],
  });
}
