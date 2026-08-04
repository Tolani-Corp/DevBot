import type { HarnessCostEnvelope } from "./contracts.js";

export type HarnessRepositoryStatus = "existing" | "planned" | "deprecated";

export interface HarnessRepositoryBoundary {
  name: string;
  owner: "Tolani-Corp";
  visibility: "private" | "internal" | "public";
  status: HarnessRepositoryStatus;
  responsibility: string;
  prohibitedResponsibilities: string[];
}

export interface HarnessStatePlane {
  operationalState: "convex";
  durableWorkflows: "convex-workflows";
  objectArtifacts: "cloudflare-r2-compatible";
  curatedDatasets: "hugging-face-datasets";
  analytics: "posthog-or-warehouse";
  secrets: "deployment-secret-store";
}

export interface HarnessPilot {
  id: "tsg-supplier-intelligence" | "gc-mastery-content-governance" | "taskstaff-operations";
  productRepository: string;
  objective: string;
  irreversibleActions: string[];
  requiredEvidence: string[];
  successMetrics: string[];
}

export interface TolaniHarnessBootstrap {
  schema: "tolani.harness.bootstrap.v1";
  platformName: "Tolani Harness Fabric";
  managementExperience: "Tolani Enterprise Hub";
  repositories: HarnessRepositoryBoundary[];
  statePlane: HarnessStatePlane;
  defaultBudget: HarnessCostEnvelope;
  requiredServices: string[];
  initialPilots: HarnessPilot[];
  commercializationGates: string[];
}

