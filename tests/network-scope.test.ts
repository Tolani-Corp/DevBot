import { describe, expect, it } from "vitest";

import { evaluateTargetScope, isValidCidr } from "../src/security/network-scope.js";

const baseScope = {
  inScope: [] as string[],
  outOfScope: [] as string[],
  includeSubdomains: false,
};

describe("network scope parser", () => {
  it("matches IPv4 CIDR boundaries exactly", () => {
    const scope = { ...baseScope, inScope: ["192.168.10.0/24"] };
    expect(evaluateTargetScope("192.168.10.1", scope).allowed).toBe(true);
    expect(evaluateTargetScope("192.168.10.255", scope).allowed).toBe(true);
    expect(evaluateTargetScope("192.168.11.1", scope).allowed).toBe(false);
  });

  it("does not confuse adjacent IPv4 prefixes", () => {
    const scope = { ...baseScope, inScope: ["10.0.1.0/25"] };
    expect(evaluateTargetScope("10.0.1.127", scope).allowed).toBe(true);
    expect(evaluateTargetScope("10.0.1.128", scope).allowed).toBe(false);
  });

  it("matches compressed IPv6 CIDR", () => {
    const scope = { ...baseScope, inScope: ["2001:db8:abcd::/48"] };
    expect(evaluateTargetScope("2001:db8:abcd::1", scope).allowed).toBe(true);
    expect(evaluateTargetScope("2001:db8:abce::1", scope).allowed).toBe(false);
  });

  it("supports IPv4-mapped IPv6 notation", () => {
    const scope = { ...baseScope, inScope: ["::ffff:192.0.2.0/120"] };
    expect(evaluateTargetScope("::ffff:192.0.2.25", scope).allowed).toBe(true);
    expect(evaluateTargetScope("::ffff:192.0.3.25", scope).allowed).toBe(false);
  });

  it("gives explicit exclusions precedence", () => {
    const scope = {
      ...baseScope,
      inScope: ["10.20.0.0/16"],
      outOfScope: ["10.20.8.0/24"],
    };
    expect(evaluateTargetScope("10.20.7.10", scope).allowed).toBe(true);
    expect(evaluateTargetScope("10.20.8.10", scope).allowed).toBe(false);
  });

  it("requires explicit wildcard or subdomain authorization", () => {
    expect(evaluateTargetScope("api.example.com", { ...baseScope, inScope: ["example.com"] }).allowed).toBe(false);
    expect(
      evaluateTargetScope("api.example.com", {
        ...baseScope,
        inScope: ["example.com"],
        includeSubdomains: true,
      }).allowed,
    ).toBe(true);
    expect(evaluateTargetScope("example.com", { ...baseScope, inScope: ["*.example.com"] }).allowed).toBe(false);
  });

  it("enforces URL port and path scope", () => {
    const scope = {
      ...baseScope,
      inScope: ["https://api.example.com/v1"],
      allowedPorts: [443],
      allowedPaths: ["/v1/accounts"],
    };
    expect(evaluateTargetScope("https://api.example.com/v1/accounts/123", scope).allowed).toBe(true);
    expect(evaluateTargetScope("https://api.example.com/v1/admin", scope).allowed).toBe(false);
    expect(evaluateTargetScope("http://api.example.com/v1/accounts/123", scope).allowed).toBe(false);
  });

  it("rejects malformed CIDRs and IPv6 zone identifiers", () => {
    expect(isValidCidr("192.168.1.0/33")).toBe(false);
    expect(isValidCidr("2001:db8::/129")).toBe(false);
    expect(evaluateTargetScope("fe80::1%eth0", { ...baseScope, inScope: ["fe80::/10"] }).allowed).toBe(false);
  });
});
