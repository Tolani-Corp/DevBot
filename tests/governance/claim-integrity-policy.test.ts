import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readRepoFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("claim integrity policy", () => {
  const policy = readRepoFile("docs/claim-integrity-policy.md");
  const governanceScript = readRepoFile("scripts/devbot-governance.mjs");
  const commercialReadinessScript = readRepoFile(
    "scripts/commercial-readiness.mjs",
  );
  const releaseGovernance = readRepoFile("docs/release-governance.md");
  const deliveryGovernance = readRepoFile("src/services/delivery-governance.ts");

  it("keeps strict handling for high-risk domains and lightweight narration for routine work", () => {
    expect(policy).toContain(
      "strict where a false claim can create operational, security, legal, customer, cost, or release risk",
    );
    expect(policy).toContain(
      "stays lightweight for ordinary coding narration",
    );

    for (const domain of [
      "security posture",
      "release readiness",
      "customer-impacting behavior",
      "cost",
      "external systems",
    ]) {
      expect(policy).toContain(domain);
    }
  });

  it("requires labels for evidence quality and uncertainty", () => {
    for (const label of [
      "Observed fact",
      "Inference",
      "Assumption",
      "Unverified",
    ]) {
      expect(policy).toContain(label);
    }

    expect(policy).toContain("Do not claim that something is secure");
    expect(policy).toContain("production-ready");
  });

  it("wires claim integrity into governance evidence and policy checks", () => {
    expect(governanceScript).toContain("claimIntegrity");
    expect(governanceScript).toContain("docs/claim-integrity-policy.md");
    expect(governanceScript).toContain(
      "claimIntegrity.strictDomains must include ${domain}",
    );
    expect(governanceScript).toContain(
      "claimIntegrity.requirements must require evidence for high-risk claims",
    );
  });

  it("includes claim integrity in commercial readiness and release governance", () => {
    expect(commercialReadinessScript).toContain(
      "docs/claim-integrity-policy.md",
    );
    expect(releaseGovernance).toContain("Claim Integrity Policy");
    expect(releaseGovernance).toContain(
      "observed facts, inferences, assumptions, and unverified strict-domain claims",
    );
  });

  it("exposes claim integrity in the operator governance proof overview", () => {
    expect(deliveryGovernance).toContain('key: "states"');
    expect(deliveryGovernance).toContain(
      "States high-risk system truth only when evidence supports the claim.",
    );
    expect(deliveryGovernance).toContain("docs/claim-integrity-policy.md");
  });
});
