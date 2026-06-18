# DevBot Teams SSO Bot

This service exposes DevBot inside Microsoft Teams with Microsoft SSO.

It follows the pinned Microsoft 365 Agents SDK sample shape from `OfficeDev/microsoft-365-agents-toolkit-samples` tag `v3.3.0`: Teams handles SSO, Microsoft Graph identifies the requester, and DevBot keeps execution inside the existing HTTP API and approval path.

## Commands

- `help` shows the command card.
- `show` reads the signed-in user's Microsoft Graph profile.
- `status` checks the local DevBot `/health` endpoint.
- `task <request>` creates a governed DevBot task.
- `task <request> repo:<name>` creates a task for a specific repository.
- `logout` clears the Teams SSO session.

Task creation is disabled until `DEVBOT_TEAMS_ALLOW_TASKS=true` is set.

## Local Setup

Microsoft's Copilot extensibility prerequisites split setup into two layers:

- Teams bot SSO and basic Agents Toolkit development require a Microsoft 365 tenant where custom app upload/sideloading is enabled by an admin.
- Copilot agents grounded on organizational data require either Microsoft 365 Copilot licensing or Copilot Studio pay-as-you-go billing. This DevBot Teams SSO bot does not enable organizational-data grounding by itself.
- Copilot developer mode is only available inside the licensed Microsoft 365 Copilot experience.

```bash
npm --prefix services/teams-sso-bot install
npm --prefix services/teams-sso-bot run build
npm --prefix services/teams-sso-bot run smoke
npm --prefix services/teams-sso-bot run dev
```

Create a tunnel for Teams preview:

```bash
devtunnel host -p 3978 --protocol http --allow-anonymous
```

Set the tunnel hostname as `BOT_DOMAIN` and use the public endpoint for `BOT_ENDPOINT`:

```env
BOT_DOMAIN=sample-id-3978.devtunnels.ms
BOT_ENDPOINT=https://sample-id-3978.devtunnels.ms
```

Use the public endpoint for the Azure Bot Messaging endpoint:

```text
https://<BOT_DOMAIN>/api/messages
```

With Microsoft 365 Agents Toolkit CLI, the pinned sample flow is:

```bash
atk auth login azure
atk provision --env local
atk deploy --env local
atk preview --env local
```

## Environment

Copy `.env.example` and fill in:

- `BOT_ID`
- `BOT_PASSWORD`
- `BOT_SSO_CONNECTION_NAME`
- `BOT_DOMAIN`
- `BOT_ENDPOINT`
- `DEVBOT_API_BASE_URL`
- `DEVBOT_API_TOKEN`
- `DEVBOT_TEAMS_ALLOW_TASKS`

Optional hardening:

- `TEAMS_ALLOWED_TENANT_IDS` restricts the bot to approved Microsoft Entra tenants.
- `DEVBOT_DEFAULT_REPOSITORY` provides a fallback repository for task creation.

## App Package

The Teams manifest template lives in `appPackage/manifest.template.json`.

Before packaging, place Teams icons beside the manifest:

- `color.png`: 192 x 192 color icon.
- `outline.png`: 32 x 32 transparent outline icon.

The root smoke script checks the manifest shape but does not deploy or provision Azure resources.

Pinned reference: https://github.com/OfficeDev/microsoft-365-agents-toolkit-samples/tree/v3.3.0/bot-sso
Prerequisites reference: https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/prerequisites#prerequisites
