import { describe, expect, it } from "vitest";
import { bearerFromNodeAuthorization, EnterpriseWorkloadAuthError, verifyDevBotWorkloadToken } from "../src/security/enterprise-workload-auth";

const encoder = new TextEncoder();
const now = 1_800_000_000;

function b64u(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}
function segment(value: unknown) { return b64u(encoder.encode(JSON.stringify(value))); }

async function fixture() {
  const keys = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", keys.publicKey));
  const raw = Buffer.from(spki).toString("base64");
  const pem = `-----BEGIN PUBLIC KEY-----\n${raw.match(/.{1,64}/g)?.join("\n")}\n-----END PUBLIC KEY-----`;
  return { keys, pem };
}

async function mint(privateKey: CryptoKey, overrides: Record<string, unknown> = {}) {
  const header = segment({ alg: "RS256", typ: "JWT" });
  const payload = segment({
    iss: "https://clerk.test",
    sub: "mch_debo",
    aud: "tolani:devbot:production",
    iat: now - 10,
    nbf: now - 10,
    exp: now + 290,
    organization: "tolani",
    access_class: "tolani-internal",
    service_id: "debo",
    environment: "production",
    scope: "tolani.service.discover devbot.api.invoke",
    ...overrides,
  });
  const input = `${header}.${payload}`;
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, encoder.encode(input)));
  return `${input}.${b64u(signature)}`;
}

const options = (pem: string) => ({
  pemPublicKey: pem,
  expectedIssuer: "https://clerk.test",
  expectedAudience: "tolani:devbot:production",
  expectedEnvironment: "production",
  requiredScope: "devbot.api.invoke",
  allowedServiceIds: ["debo", "taskstaff"],
  nowEpochSeconds: now,
});

async function codeOf(run: Promise<unknown>) {
  try { await run; return "allowed"; }
  catch (error) {
    expect(error).toBeInstanceOf(EnterpriseWorkloadAuthError);
    return (error as EnterpriseWorkloadAuthError).code;
  }
}

describe("DevBot enterprise workload auth", () => {
  it("accepts exact scoped workload", async () => {
    const { keys, pem } = await fixture();
    const principal = await verifyDevBotWorkloadToken(await mint(keys.privateKey), options(pem));
    expect(principal.serviceId).toBe("debo");
  });

  it("requires bearer format", () => {
    expect(() => bearerFromNodeAuthorization(undefined)).toThrow("bearer_token_required");
    expect(bearerFromNodeAuthorization("Bearer abc.def.ghi")).toBe("abc.def.ghi");
  });

  it("denies wrong audience, environment, and missing scope", async () => {
    const { keys, pem } = await fixture();
    expect(await codeOf(verifyDevBotWorkloadToken(await mint(keys.privateKey, { aud: "tolani:other:production" }), options(pem)))).toBe("jwt_audience_invalid");
    expect(await codeOf(verifyDevBotWorkloadToken(await mint(keys.privateKey, { environment: "staging" }), options(pem)))).toBe("environment_mismatch");
    expect(await codeOf(verifyDevBotWorkloadToken(await mint(keys.privateKey, { scope: "tolani.service.discover" }), options(pem)))).toBe("service_scope_required");
  });

  it("denies expired, overlong, wrong-org and unknown service identities", async () => {
    const { keys, pem } = await fixture();
    expect(await codeOf(verifyDevBotWorkloadToken(await mint(keys.privateKey, { iat: now - 400, nbf: now - 400, exp: now - 31 }), options(pem)))).toBe("jwt_expired");
    expect(await codeOf(verifyDevBotWorkloadToken(await mint(keys.privateKey, { iat: now - 10, exp: now + 301 }), options(pem)))).toBe("jwt_ttl_invalid");
    expect(await codeOf(verifyDevBotWorkloadToken(await mint(keys.privateKey, { organization: "other" }), options(pem)))).toBe("tolani_organization_required");
    expect(await codeOf(verifyDevBotWorkloadToken(await mint(keys.privateKey, { service_id: "unknown" }), options(pem)))).toBe("service_identity_not_allowed");
  });
});
