# Offline Mirror ROE Policy

Offline mirrors support authorized DevBot/DEBO/NATT operations only.

## Required Before Use

- Written authorization exists for the engagement or lab.
- Target scope is explicit and current.
- Rules of Engagement name allowed tools, time windows, data handling, and stop conditions.
- Operator identity and approval are recorded.
- Third-party tool license review is approved.
- Artifact checksum matches the reviewed manifest.

## Prohibited In Git

- Credentials, API keys, tokens, cookies, private keys, or password vaults.
- Mission memory, target lists, scan logs, screenshots with customer data, or exploit outputs.
- WSL distribution exports, Docker image archives, apt mirrors, npm caches, or other large binary mirrors unless a separate release process approves them.

## Default Controls

- Profiles remain disabled by default.
- Live operations require a human approval checkpoint.
- Active mode requires authorization proof.
- Mirrored tools must be pinned by version, source URL, license, artifact path, and SHA-256 checksum.
- SBOM and checksums must be generated before handoff.

## Stop Conditions

Stop and quarantine the mirror if:

- license review is missing or rejected
- checksum validation fails
- an artifact contains secrets or target/customer data
- ROE scope is missing or expired
- a tool version differs from the approved manifest
