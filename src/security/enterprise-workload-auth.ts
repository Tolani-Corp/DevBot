const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class EnterpriseWorkloadAuthError extends Error {
  constructor(public readonly code: string, public readonly status: 401 | 403 | 500 = 401) {
    super(code);
    this.name = "EnterpriseWorkloadAuthError";
  }
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  try {
    return Uint8Array.from(Buffer.from(padded, "base64"));
  } catch {
    throw new EnterpriseWorkloadAuthError("jwt_base64_invalid");
  }
}

function decodeJson(value: string, code: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(decoder.decode(decodeBase64Url(value)));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("object required");
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof EnterpriseWorkloadAuthError) throw error;
    throw new EnterpriseWorkloadAuthError(code);
  }
}

function pemDer(pem: string): Uint8Array {
  if (!pem.includes("BEGIN PUBLIC KEY")) throw new EnterpriseWorkloadAuthError("verification_key_invalid", 500);
  const body = pem.replace(/-----BEGIN PUBLIC KEY-----/g, "").replace(/-----END PUBLIC KEY-----/g, "").replace(/\s+/g, "");
  return Uint8Array.from(Buffer.from(body, "base64"));
}

function scopes(payload: Record<string, unknown>) {
  const values: string[] = [];
  for (const candidate of [payload.scope, payload.scopes, payload.scp]) {
    if (typeof candidate === "string") values.push(...candidate.split(/\s+/u));
    if (Array.isArray(candidate)) values.push(...candidate.map(String));
  }
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function audienceMatches(actual: unknown, expected: string) {
  return typeof actual === "string" ? actual === expected : Array.isArray(actual) && actual.map(String).includes(expected);
}

export async function verifyDevBotWorkloadToken(token: string, options: {
  pemPublicKey: string;
  expectedIssuer: string;
  expectedAudience: string;
  expectedEnvironment: string;
  requiredScope: string;
  allowedServiceIds?: string[];
  nowEpochSeconds?: number;
}) {
  if (!token || token.length > 16384) throw new EnterpriseWorkloadAuthError("jwt_invalid");
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) throw new EnterpriseWorkloadAuthError("jwt_invalid");
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJson(encodedHeader, "jwt_header_invalid");
  const payload = decodeJson(encodedPayload, "jwt_payload_invalid");
  if (header.alg !== "RS256") throw new EnterpriseWorkloadAuthError("jwt_algorithm_forbidden");

  const key = await crypto.subtle.importKey("spki", pemDer(options.pemPublicKey), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const signatureOk = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    decodeBase64Url(encodedSignature),
    encoder.encode(`${encodedHeader}.${encodedPayload}`),
  );
  if (!signatureOk) throw new EnterpriseWorkloadAuthError("jwt_signature_invalid");
  if (payload.iss !== options.expectedIssuer) throw new EnterpriseWorkloadAuthError("jwt_issuer_invalid");
  if (!audienceMatches(payload.aud, options.expectedAudience)) throw new EnterpriseWorkloadAuthError("jwt_audience_invalid");

  const now = options.nowEpochSeconds ?? Math.floor(Date.now() / 1000);
  const exp = Number(payload.exp);
  const iat = Number(payload.iat);
  const nbf = payload.nbf === undefined ? iat : Number(payload.nbf);
  if (![exp, iat, nbf].every(Number.isFinite)) throw new EnterpriseWorkloadAuthError("jwt_time_claims_invalid");
  if (exp <= now - 30) throw new EnterpriseWorkloadAuthError("jwt_expired");
  if (nbf > now + 30 || iat > now + 30) throw new EnterpriseWorkloadAuthError("jwt_not_yet_valid");
  if (exp <= iat || exp - iat > 300) throw new EnterpriseWorkloadAuthError("jwt_ttl_invalid");
  if (payload.organization !== "tolani") throw new EnterpriseWorkloadAuthError("tolani_organization_required", 403);
  if (payload.access_class !== "tolani-internal") throw new EnterpriseWorkloadAuthError("internal_access_class_required", 403);
  if (payload.environment !== options.expectedEnvironment) throw new EnterpriseWorkloadAuthError("environment_mismatch", 403);
  if (typeof payload.service_id !== "string" || !payload.service_id) throw new EnterpriseWorkloadAuthError("service_identity_required", 403);
  if (options.allowedServiceIds && !options.allowedServiceIds.includes(payload.service_id)) {
    throw new EnterpriseWorkloadAuthError("service_identity_not_allowed", 403);
  }
  const normalizedScopes = scopes(payload);
  if (!normalizedScopes.includes(options.requiredScope)) throw new EnterpriseWorkloadAuthError("service_scope_required", 403);
  return Object.freeze({ serviceId: payload.service_id, scopes: normalizedScopes, expiresAt: exp });
}

export function bearerFromNodeAuthorization(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header;
  const token = /^Bearer\s+([^\s]+)$/iu.exec(value?.trim() ?? "")?.[1];
  if (!token) throw new EnterpriseWorkloadAuthError("bearer_token_required");
  return token;
}
