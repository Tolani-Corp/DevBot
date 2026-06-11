# DevBot

> Governed engineering teammate for request-to-PR execution, review discipline, and a clean expansion path into DEBO.

## Product Position

DevBot is the public execution wedge in the Tolani portfolio.

It helps teams move from a scoped request to a reviewed code change without losing:

- journey context
- reviewer corrections
- approval posture
- operator visibility

DevBot should be positioned as a teammate for engineering teams, not as a vague autonomous replacement for the team.

## What It Does

- responds to engineering requests from chat and connected workflows
- scopes work into reviewable journeys
- executes code changes and prepares pull requests
- keeps approval, memory, and trust state visible
- creates a commercial handoff into `DEBO` when the buyer needs broader workstation and governance controls

## Product Relationship

- `DevBot` = execution teammate and commercial wedge
- `DEBO` = workstation and governance layer above execution
- `Tolani Labs` = education and management environment that reuses the same journey architecture

## Quick Start

```bash
pnpm install
pnpm dev
```

## Internal Azure Ops Skills And Tools

DevBot now includes internal operations tooling for the BettorsACE production Azure stack.

- Local links list: `pnpm ops:azure:links`
- Slack-ready summarized social links: `pnpm ops:azure:social:slack`
- Discord-ready summarized social links: `pnpm ops:azure:social:discord`
- Open all Azure resource blades locally: `pnpm ops:azure:open`
- Local health checks (App Service + APIM): `pnpm ops:azure:check`
- Show social IP/OPSEC policy: `pnpm ops:azure:policy`

Social output policy is enforced before output is printed:

- Internal-only classification for social sharing
- Blocks credential/token-like strings
- Blocks private IPv4 ranges
- Blocks non-allowlisted URL hosts

Strict channel safety mode is enabled by default and blocks all non-allowlisted targets.

Set allowlists and channel targets:

```env
SOCIAL_ALLOWED_SLACK_CHANNEL_IDS=C0123456789
SOCIAL_ALLOWED_DISCORD_CHANNEL_IDS=123456789012345678
SOCIAL_TARGET_SLACK_CHANNEL_ID=C0123456789
SOCIAL_TARGET_DISCORD_CHANNEL_ID=123456789012345678
SOCIAL_STRICT_CHANNEL_MODE=true
```

Run with an explicit channel ID override when needed:

```bash
pnpm ops:azure:social:slack -- --channel-id C0123456789
pnpm ops:azure:social:discord -- --channel-id 123456789012345678
```

Optional environment variable for authenticated APIM checks:

```env
APIM_SUBSCRIPTION_KEY=<your_apim_subscription_key>
```

See [docs/AZURE_INTERNAL_LINKS_AND_LOCAL_OPS.md](./docs/AZURE_INTERNAL_LINKS_AND_LOCAL_OPS.md) for full usage.

## Key Business Logic

- sell `request to reviewed PR`
- emphasize `lower review drag`
- keep `memory conservative by default`
- preserve `human approval on higher-risk changes`
- use `DEBO` as the upmarket workstation when governance needs outgrow a single teammate surface

## Tolani Ecosystem Web3 Guidance

DevBot agents should use the Tolani DAO NFT program guidance when handling ecosystem credentials, certificates, work orders, deliverables, steward badges, DAO evidence packets, or minting rails.

- Canonical ecosystem issuance should be controlled by `Tolani DAO` through Safe, timelock, or DAO-approved roles.
- `Tolani Labs` may originate evidence, validation, education workflows, and metadata tooling, but should not be the durable authority for DAO credentials or governance-linked issuance unless DAO-approved.
- A dynamic pre-mint rail may prepare `draft`, `eligible`, and `approved` records before all production components are settled.
- On-chain mint execution must stay blocked until issuer/approver roles, metadata storage, evidence storage, duplicate-prevention checks, contract configuration, hashes, and recipient wallet checks pass.

Detailed reference: [docs/web3-knowledge.md](./docs/web3-knowledge.md).

## Tolani Global Hiring Guidance

DevBot agents should use the global hiring operations guidance when handling Tolani workforce planning, recruiting, role requests, onboarding, contractor paths, EOR paths, or hiring council workflows.

- Source-truth ID: `tolani.ecosystem.global_workforce.v1`.
- Primary source lives in `D:\Projects\tolani-foundation-page\docs\GLOBAL_HIRING_OPERATIONS_PLAYBOOK.md` and `D:\Projects\tolani-foundation-page\client\src\data\workforceOps.ts`.
- Multi-country employment defaults to EOR unless Legal/EOR review approves another path.
- Humans must approve classification, compensation, interview outcome, offer, sensitive access, and final hire/no-hire.
- AI may draft, summarize, compare against approved scorecards, flag missing approvals, and prepare onboarding tasks.

Detailed reference: [docs/global-hiring-ops.md](./docs/global-hiring-ops.md).

## NATT Ethical Security Roadmap

NATT's ethical hacking roadmap is available as shared human and agent context.

- Canonical machine-readable source: `.natt/resources/ethical-hacking-roadmap.json`
- Operator manual: [docs/natt-ethical-hacking-roadmap.md](./docs/natt-ethical-hacking-roadmap.md)
- Agent skill catalog: `natt-skills-catalog.json`
- MCP tools: `get_ethical_roadmap`, `get_roadmap_stage`, `recommend_roadmap_path`
- MCP resources: `natt://ethical-roadmap`, `natt://ethical-roadmap-catalog`

The roadmap covers TCP/IP, DNS, HTTP/HTTPS, Linux/Windows/macOS, networking, Python/Bash/JavaScript/PHP/SQL, Nmap, Burp Suite, Metasploit, John the Ripper, Wireshark, VirtualBox/VMware, Kali/Parrot, TryHackMe, Hack The Box, and OverTheWire. All use is bounded to authorized labs, written ROE, and non-destructive-first workflows.

## License

- Commercial use is governed by [LICENSE.md](./LICENSE.md)
- Authorized Tolani Labs education use is covered by [EDUCATION-LICENSE.md](./EDUCATION-LICENSE.md)
