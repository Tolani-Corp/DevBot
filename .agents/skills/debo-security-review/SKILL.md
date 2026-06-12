---
name: debo-security-review
description: Review high-value DevBot/DEBO changes for secrets, authorization, unsafe shell usage, webhook trust, MCP exposure, NATT ROE, dependency risk, and data leakage.
---

## Review Focus

Prioritize security findings over style. Look first for:

- committed secrets or secret-like values
- command injection, path traversal, unsafe shell interpolation, or broad filesystem access
- missing webhook signature checks or fail-open auth paths
- MCP tools that expose sensitive resources or mutate state without approval
- NATT/security features that skip authorization, scope, or rules of engagement
- logs, reports, screenshots, or generated artifacts that leak private data
- dependency, Docker, or CI changes that expand blast radius

## Workflow

1. Inspect the diff and identify high-risk files.
2. Run focused checks when useful: `npm run check`, targeted tests, secret scan, dependency audit, or relevant Zed tasks.
3. Report findings first, ordered by severity, with file references.
4. Include false-positive notes only when they prevent wasted follow-up.
5. Keep recommendations actionable and scoped to the current change.

## Default Commands

```bash
npm run check
npm test
npm exec -- tsx scripts/pentest-demo.ts . secret-scan
npm audit --omit=dev
```
