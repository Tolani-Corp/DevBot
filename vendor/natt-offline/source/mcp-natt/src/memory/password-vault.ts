import * as fs from "fs/promises";
import * as path from "path";

const MEMORY_DIR = path.join(process.cwd(), ".natt-memory");
const VAULT_FILE = path.join(MEMORY_DIR, "password-vault.json");

export interface VaultEntry {
  password: string;
  entropy: number;
  context: string;
  tags: string[];
  labels: Record<string, string>;
  successCount: number;
  lastUsed: string;
}

export async function initVault() {
  await fs.mkdir(MEMORY_DIR, { recursive: true });
  try {
    await fs.access(VAULT_FILE);
  } catch {
    await fs.writeFile(VAULT_FILE, JSON.stringify([]));
  }
}

export async function storePassword(entry: Omit<VaultEntry, "successCount" | "lastUsed">) {
  await initVault();
  const data = await fs.readFile(VAULT_FILE, "utf-8");
  const vault: VaultEntry[] = JSON.parse(data);
  
  const existing = vault.find(v => v.password === entry.password && v.context === entry.context);
  if (existing) {
    existing.lastUsed = new Date().toISOString();
    existing.tags = Array.from(new Set([...(existing.tags || []), ...(entry.tags || [])]));
    existing.labels = { ...(existing.labels || {}), ...(entry.labels || {}) };
  } else {
    vault.push({
      ...entry,
      tags: entry.tags || [],
      labels: entry.labels || {},
      successCount: 0,
      lastUsed: new Date().toISOString()
    });
  }
  
  await fs.writeFile(VAULT_FILE, JSON.stringify(vault, null, 2));
}

export async function recordPasswordSuccess(password: string, context?: string) {
  await initVault();
  const data = await fs.readFile(VAULT_FILE, "utf-8");
  const vault: VaultEntry[] = JSON.parse(data);
  
  const entry = vault.find(v => v.password === password && (!context || v.context === context));
  if (entry) {
    entry.successCount += 1;
    entry.lastUsed = new Date().toISOString();
    await fs.writeFile(VAULT_FILE, JSON.stringify(vault, null, 2));
    return true;
  }
  return false;
}

export async function getTopPasswords(options: { context?: string, tags?: string[], labels?: Record<string, string>, limit?: number }) {
  await initVault();
  const data = await fs.readFile(VAULT_FILE, "utf-8");
  let vault: VaultEntry[] = JSON.parse(data);
  
  if (options.context) {
    vault = vault.filter(v => v.context === options.context);
  }
  
  if (options.tags && options.tags.length > 0) {
    vault = vault.filter(v => options.tags!.every(tag => (v.tags || []).includes(tag)));
  }

  if (options.labels) {
    vault = vault.filter(v => {
      for (const [key, value] of Object.entries(options.labels!)) {
        if ((v.labels || {})[key] !== value) return false;
      }
      return true;
    });
  }
  
  return vault.sort((a, b) => b.successCount - a.successCount).slice(0, options.limit || 10);
}
