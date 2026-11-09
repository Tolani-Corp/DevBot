# DevBot — Read-only GitHub App pilot

**State: PENDING INSTALLATION.** This PR supplies policy, tests and a manual canary. It does not create a GitHub App, set organization secrets, grant App access, or approve agent writes.

## Narrow pilot

- Organization-owned **private** app: **Tolani Development Automation**
- Installation: **Only select repositories → DevBot** within `Tolani-Corp`
- Registration repository permissions: **Contents: Read**, **Metadata: Read** (mandatory)
- Initial App token: **Contents: Read** and repository list restricted to **DevBot**
- GitHub Actions own token: **Contents: Read**
- Not requested: Pull requests write, Contents write, Actions, Administration, Secrets, Deployments, organization permissions
- No app-token execution on `pull_request`, `pull_request_target` or external contribution. Token canary requires explicit `workflow_dispatch` against trusted `main` and confirmation `VERIFY_READ_ONLY_APP`.

## Required organization-owner actions

1. Register the private app from `Tolani-Corp` organization **Settings → Developer settings → GitHub Apps** (or with an authorized App manager). Do not register the app on an individual's personal account.
2. Install **only on DevBot**. Verify app permissions against the list above.
3. In **DevBot → Settings → Secrets and variables → Actions** set `TOLANI_GITHUB_APP_CLIENT_ID` as a **variable** and the generated app private key as `TOLANI_GITHUB_APP_PRIVATE_KEY` as a protected **secret**. Prefer an organization secret with repository access restricted to DevBot. Do not put secrets in source, PR comments, issue comments or assistant messages.
4. Review and merge this PR only after code review and successful policy-only tests; do not force-merge unrelated CI failures.
5. Run **Actions → Tolani GitHub App Read-Only Canary → Run workflow**, on branch **main**, with `confirmation=VERIFY_READ_ONLY_APP`.
6. The canary uses GitHub-owned, immutable SHA-pinned `actions/create-github-app-token` and asks GitHub for a token limited to one repo and `contents:read`. The API confirms exactly one accessible installation repo is `Tolani-Corp/DevBot`; no token is printed. The action revokes its token automatically when the job completes.
7. Retain the run URL, immutable SHA, App installation receipt, and a separate human approval outside the repository (no credential values). Do not mark this pilot activated without that evidence.

## Future scope (not implemented)

A developer or agent capable of proposing PR changes should use a **separately reviewed GitHub App capability**. It may require Contents: Write and Pull requests: Write on individually approved repositories, but never Workflow/Secrets/Administration/production deployment by default. A PR writer cannot approve or merge its own work. Cross-repository and production authorities require distinct grants, tests and human controls.

## Limits

- The GitHub connector used to author this PR does not expose organization GitHub App registration, Actions secret updates, or enterprise SSH CA administration. These require an authorized organization owner.
- **CODEOWNERS is advisory until the repository's ruleset actually requires code owner review.**
- App credentials do not fix GitHub Actions runner availability, failing tests or release acceptance.
- SSH developer keys are a separate human credential and must never be used as the App private key. See the TolaniCorp-HQ authentication policy.
