# NATT Offline Vendoring

DevBot can package its local NATT and offensive-ops source for disconnected, authorized use.

## Position

Offline vendoring is beneficial for this task when the goal is:

- continuity during disconnected field/lab work
- reproducible review of NATT source, docs, profiles, and ROE controls
- portable WSL/Linux operator environments on Windows
- reduced dependency on remote package registries during incident or travel work

It is not a reason to bulk-import exploit repositories. Third-party security tooling must be pinned, license-reviewed, and approved before it enters an offline bundle.

## Local Bundle

Generate the local NATT bundle:

```bash
npm run natt:offline:vendor
```

Validate the hashes:

```bash
npm run natt:offline:check
```

The generated bundle lives in `vendor/natt-offline/` and includes:

- `.natt` roadmap, profile, and cron sources
- `mcp-natt` MCP server and tactical dashboard source
- offensive profile runner code in `packages/mcp/src/offensive-ops`
- DevBot NATT agents, Unchained ROE/session controls, pentest helpers, safety guardrails, and relevant tests

The bundle excludes secrets, mission memory, logs, `node_modules`, build outputs, and caches.

## External Mirror Step

Full offline implementations use a separate manifest and policy gate:

```bash
npm run natt:mirror:sbom
npm run natt:mirror:check
```

Mirror metadata lives in:

- `docs/offline-mirrors/external-mirrors.json`
- `docs/offline-mirrors/ROE_POLICY.md`

Generated review artifacts live in:

- `vendor/natt-external-mirrors/sbom.json`
- `vendor/natt-external-mirrors/checksums.sha256`

Do not add a third-party artifact path until the entry has a pinned version, license-review status, ROE requirement, and SHA-256 checksum.

## Tooling Assessment

### vendorpull

`sourcemeta/vendorpull` is useful for pinned git-source vendoring because it manages a `vendor` directory from a simple dependency file and supports masks/patches.

Use it for:

- small git-only dependencies that are not cleanly covered by npm/pnpm
- datasets, scripts, or docs that need exact commit pinning
- POSIX/WSL environments where a shell + git workflow is acceptable

Hold before adopting because the public page shows mixed license metadata. Treat it as evaluate-only until legal review confirms the license terms for embedding it in DevBot.

### WSL

WSL is beneficial for DEBO/DevBot ops on Windows because it gives operators a Linux runtime without a separate VM or dual boot. Use WSL 2 for POSIX-only vendoring tools, Linux security tooling, and offline package mirrors.

Recommended baseline:

```powershell
wsl --install
wsl --list --online
wsl --install -d Debian
```

Use Kali only for explicitly authorized lab environments. Keep offensive tooling and target data inside isolated WSL distributions or removable encrypted storage.

### Other Offline Assets

- `pnpm fetch` / npm cache export for JavaScript dependencies.
- `docker save` / `docker load` for pinned container images.
- apt package mirrors for WSL/Debian/Kali packages.
- SBOMs and checksums beside every archived package, image, and repo mirror.
- in-toto/SLSA-style attestations for bundle generation and release handoff.

## Guardrails

- Default to dry-run profiles.
- Require written authorization and ROE for active operations.
- Do not commit operator memory, scan outputs, credentials, private target lists, or customer data.
- Keep third-party mirrors outside this repo unless they are small, licensed, and explicitly approved.
- Rebuild the bundle after NATT source changes and review the manifest diff.
