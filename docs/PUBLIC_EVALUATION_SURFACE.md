# DevBot Public Evaluation Surface v1

## Purpose

DevBot is the Tolani portfolio's public execution wedge for governed request-to-reviewed-PR engineering evaluation. The public surface must let an engineering prospect understand and start an evaluation without exposing DevBot runtime APIs, credentials, privileged tools, or production authority.

## Authority model

`config/public-product-context.json` is the public business-truth contract. The public surface may render only claims consistent with that contract.

- Public status: `G2`
- Commercial authority: local with Tolani portfolio governance
- Offer: governed request-to-reviewed-PR evaluation
- Public runtime authority: none
- Production-write authority: none
- Human qualification: required
- Canonical public domain: not yet approved

The static surface is therefore deployable but not production-host-authoritative until a canonical domain and hosting route are explicitly approved.

## Conversion path

```text
visitor
  -> public DevBot value proposition
  -> /evaluation/
  -> local structured evaluation brief
  -> Tolani Corp governed public contact
  -> DevBot Product Operations human qualification
  -> approved evaluation setup
  -> bounded request-to-PR execution
  -> reviewed PR / evidence
  -> first-value determination
  -> optional commercial commitment
```

The public page can measure intent and brief preparation. It must not emit `first_value_reached` or `commercial_commitment`; those require downstream evidence.

## Public data boundary

The evaluation brief is intentionally local-only and limited to categorical, non-PII controls. The public page must not collect or transmit:

- names, email addresses, phone numbers or free-form contact details;
- repository URLs or source code;
- API keys, tokens, credentials or secrets;
- customer data;
- production infrastructure details;
- security findings or offensive-security targets.

The browser may copy the structured brief to the clipboard. Human contact data is entered separately into Tolani Corp's governed intake surface.

## Runtime isolation

`public-site/**` must not:

- invoke DevBot HTTP/API endpoints;
- invoke MCP endpoints;
- open WebSocket/EventSource connections;
- send browser telemetry through direct network calls;
- accept runtime credentials;
- grant branch, merge, deployment or production permissions.

Only vendor-neutral `CustomEvent` and optional existing `window.dataLayer` events are emitted.

## Claim boundary

Blocked public claims include:

- fully autonomous engineering guarantees;
- guaranteed bug-free code;
- unreviewed production-write authority;
- guaranteed productivity, cycle-time or cost savings;
- security or production-readiness claims without current evaluation evidence.

The site may explain the intended control model and may describe capabilities already established in the DevBot product contract, while preserving human review and evidence requirements.

## DEBO handoff

DevBot remains the narrow execution wedge. If a qualified prospect needs workstation-level governance, broader organizational controls, or a larger enterprise operating model, Product Operations may route the opportunity to DEBO. The public DevBot surface does not grant DEBO access or imply DEBO production authority.

## Admission gate

Before promotion:

1. `scripts/validate-public-conversion.mjs` passes.
2. `Tolani Marketing Integrity v1` passes on the exact PR head.
3. Existing DevBot CI/governance checks remain green.
4. Hosting/domain authority is separately reviewed before any production deployment.
5. A production release cannot be inferred from a successful static-site build or PR merge.
