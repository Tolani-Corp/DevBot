import { readFile, stat } from "node:fs/promises";
import path from "node:path";

type EvidenceFile = {
  generatedAt?: string;
  request?: {
    id?: string;
    summary?: string;
    operator?: string;
  };
  architecture?: {
    enhancementId?: string;
    adrIds?: string[];
    designReview?: {
      status?: string;
      packet?: string;
    };
    humanApprovals?: string[];
    evidenceHashes?: Array<{
      path: string;
      sha256: string;
    }>;
  };
  delivery?: {
    path?: string[];
    changedFiles?: string[];
    testCommands?: string[];
    pullRequest?: {
      required?: boolean;
      url?: string | null;
      reviewPolicy?: string;
    };
    deploy?: {
      required?: boolean;
      environment?: string;
      workflow?: string;
      provenance?: string;
    };
  };
  evolution?: {
    ci?: string[];
    evals?: string[];
    releaseGovernance?: string;
    rollback?: {
      plan?: string;
      proofRequired?: boolean;
    };
  };
  claimIntegrity?: {
    policy?: string;
    defaultPosture?: string;
    strictDomains?: string[];
    requirements?: string[];
  };
  offlineMirrors?: {
    policy?: string;
    manifest?: string;
    sbom?: string;
    checksums?: string;
    localBundle?: string;
  };
  provenance?: {
    predicateType?: string;
    subject?: {
      name?: string;
      digest?: string;
    };
    builder?: {
      id?: string;
    };
  };
};

export type DashboardStat = {
  name: string;
  value: string;
  change: string;
  tone: "positive" | "warning" | "danger" | "neutral";
};

export type DashboardTask = {
  id: string;
  title: string;
  lane: string;
  status: "ready" | "running" | "review" | "blocked" | "complete";
  risk: "low" | "medium" | "high";
  owner: string;
  progress: number;
  nextAction: string;
};

export type DashboardAgent = {
  id: string;
  name: string;
  role: string;
  status: "active" | "reviewed" | "standby";
  coverage: string;
  guardrail: string;
};

export type DashboardDeployment = {
  id: string;
  environment: string;
  workflow: string;
  status: "ready" | "review" | "blocked";
  provenance: string;
  rollback: string;
};

export type DashboardEvidence = {
  id: string;
  label: string;
  path: string;
  status: "verified" | "required" | "review";
  digest?: string;
};

export type DashboardData = {
  generatedAt: string;
  overview: {
    stats: DashboardStat[];
    activity: Array<{
      id: string;
      message: string;
      time: string;
      tone: "positive" | "info" | "warning" | "danger";
    }>;
  };
  tasks: DashboardTask[];
  agents: DashboardAgent[];
  deployments: DashboardDeployment[];
  evidence: DashboardEvidence[];
  settings: {
    approvalMode: string;
    claimIntegrity: string;
    strictDomains: string[];
    memoryPolicy: string;
    unchainedMode: string;
  };
  profile: {
    name: string;
    organization: string;
    role: string;
    contact: string;
  };
};

const rootDir = path.resolve(process.cwd(), "..");
const evidencePath = path.join(
  rootDir,
  ".devbot",
  "evidence",
  "demo-delivery-evidence.json",
);

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(path.join(rootDir, filePath));
    return true;
  } catch {
    return false;
  }
}

function shortDigest(value?: string) {
  return value ? `${value.slice(0, 10)}...${value.slice(-6)}` : undefined;
}

function titleFromPath(filePath: string) {
  return filePath
    .split("/")
    .pop()
    ?.replace(/\.(md|json|yml|yaml|sha256)$/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) ?? filePath;
}

