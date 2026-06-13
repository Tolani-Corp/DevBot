# Autonomous Delivery Proof Path

This is the proof path DevBot must satisfy before the marketing promise can move from vision to current capability.

## Architects Systems

Required evidence:

- Enhancement record with goals, non-goals, architecture evidence, risks, test plan, rollout, rollback, and graduation criteria.
- ADR for every architecture-changing or high-risk delivery.
- Design review packet with explicit human approval checkpoints.
- Diagram or architecture-as-code reference for changed boundaries and data flow.

## Deploys Systems

Required evidence:

- Request ID and operator intent.
- Plan hash and changed-file list.
- Test commands and results.
- PR URL or PR-ready branch/patch reference.
- Deployment environment, workflow URL, artifact digest or build subject, and approver.
- Rollback procedure and proof artifact.

## Evolves Systems

Required evidence:

- Agent eval suite result.
- CI workflow result.
- Release governance decision.
- Rollback proof from staging or a documented dry run.
- Post-release reflection with what changed in memory/policy/evals.

## Local Demo

Generate an evidence manifest:

```bash
pnpm run governance:evidence
```

Validate it:

```bash
pnpm run governance:check
```

The generated file lives at `.devbot/evidence/demo-delivery-evidence.json` and is intentionally safe: it records the proof shape without deploying anything.
