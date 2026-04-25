# DevBot Azure Internal Links And Local Ops

This guide adds internal operations skills and local tools for managing the BettorsACE production Azure stack.

## Included Tool

- Script: `scripts/azure-resource-links.mjs`

## Commands

- `pnpm ops:azure:links`
  - Prints the canonical Azure portal links for internal operations.
- `pnpm ops:azure:social:slack`
  - Prints a summarized Slack-ready link block.
- `pnpm ops:azure:social:discord`
  - Prints a summarized Discord-ready link block.
- `pnpm ops:azure:open`
  - Opens all production portal resources in your default browser.
- `pnpm ops:azure:check`
  - Runs local health checks against App Service and APIM.
- `pnpm ops:azure:policy`
  - Prints the active social output IP/OPSEC policy.

## Social Output IP/OPSEC Policy

- Classification: internal-only
- Output is summarized before social sharing.
- Output is blocked if it contains credential/token/secret patterns.
- Output is blocked if it contains private IPv4 addresses.
- Output is blocked if it includes non-allowlisted URL hosts.
- Strict channel safety mode is enabled by default and blocks non-allowlisted channels.

## Strict Channel Safety Mode

Configure strict allowlists and targets:

```env
SOCIAL_ALLOWED_SLACK_CHANNEL_IDS=C0123456789,C0222222222
SOCIAL_ALLOWED_DISCORD_CHANNEL_IDS=123456789012345678,223456789012345678
SOCIAL_TARGET_SLACK_CHANNEL_ID=C0123456789
SOCIAL_TARGET_DISCORD_CHANNEL_ID=123456789012345678
SOCIAL_STRICT_CHANNEL_MODE=true
```

Command examples:

```bash
pnpm ops:azure:social:slack -- --channel-id C0123456789
pnpm ops:azure:social:discord -- --channel-id 123456789012345678
```

Any channel ID not on the configured allowlist is blocked by default.

## Recommended Slack And Discord Channel Setup

1. Create dedicated internal-only channels for infra ops updates.
2. Slack recommendation: `#ops-azure-internal` for production link sharing.
3. Slack recommendation: `#ops-incidents-private` for escalations and incident timelines.
4. Discord recommendation: `infra-ops-internal` text channel for routine ops summaries.
5. Discord recommendation: `incident-war-room` text channel with restricted role access.
6. Add only those channel IDs to allowlists and keep all public/community channels excluded.
7. Restrict posting rights to operator roles and bots used for controlled updates.

## Optional Environment Variable

```env
APIM_SUBSCRIPTION_KEY=<your_apim_subscription_key>
```

When set, `ops:azure:check` performs authenticated APIM health validation against `/mcp/health`.

## Resource Coverage

- App Service: `app-7pqmmqvx5stgi`
- App Service Plan: `plan-7pqmmqvx5stgi`
- API Management: `apim-7pqmmqvx5stgi`
- PostgreSQL Flexible Server: `psql-7pqmmqvx5stgi`
- Key Vault: `kv-7pqmmqvx5stgi`

## Internal Workflow

1. Run `pnpm ops:azure:links` and share output in your internal channel.
2. Run `pnpm ops:azure:social:slack` or `pnpm ops:azure:social:discord` for clean handoff messages.
3. Run `pnpm ops:azure:check` before and after deployments.
4. Run `pnpm ops:azure:open` when an operator needs direct blade access.
