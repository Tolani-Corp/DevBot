import fs from "node:fs/promises";
import path from "node:path";

interface AzureTokenResponse {
  access_token?: string;
  accessToken?: string;
}

interface AzureSecretResponse {
  value?: string;
}

function assertSecretId(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".vault.azure.net")) {
    throw new Error(`Azure Key Vault secret ID required: ${value}`);
  }
  if (!/^\/secrets\/[^/]+\/[^/]+$/.test(url.pathname)) {
    throw new Error("Pathfinder requires a versioned Azure Key Vault secret ID");
  }
  return url;
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`Azure Key Vault HTTP ${response.status}: ${JSON.stringify(payload)}`);
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

async function token(): Promise<string> {
  if (process.env.AZURE_KEY_VAULT_ACCESS_TOKEN && process.env.NODE_ENV !== "production") {
    return process.env.AZURE_KEY_VAULT_ACCESS_TOKEN;
  }
  const value = (await workloadToken()) ?? (await appServiceToken()) ?? (await imdsToken());
  if (!value) throw new Error("No Azure identity is available for Pathfinder vault access");
  return value;
}

async function localGet(secretId: string): Promise<string> {
  if (process.env.NODE_ENV === "production") throw new Error("Local vault is prohibited in production");
  const root = process.env.DEBO_LOCAL_VAULT_DIR?.trim();
  if (!root) throw new Error("DEBO_LOCAL_VAULT_DIR is not configured");
  const url = new URL(secretId);
  const name = decodeURIComponent(url.hostname);
  const version = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const record = JSON.parse(await fs.readFile(path.resolve(root, name, `${version}.json`), "utf8")) as { value?: string };
  if (typeof record.value !== "string") throw new Error("Local vault secret has no value");
  return record.value;
}

export async function getVaultSecret(secretId: string): Promise<string> {
  if (secretId.startsWith("local-vault://")) return localGet(secretId);
  const url = assertSecretId(secretId);
  url.searchParams.set("api-version", "2025-07-01");
  const response = await requestJson<AzureSecretResponse>(url.toString(), {
    headers: { authorization: `Bearer ${await token()}` },
  });
  if (typeof response.value !== "string") throw new Error("Pathfinder vault secret has no value");
  return response.value;
}
