# NATT Capability Cryptographic Verification v1

## Objective

Bind Tolani Labs capability-broker requests to DevBot/NATT mission authorization and capability-grant artifacts using asymmetric PS256 signatures, canonical JSON digests, versioned trusted keys, bounded validity windows, and replay protection.

## Trust boundary

DevBot/NATT is the artifact issuer. Tolani Labs is the intended relying party through the private capability broker.

Every signed artifact must declare:

- issuer: `devbot-natt`
- audience: `tolani-capability-broker`
- PS256 algorithm
- trusted, versioned key ID
- canonical SHA-256 claims digest
- mission and target bindings
- issue, activation, and expiration timestamps
- a unique nonce

Production verification uses Azure Key Vault verification through `verifyManagedPayload`. Local test verification is disabled in production and requires an explicitly configured public key file.

## Artifact types

### Mission authorization

The mission authorization establishes the approved environment, exact normalized target list, scope digest, mission validity window, and maximum capability-grant lifetime.

### Capability grant

The capability grant binds one mission to one capability version, adapter, exact broker request digest, target list, runtime ceiling, and event ceiling. It also embeds the verified mission-claims digest so the grant cannot be detached from its mission.

## Exact broker request binding

The broker request digest covers:

- request ID and nonce
- mission ID
- grant ID
- capability ID and version
- adapter ID
- environment class
- normalized target identifiers
- requested runtime
- requested event count

Changing any field invalidates the signed grant for that request.

## Replay control

The verifier emits a replay key from the grant artifact ID, grant nonce, and broker request nonce. The caller must atomically claim that key in durable state before dispatch. The included in-memory guard exists only for deterministic tests and isolated local validation.

## Fail-closed verification

Verification denies when any of these conditions occur:

- unsupported schema, issuer, audience, or algorithm
- untrusted key ID
- invalid signature or canonical digest
- invalid target digest
- future, inactive, expired, or overlong validity window
- mission, environment, target, grant, capability, version, or adapter drift
- changed broker-request digest
- runtime or event budget excess
- replay claim failure

No adapter dispatch should occur unless the final decision is `verified: true` and the replay claim succeeds.

## Required production configuration

```text
NATT_TRUSTED_MISSION_KEY_IDS=https://<vault>.vault.azure.net/keys/<name>/<version>
NATT_TRUSTED_CAPABILITY_GRANT_KEY_IDS=https://<vault>.vault.azure.net/keys/<name>/<version>
```

The NATT runtime also requires one supported Azure managed-identity path for Key Vault verification. Static Key Vault access tokens remain prohibited in production.

## Validation

```bash
pnpm natt:signatures:check
pnpm exec vitest run tests/natt-capability-signatures.test.ts
pnpm check
```

## Remaining activation gates

- durable atomic replay store
- production key rotation runbook
- Tolani Labs private broker mutual authentication
- isolated-host integration test using non-production keys
- independent security review
- emergency-stop and cleanup evidence
