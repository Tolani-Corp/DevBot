export interface GovernanceProofStage {
  key: "architects" | "deploys" | "evolves";
  promise: string;
  currentEvidence: string[];
  requiredNextProof: string[];
  humanApprovalCheckpoints: string[];
}

export interface GovernanceProofOverview {
  productPosition: string;
  proofStatus: "scaffolded" | "pilot" | "production-ready";
  stages: GovernanceProofStage[];
  demoPath: {
    generate: string;
    validate: string;
    evidenceFile: string;
  };
  recommendedIntegrations: Array<{
    name: string;
    use: string;
    mode: "integrate" | "scaffold" | "evaluate";
  }>;
}

export function getGovernanceProofOverview(): GovernanceProofOverview {
  return {
    productPosition:
      "DevBot is a governed engineering teammate. The autonomy promise is proven through replayable architecture, delivery, and evolution evidence.",
    proofStatus: "scaffolded",
    stages: [
      {
        key: "architects",
        promise: "Architects systems with reviewable planning evidence.",
        currentEvidence: [
          "docs/enhancements/TEMPLATE.md",
          "docs/adr/0000-template.md",
          "docs/design-reviews/TEMPLATE.md",
        ],
        requiredNextProof: [
          "Create one real enhancement record for a production feature.",
          "Create a linked ADR for the architecture decision.",
          "Record design review decision and owner sign-off.",
        ],
        humanApprovalCheckpoints: [
          "Architecture owner",
          "Security owner",
          "Operations owner",
        ],
      },
      {
        key: "deploys",
        promise:
          "Deploys systems through a replayable request -> code -> tests -> PR -> deploy path.",
        currentEvidence: [
          "docs/autonomous-delivery/README.md",
          "scripts/devbot-governance.mjs",
          ".github/workflows/deploy.yml",
        ],
        requiredNextProof: [
          "Attach PR URL and CI run URL to delivery evidence.",
          "Attach artifact digest or attestation subject.",
          "Record staging deployment approval.",
        ],
        humanApprovalCheckpoints: [
          "PR reviewer",
          "Deployment approver",
          "Release owner",
        ],
      },
      {
        key: "evolves",
        promise:
          "Evolves systems with evals, CI evidence, rollback proof, and release governance.",
        currentEvidence: [
          "docs/evals/README.md",
          "docs/release-governance.md",
          "src/services/self-updater.ts",
        ],
        requiredNextProof: [
          "Add behavior eval fixtures for agent regression checks.",
          "Store rollback proof for staging deploys.",
          "Record post-release reflection into journey memory.",
        ],
        humanApprovalCheckpoints: [
          "Eval owner",
          "Rollback owner",
          "Release captain",
        ],
      },
    ],
    demoPath: {
      generate: "npm run governance:evidence",
      validate: "npm run governance:check",
      evidenceFile: ".devbot/evidence/demo-delivery-evidence.json",
    },
    recommendedIntegrations: [
      {
        name: "Kubernetes KEP/PRR pattern",
        use: "Enhancement and production-readiness records.",
        mode: "scaffold",
      },
      {
        name: "ADR lifecycle",
        use: "Numbered architecture decisions with superseding history.",
        mode: "scaffold",
      },
      {
        name: "OPA",
        use: "Policy-as-code over evidence manifests.",
        mode: "evaluate",
      },
      {
        name: "SLSA / in-toto",
        use: "Build, approval, and deployment provenance.",
        mode: "integrate",
      },
      {
        name: "promptfoo / Langfuse",
        use: "Agent behavior evals, traces, and regression visibility.",
        mode: "evaluate",
      },
      {
        name: "release-please",
        use: "Release PRs, changelog, and version governance.",
        mode: "integrate",
      },
    ],
  };
}
