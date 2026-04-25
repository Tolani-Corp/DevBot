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

## License

- Commercial use is governed by [LICENSE.md](./LICENSE.md)
- Authorized Tolani Labs education use is covered by [EDUCATION-LICENSE.md](./EDUCATION-LICENSE.md)