export async function getDashboardData(): Promise<DashboardData> {
  const evidence = await readJson<EvidenceFile>(evidencePath);
  const hashes = evidence?.architecture?.evidenceHashes ?? [];
  const approvals = evidence?.architecture?.humanApprovals ?? [];
  const strictDomains = evidence?.claimIntegrity?.strictDomains ?? [
    "security",
    "release",
    "customer",
  ];
  const changedFiles = evidence?.delivery?.changedFiles ?? [];
  const deploy = evidence?.delivery?.deploy;
  const rollback = evidence?.evolution?.rollback;
  const mirrorManifestExists = evidence?.offlineMirrors?.manifest
    ? await fileExists(evidence.offlineMirrors.manifest)
    : false;

  const tasks: DashboardTask[] = [
    {
      id: "task-intake",
      title: "Normalize governed request into a reviewable lane",
      lane: "DEBO Core",
      status: "complete",
      risk: "low",
      owner: evidence?.request?.operator ?? "operator",
      progress: 100,
      nextAction: "Keep request summary attached to evidence packet.",
    },
    {
      id: "task-evidence",
      title: "Attach ADR, design review, hashes, and approval owners",
      lane: "Evidence",
      status: "review",
      risk: "medium",
      owner: approvals[0] ?? "architecture-owner",
      progress: hashes.length > 0 ? 82 : 35,
      nextAction: "Review proof packet before release notes are asserted.",
    },
    {
      id: "task-release",
      title: "Prepare deployment intent and rollback proof",
      lane: "Release",
      status: deploy?.required ? "review" : "ready",
      risk: "high",
      owner: approvals[2] ?? "operations-owner",
      progress: rollback?.proofRequired ? 70 : 55,
      nextAction: rollback?.proofRequired
        ? "Attach rollback evidence before production claims."
        : "Confirm release workflow owner.",
    },
    {
      id: "task-claim-integrity",
      title: "Apply strict policy to high-risk customer/security claims",
      lane: "Claim Integrity",
      status: "ready",
      risk: "high",
      owner: approvals[1] ?? "security-owner",
      progress: strictDomains.length > 0 ? 88 : 45,
      nextAction: "Label observed facts, inferences, and unverified claims.",
    },
  ];

  const agents: DashboardAgent[] = [
    {
      id: "orchestrator",
      name: "Orchestrator",
      role: "Routes request-to-PR work lanes",
      status: "active",
      coverage: "intake, planning, patch, review",
      guardrail: "Human approval for high-risk merge/deploy steps",
    },
    {
      id: "security",
      name: "Security Reviewer",
      role: "Reviews NATT and claim-integrity posture",
      status: "reviewed",
      coverage: "ROE, secrets, dependency risk, evidence labels",
      guardrail: "Authorized, scoped, non-destructive by default",
    },
    {
      id: "release-captain",
      name: "Release Captain",
      role: "Checks build, CI, rollback, and release notes",
      status: "active",
      coverage: "deployment intent, provenance, changelog readiness",
      guardrail: "Blocks release claims without proof",
    },
    {
      id: "memory",
      name: "Memory Steward",
      role: "Maintains journey memory and teach-loop durability",
      status: "standby",
      coverage: "approvals, lessons, operator state",
      guardrail: "Forget and retention controls stay explicit",
    },
  ];

  const evidenceItems: DashboardEvidence[] = [
    ...hashes.map((item) => ({
      id: item.path,
      label: titleFromPath(item.path),
      path: item.path,
      status: "verified" as const,
      digest: shortDigest(item.sha256),
    })),
    ...(evidence?.offlineMirrors
      ? [
          {
            id: "offline-mirror-manifest",
            label: "Offline mirror manifest",
            path: evidence.offlineMirrors.manifest ?? "not configured",
            status: mirrorManifestExists ? ("verified" as const) : ("review" as const),
          },
          {
            id: "claim-integrity-policy",
            label: "Claim integrity policy",
            path: evidence.claimIntegrity?.policy ?? "not configured",
            status: "required" as const,
          },
        ]
      : []),
  ];

  return {
    generatedAt: evidence?.generatedAt ?? new Date().toISOString(),
    overview: {
      stats: [
        {
          name: "Governance Gates",
          value: String(approvals.length + strictDomains.length),
          change: "approval + strict claim domains",
          tone: "positive",
        },
        {
          name: "Evidence Files",
          value: String(hashes.length || changedFiles.length),
          change: "hash-backed references",
          tone: hashes.length > 0 ? "positive" : "warning",
        },
        {
          name: "Release Posture",
          value: deploy?.environment ?? "staging",
          change: deploy?.workflow ?? "workflow pending",
          tone: deploy?.workflow ? "positive" : "warning",
        },
      ],
      activity: [
        {
          id: "activity-evidence",
          message:
            evidence?.request?.summary ??
            "Governed request packet is ready for operator review.",
          time: "governance evidence",
          tone: "positive",
        },
        {
          id: "activity-mirrors",
          message:
            "External mirrors require license approval, SBOM, checksums, and ROE.",
          time: mirrorManifestExists ? "policy verified" : "policy review",
          tone: mirrorManifestExists ? "info" : "warning",
        },
        {
          id: "activity-release",
          message:
            "Deployment workflow emits a reviewed deployment intent artifact.",
          time: deploy?.environment ?? "release gate",
          tone: deploy?.workflow ? "positive" : "warning",
        },
        {
          id: "activity-unchained",
          message:
            "DEBO Unchained remains reviewed-only for high-risk offensive work.",
          time: "high-risk control",
          tone: "danger",
        },
      ],
    },
    tasks,
    agents,
    deployments: [
      {
        id: "deploy-staging",
        environment: deploy?.environment ?? "staging",
        workflow: deploy?.workflow ?? ".github/workflows/deploy.yml",
        status: deploy?.required ? "review" : "ready",
        provenance:
          deploy?.provenance ??
          "Provenance required before customer or production claims.",
        rollback:
          rollback?.plan ??
          "Rollback proof must be attached before release approval.",
      },
      {
        id: "deploy-governance",
        environment: "governance",
        workflow: ".github/workflows/devbot-governance.yml",
        status: "ready",
        provenance:
          evidence?.provenance?.predicateType ??
          "Delivery evidence predicate required.",
        rollback: "Policy failures block release notes until corrected.",
      },
    ],
    evidence: evidenceItems,
    settings: {
      approvalMode: "strict for high-risk, lightweight for ordinary coding",
      claimIntegrity:
        evidence?.claimIntegrity?.defaultPosture ??
        "Evidence required before high-risk claims.",
      strictDomains,
      memoryPolicy: "Journey memory on; passive learning off by default",
      unchainedMode: "reviewed-only with written authorization",
    },
    profile: {
      name: "DEBO Operator",
      organization: "Tolani Corp",
      role: "Governed AI workstation owner",
      contact: "operator@debo.ai",
    },
  };
}

export function getSection<T extends keyof DashboardData>(
  data: DashboardData,
  section: T,
): DashboardData[T] {
  return data[section];
}
