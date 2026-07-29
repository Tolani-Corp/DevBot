import crypto from "node:crypto";
import fs from "node:fs/promises";

export interface ManagedSignature {
  algorithm: "PS256";
  keyId: string;
  value: string;
  signedAt: string;
  provider: "azure-key-vault" | "local-test";
}

export interface AuthorizationManifest {
  schemaVersion: "1.0.0";
  documentSha256: string;
  engagementId: string;
  scopeSha256: string;
  signerId: string;
  signerRole: "asset-owner" | "delegated-authorizer";
  signedAt: string;
  expiresAt?: string;
}

export interface AuthorizationSignature extends ManagedSignature {
  signerId: string;
  signerRole: AuthorizationManifest["signerRole"];
  expiresAt?: string;
}

interface AzureTokenResponse {
  access_token?: string;
  accessToken?: string;
}

interface AzureVerifyResponse {
  value?: boolean;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function digest(value: unknown): Buffer {
  return crypto.createHash("sha256").update(canonicalJson(value)).digest();
}

function parseCsv(value: string | undefined): Set<string> {
  return new Set((value ?? "").split(",").map((entry) => entry.trim()).filter(Boolean));
}

function assertKeyId(keyId: string): string {
  const parsed = new URL(keyId);
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".vault.azure.net")) {
    throw new Error(`Untrusted Key Vault host in key ID ${keyId}`);
  }
  if (!/^\/keys\/[^/]+\/[^/]+$/.test(parsed.pathname)) {
    throw new Error("Production signatures require a versioned Azure Key Vault key ID");
  }
  return parsed.toString().replace(/\/$/, "");
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`Key Vault HTTP ${response.status}: ${JSON.stringify(payload)}`);
  return payload as T;
}

async function workloadToken(): Promise<string | undefined> {
  const file = process.env.AZURE_FEDERATED_TOKEN_FILE?.trim();
  const tenant = process.env.AZURE_TENANT_ID?.trim();
  const client = process.env.AZURE_CLIENT_ID?.trim();
  if (!file || !tenant || !client) return undefined;
  const assertion = (await fs.readFile(file, "utf8")).trim();
  const body = new URLSearchParams({
    client_id: client,
    scope: "https://vault.azure.net/.default",
    grant_type: "client_credentials",
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: assertion,
  });
  const response = await requestJson<AzureTokenResponse>(
    `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
    { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body },
  );
  return response.access_token;
}

async function appServiceToken(): Promise<string | undefined> {
  const endpoint = process.env.IDENTITY_ENDPOINT?.trim();
  const header = process.env.IDENTITY_HEADER?.trim();
  if (!endpoint || !header) return undefined;
  const url = new URL(endpoint);
  url.searchParams.set("api-version", "2019-08-01");
  url.searchParams.set("resource", "https://vault.azure.net");
  if (process.env.AZURE_CLIENT_ID) url.searchParams.set("client_id", process.env.AZURE_CLIENT_ID);
  const response = await requestJson<AzureTokenResponse>(url.toString(), {
    headers: { "X-IDENTITY-HEADER": header, Metadata: "true" },
  });
  return response.access_token ?? response.accessToken;
}

async function imdsToken(): Promise<string | undefined> {
  if (process.env.AZURE_DISABLE_IMDS === "true") return undefined;
  const url = new URL("http://169.254.169.254/metadata/identity/oauth2/token");
  url.searchParams.set("api-version", "2018-02-01");
  url.searchParams.set("resource", "https://vault.azure.net");
  if (process.env.AZURE_CLIENT_ID) url.searchParams.set("client_id", process.env.AZURE_CLIENT_ID);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1_500);
  try {
    const response = await requestJson<AzureTokenResponse>(url.toString(), {
      headers: { Metadata: "true" },
      signal: controller.signal,
    });
    return response.access_token ?? response.accessToken;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

async function accessToken(): Promise<string> {
  if (process.env.AZURE_KEY_VAULT_ACCESS_TOKEN && process.env.NODE_ENV !== "production") {
    return process.env.AZURE_KEY_VAULT_ACCESS_TOKEN;
  }
  const token = (await workloadToken()) ?? (await appServiceToken()) ?? (await imdsToken());
  if (!token) throw new Error("NATT could not obtain an Azure Key Vault identity token");
  return token;
}

async function azureVerify(value: unknown, signature: ManagedSignature): Promise<boolean> {
  const keyId = assertKeyId(signature.keyId);
  const token = await accessToken();
  const response = await requestJson<AzureVerifyResponse>(`${keyId}/verify?api-version=2025-07-01`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      alg: signature.algorithm,
      digest: digest(value).toString("base64url"),
      value: signature.value,
    }),
  });
  return response.value === true;
}

async function localVerify(value: unknown, signature: ManagedSignature): Promise<boolean> {
  if (process.env.NODE_ENV === "production") return false;
  const publicKeyFile = process.env.DEBO_NATT_TEST_PUBLIC_KEY_FILE?.trim();
  if (!publicKeyFile) throw new Error("DEBO_NATT_TEST_PUBLIC_KEY_FILE is required for local signature verification");
  const key = await fs.readFile(publicKeyFile, "utf8");
  return crypto.verify(
    "sha256",
    Buffer.from(canonicalJson(value)),
    { key, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 },
    Buffer.from(signature.value, "base64url"),
  );
}

export async function verifyManagedPayload(
  value: unknown,
  signature: ManagedSignature,
  trustedKeyIds: ReadonlySet<string>,
): Promise<boolean> {
  if (signature.algorithm !== "PS256" || !trustedKeyIds.has(signature.keyId)) return false;
  return signature.provider === "azure-key-vault"
    ? azureVerify(value, signature)
    : localVerify(value, signature);
}

function trustedFrom(value: string | undefined): Set<string> {
  const trusted = parseCsv(value);
  if (process.env.NODE_ENV !== "production" && process.env.DEBO_NATT_TEST_KEY_ID) {
    trusted.add(process.env.DEBO_NATT_TEST_KEY_ID);
  }
  return trusted;
}

export function trustedRequestKeyIds(): ReadonlySet<string> {
  return trustedFrom(process.env.DEBO_NATT_TRUSTED_REQUEST_KEY_IDS);
}

export function trustedAuthorizationKeyIds(): ReadonlySet<string> {
  return trustedFrom(process.env.DEBO_NATT_TRUSTED_AUTH_KEY_IDS);
}

export function trustedPathfinderKeyIds(): ReadonlySet<string> {
  return trustedFrom(process.env.NATT_PATHFINDER_TRUSTED_KEY_IDS);
}

export async function verifyAuthorizationSignature(
  manifest: AuthorizationManifest,
  signature: AuthorizationSignature,
): Promise<boolean> {
  if (manifest.signerId !== signature.signerId || manifest.signerRole !== signature.signerRole) return false;
  if (manifest.expiresAt !== signature.expiresAt) return false;
  const now = Date.now();
  if (new Date(manifest.signedAt).getTime() > now + 5 * 60_000) return false;
  if (manifest.expiresAt && new Date(manifest.expiresAt).getTime() < now) return false;
  return verifyManagedPayload(manifest, signature, trustedAuthorizationKeyIds());
}
