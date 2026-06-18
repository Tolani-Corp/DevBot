# DevBot Microsoft Teams SSO Bot

DevBot can be exposed in Microsoft Teams through the service in `services/teams-sso-bot`.
The implementation is aligned to the pinned Microsoft sample `OfficeDev/microsoft-365-agents-toolkit-samples/tree/v3.3.0/bot-sso`.

The Teams service is intentionally separate from the core DevBot runtime:

- Teams SSO identifies the requester through Microsoft Graph.
- DevBot task creation still goes through `/api/tasks`.
- The existing `API_AUTH_TOKEN` boundary remains required.
- Task creation remains disabled until `DEVBOT_TEAMS_ALLOW_TASKS=true`.

## Verify

```bash
npm --prefix services/teams-sso-bot install
npm --prefix services/teams-sso-bot run build
npm --prefix services/teams-sso-bot run smoke
```

## Microsoft 365 Prerequisites

Before tenant preview or production rollout, confirm:

- Development tenant is either a Microsoft 365 Developer Program sandbox, an eligible Microsoft 365/Office 365 production tenant, or a Microsoft 365 subscription used for limited Copilot Chat agent testing.
- Teams custom app upload/sideloading is enabled by an admin in Teams admin center setup policies.
- Microsoft 365 Copilot license or Copilot Studio pay-as-you-go billing is available only if future DevBot agents need enhanced capabilities such as SharePoint, Microsoft 365 connectors, or other organizational-data grounding.
- Copilot developer mode testing requires a licensed Microsoft 365 Copilot experience and is enabled in Copilot Chat with `-developer on`.
- Production tenants can impose admin restrictions on sideloading and app permissions, so tenant policy review is a release gate.

## Commands

- `help`
- `show`
- `status`
- `task <request>`
- `task <request> repo:<name>`
- `logout`

## Production Notes

- Restrict `TEAMS_ALLOWED_TENANT_IDS` before rollout.
- Set `DEVBOT_API_TOKEN` in the Teams service to the core DevBot runtime's `API_AUTH_TOKEN`.
- Keep `DEVBOT_API_TOKEN` separate from bot registration credentials.
- Use Microsoft Entra app registration and Azure Bot Service SSO connection settings for Graph OBO.
- Keep live task creation under operator review until the Teams app has passed tenant, security, and privacy review.

## References

- Microsoft sample: <https://learn.microsoft.com/en-us/samples/officedev/teamsfx-samples/officedev-teamsfx-samples-bot-bot-sso/>
- Pinned sample source: <https://github.com/OfficeDev/microsoft-365-agents-toolkit-samples/tree/v3.3.0/bot-sso>
- TeamsFx SDK deprecation guidance: <https://learn.microsoft.com/en-us/microsoftteams/platform/toolkit/teamsfx-sdk>
- Microsoft 365 Copilot extensibility prerequisites: <https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/prerequisites#prerequisites>