export const TOLANI_HARNESS_BOOTSTRAP: TolaniHarnessBootstrap = {
  schema: "tolani.harness.bootstrap.v1",
  platformName: "Tolani Harness Fabric",
  managementExperience: "Tolani Enterprise Hub",
  repositories: [
    {
      name: "tolani-harness-hub",
      owner: "Tolani-Corp",
      visibility: "private",
      status: "planned",
      responsibility:
        "Shared control plane for agent registry, workflows, tools, policies, evaluations, cost metering, approvals and audit events.",
      prohibitedResponsibilities: [
        "Product-specific user experience",
        "Raw customer dataset publication",
        "Direct ownership of subsidiary business rules",
      ],
    },
    {
      name: "tolani-data-hub",
      owner: "Tolani-Corp",
      visibility: "private",
      status: "planned",
      responsibility:
        "Dataset acquisition, lineage, quality, licensing, redaction, packaging and Hugging Face publication pipelines.",
      prohibitedResponsibilities: [
        "Agent orchestration",
        "Customer identity management",
        "Unreviewed publication of raw web acquisitions",
      ],
    },
    {
      name: "DevBot",
      owner: "Tolani-Corp",
      visibility: "public",
      status: "existing",
      responsibility:
        "Governed engineering teammate and NATT policy source for security-aware acquisition and implementation workflows.",
      prohibitedResponsibilities: [
        "Permanent enterprise workflow state",
        "Cross-tenant billing ledger",
        "Centralized production secrets",
      ],
    },
    {
      name: "TolaniCorp-HQ",
      owner: "Tolani-Corp",
      visibility: "private",
      status: "existing",
      responsibility:
        "Corporate management surface and authenticated Tolani Enterprise Hub experience.",
      prohibitedResponsibilities: [
        "Provider-specific crawler implementation",
        "Dataset transformation workers",
      ],
    },
  ],
  statePlane: {
    operationalState: "convex",
    durableWorkflows: "convex-workflows",
    objectArtifacts: "cloudflare-r2-compatible",
    curatedDatasets: "hugging-face-datasets",
    analytics: "posthog-or-warehouse",
    secrets: "deployment-secret-store",
  },
  defaultBudget: {
    maxCostUsd: 5,
    maxInputTokens: 250_000,
    maxOutputTokens: 50_000,
    maxModelCalls: 25,
    maxToolCalls: 100,
    maxProviderCredits: 100,
    maxWorkflowSteps: 50,
    maxParallelAgents: 4,
    maxRuntimeSeconds: 1_800,
    budgetAction: "request-approval",
  },
  requiredServices: [
    "control-api",
    "orchestrator",
    "model-router",
    "tool-gateway",
    "policy-engine",
    "evaluator",
    "usage-meter",
    "webhook-gateway",
    "artifact-service",
  ],
  initialPilots: [
    {
      id: "tsg-supplier-intelligence",
      productRepository: "Tolani-Corp/TolaniSupplyGroup-TSG",
      objective:
        "Collect supplier evidence, classify sourcing risk and prepare an approval-ready compliance packet.",
      irreversibleActions: [
        "Approve supplier",
        "Submit bid",
        "Issue purchase order",
        "Commit company funds",
      ],
      requiredEvidence: [
        "Manufacturer identity",
        "Country of origin",
        "Applicable acquisition clauses",
        "Source provenance",
      ],
      successMetrics: [
        "Cost per verified supplier packet",
        "Evidence completeness rate",
        "Reviewer return rate",
        "Provider credits per accepted source",
      ],
    },
    {
      id: "gc-mastery-content-governance",
      productRepository: "Tolani-Corp/florida-gc-mastery",
      objective:
        "Move official-source content through author, technical, compliance and founder-release gates.",
      irreversibleActions: [
        "Publish exam content",
        "Mark content officially verified",
        "Enable commercialization",
      ],
      requiredEvidence: [
        "Official source reference",
        "Effective date",
        "Independent technical review",
        "Compliance approval",
      ],
      successMetrics: [
        "Source-verification pass rate",
        "Review cycle time",
        "Publication defect rate",
        "Cost per approved question",
      ],
    },
    {
      id: "taskstaff-operations",
      productRepository: "Tolani-Corp/taskstaff.io",
      objective:
        "Decompose operational missions across specialist staff agents and reconcile outputs through an independent reviewer.",
      irreversibleActions: [
        "Hire or terminate personnel",
        "Execute contracts",
        "Send external commitments",
        "Move funds",
      ],
      requiredEvidence: [
        "Mission contract",
        "Staff assignment record",
        "Reviewer findings",
        "Final approval decision",
      ],
      successMetrics: [
        "Cost per completed mission",
        "Human escalation precision",
        "Reviewer disagreement rate",
        "Time to verified output",
      ],
    },
  ],
  commercializationGates: [
    "Three Tolani products operating on the shared control plane",
    "Ninety days of reconciled cost telemetry",
    "Tenant isolation tests passing",
    "Durable workflow restart and compensation tests passing",
    "Provider and model budget enforcement verified",
    "Source and tool provenance attached to every material output",
    "Security review completed",
    "Customer billing reconciles to provider invoices",
    "At least one industry pack demonstrates measurable savings",
  ],
};

export function validateHarnessBootstrap(
  bootstrap: TolaniHarnessBootstrap = TOLANI_HARNESS_BOOTSTRAP,
): string[] {
  const errors: string[] = [];
  const repositoryNames = new Set<string>();

  for (const repository of bootstrap.repositories) {
    if (repositoryNames.has(repository.name)) {
      errors.push(`Duplicate repository boundary: ${repository.name}`);
    }
    repositoryNames.add(repository.name);

    if (!repository.responsibility.trim()) {
      errors.push(`Repository responsibility is required: ${repository.name}`);
    }
    if (repository.prohibitedResponsibilities.length === 0) {
      errors.push(`Repository must declare prohibited responsibilities: ${repository.name}`);
    }
  }

  for (const required of ["tolani-harness-hub", "tolani-data-hub", "DevBot", "TolaniCorp-HQ"]) {
    if (!repositoryNames.has(required)) errors.push(`Missing repository boundary: ${required}`);
  }

  if (bootstrap.requiredServices.length === 0) errors.push("At least one control-plane service is required");
  if (bootstrap.initialPilots.length < 3) errors.push("The bootstrap requires three initial pilots");
  if (bootstrap.commercializationGates.length === 0) {
    errors.push("Commercialization gates are required");
  }

  return errors;
}
