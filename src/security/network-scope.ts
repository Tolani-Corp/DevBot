import net from "node:net";
import { domainToASCII } from "node:url";

export interface NetworkScopePolicy {
  inScope: string[];
  outOfScope: string[];
  allowedPorts?: number[];
  allowedPaths?: string[];
  includeSubdomains: boolean;
}

export interface ScopeDecision {
  allowed: boolean;
  reason: string;
  matchedRule?: string;
}

interface ParsedTarget {
  original: string;
  host: string;
  ipVersion: 0 | 4 | 6;
  port?: number;
  path?: string;
}

interface ParsedRule {
  original: string;
  kind: "cidr" | "ip" | "domain" | "wildcard-domain";
  host?: string;
  ipVersion?: 4 | 6;
  address?: bigint;
  prefixLength?: number;
  path?: string;
  port?: number;
}

function normalizeDomain(value: string): string {
  const ascii = domainToASCII(value.trim().replace(/\.$/, "").toLowerCase());
  if (!ascii || ascii.length > 253) {
    throw new Error(`Invalid domain name: ${value}`);
  }
  const labels = ascii.split(".");
  if (labels.some((label) => !label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))) {
    throw new Error(`Invalid domain name: ${value}`);
  }
  return ascii;
}

function ipv4ToBigInt(value: string): bigint {
  const parts = value.split(".");
  if (parts.length !== 4) throw new Error(`Invalid IPv4 address: ${value}`);
  let result = 0n;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) throw new Error(`Invalid IPv4 address: ${value}`);
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) {
      throw new Error(`Invalid IPv4 address: ${value}`);
    }
    result = (result << 8n) | BigInt(octet);
  }
  return result;
}

function expandIpv4Tail(value: string): string {
  const lastColon = value.lastIndexOf(":");
  const tail = value.slice(lastColon + 1);
  if (!tail.includes(".")) return value;
  if (net.isIP(tail) !== 4) throw new Error(`Invalid embedded IPv4 address: ${tail}`);
  const ipv4 = Number(ipv4ToBigInt(tail));
  const high = ((ipv4 >>> 16) & 0xffff).toString(16);
  const low = (ipv4 & 0xffff).toString(16);
  return `${value.slice(0, lastColon + 1)}${high}:${low}`;
}

function ipv6ToBigInt(input: string): bigint {
  if (input.includes("%")) {
    throw new Error("IPv6 zone identifiers are not permitted in authorization scope");
  }
  const value = expandIpv4Tail(input.toLowerCase());
  if (value.split("::").length > 2) throw new Error(`Invalid IPv6 address: ${input}`);

  const [leftRaw, rightRaw] = value.split("::");
  const left = leftRaw ? leftRaw.split(":").filter(Boolean) : [];
  const right = rightRaw ? rightRaw.split(":").filter(Boolean) : [];
  const hasCompression = value.includes("::");
  const missing = 8 - left.length - right.length;

  if ((!hasCompression && missing !== 0) || (hasCompression && missing < 1)) {
    throw new Error(`Invalid IPv6 address: ${input}`);
  }

  const groups = hasCompression
    ? [...left, ...Array.from({ length: missing }, () => "0"), ...right]
    : left;
  if (groups.length !== 8) throw new Error(`Invalid IPv6 address: ${input}`);

  let result = 0n;
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(group)) throw new Error(`Invalid IPv6 address: ${input}`);
    result = (result << 16n) | BigInt(`0x${group}`);
  }
  return result;
}

function ipToBigInt(value: string, version: 4 | 6): bigint {
  return version === 4 ? ipv4ToBigInt(value) : ipv6ToBigInt(value);
}

function parseTarget(value: string): ParsedTarget {
  const trimmed = value.trim();
  if (!trimmed || /[\u0000-\u001f\u007f]/.test(trimmed)) {
    throw new Error("Target is empty or contains control characters");
  }

  try {
    const url = new URL(trimmed);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error(`Unsupported target protocol: ${url.protocol}`);
    }
    const rawHost = url.hostname.replace(/^\[|\]$/g, "");
    const version = net.isIP(rawHost) as 0 | 4 | 6;
    return {
      original: trimmed,
      host: version ? rawHost.toLowerCase() : normalizeDomain(rawHost),
      ipVersion: version,
      port: url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80,
      path: url.pathname || "/",
    };
  } catch (error) {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) throw error;
  }

  const bracketed = trimmed.match(/^\[([^\]]+)](?::(\d{1,5}))?$/);
  if (bracketed) {
    const host = bracketed[1]!;
    if (net.isIP(host) !== 6) throw new Error(`Invalid IPv6 target: ${trimmed}`);
    const port = bracketed[2] ? Number(bracketed[2]) : undefined;
    if (port !== undefined && (port < 1 || port > 65535)) throw new Error(`Invalid target port: ${port}`);
    return { original: trimmed, host: host.toLowerCase(), ipVersion: 6, port };
  }

  const version = net.isIP(trimmed) as 0 | 4 | 6;
  if (version) return { original: trimmed, host: trimmed.toLowerCase(), ipVersion: version };

  const hostPort = trimmed.match(/^([^:]+):(\d{1,5})$/);
  if (hostPort) {
    const port = Number(hostPort[2]);
    if (port < 1 || port > 65535) throw new Error(`Invalid target port: ${port}`);
    return { original: trimmed, host: normalizeDomain(hostPort[1]!), ipVersion: 0, port };
  }

  return { original: trimmed, host: normalizeDomain(trimmed), ipVersion: 0 };
}

function parseRule(value: string): ParsedRule {
  const original = value.trim();
  if (!original) throw new Error("Scope rule cannot be empty");

  const cidrMatch = original.match(/^(.+)\/(\d{1,3})$/);
  if (cidrMatch && !/^https?:\/\//i.test(original)) {
    const addressText = cidrMatch[1]!.replace(/^\[|\]$/g, "");
    const version = net.isIP(addressText) as 0 | 4 | 6;
    if (!version) throw new Error(`Invalid CIDR address: ${original}`);
    const prefixLength = Number(cidrMatch[2]);
    const bitLength = version === 4 ? 32 : 128;
    if (!Number.isInteger(prefixLength) || prefixLength < 0 || prefixLength > bitLength) {
      throw new Error(`Invalid IPv${version} prefix length: ${original}`);
    }
    return {
      original,
      kind: "cidr",
      ipVersion: version,
      address: ipToBigInt(addressText, version),
      prefixLength,
    };
  }

  if (original.startsWith("*.")) {
    return { original, kind: "wildcard-domain", host: normalizeDomain(original.slice(2)) };
  }

  const parsed = parseTarget(original);
  if (parsed.ipVersion) {
    return {
      original,
      kind: "ip",
      host: parsed.host,
      ipVersion: parsed.ipVersion,
      address: ipToBigInt(parsed.host, parsed.ipVersion),
      path: parsed.path,
      port: parsed.port,
    };
  }

  return {
    original,
    kind: "domain",
    host: parsed.host,
    path: parsed.path,
    port: parsed.port,
  };
}

function cidrContains(rule: ParsedRule, target: ParsedTarget): boolean {
  if (rule.kind !== "cidr" || !rule.address || rule.prefixLength === undefined || !rule.ipVersion) return false;
  if (target.ipVersion !== rule.ipVersion) return false;
  const bits = rule.ipVersion === 4 ? 32 : 128;
  const targetValue = ipToBigInt(target.host, rule.ipVersion);
  const hostBits = BigInt(bits - rule.prefixLength);
  const mask = rule.prefixLength === 0 ? 0n : ((1n << BigInt(bits)) - 1n) ^ ((1n << hostBits) - 1n);
  return (targetValue & mask) === (rule.address & mask);
}

function hostMatches(rule: ParsedRule, target: ParsedTarget, includeSubdomains: boolean): boolean {
  if (rule.kind === "cidr") return cidrContains(rule, target);
  if (rule.kind === "ip") return target.ipVersion === rule.ipVersion && target.host === rule.host;
  if (target.ipVersion !== 0 || !rule.host) return false;
  if (rule.kind === "wildcard-domain") return target.host.endsWith(`.${rule.host}`) && target.host !== rule.host;
  return target.host === rule.host || (includeSubdomains && target.host.endsWith(`.${rule.host}`));
}

function pathMatches(rule: ParsedRule, target: ParsedTarget): boolean {
  if (!rule.path || rule.path === "/" || !target.path) return true;
  const normalizedRule = rule.path.endsWith("/") ? rule.path : `${rule.path}/`;
  const normalizedTarget = target.path.endsWith("/") ? target.path : `${target.path}/`;
  return normalizedTarget.startsWith(normalizedRule);
}

function portMatches(rule: ParsedRule, target: ParsedTarget): boolean {
  return rule.port === undefined || target.port === rule.port;
}

function matchesRule(rule: ParsedRule, target: ParsedTarget, includeSubdomains: boolean): boolean {
  return hostMatches(rule, target, includeSubdomains) && portMatches(rule, target) && pathMatches(rule, target);
}

export function evaluateTargetScope(targetValue: string, scope: NetworkScopePolicy): ScopeDecision {
  let target: ParsedTarget;
  try {
    target = parseTarget(targetValue);
  } catch (error) {
    return { allowed: false, reason: error instanceof Error ? error.message : String(error) };
  }

  for (const rawRule of scope.outOfScope) {
    try {
      const rule = parseRule(rawRule);
      if (matchesRule(rule, target, true)) {
        return { allowed: false, reason: `Target matches explicit out-of-scope rule ${rawRule}`, matchedRule: rawRule };
      }
    } catch (error) {
      return { allowed: false, reason: `Invalid out-of-scope rule ${rawRule}: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  for (const rawRule of scope.inScope) {
    try {
      const rule = parseRule(rawRule);
      if (!matchesRule(rule, target, scope.includeSubdomains)) continue;
      if (scope.allowedPorts?.length && target.port !== undefined && !scope.allowedPorts.includes(target.port)) {
        return { allowed: false, reason: `Target port ${target.port} is not authorized`, matchedRule: rawRule };
      }
      if (scope.allowedPaths?.length && target.path) {
        const allowed = scope.allowedPaths.some((allowedPath) => {
          const rulePath = allowedPath.endsWith("/") ? allowedPath : `${allowedPath}/`;
          const targetPath = target.path!.endsWith("/") ? target.path! : `${target.path!}/`;
          return targetPath.startsWith(rulePath);
        });
        if (!allowed) return { allowed: false, reason: `Target path ${target.path} is not authorized`, matchedRule: rawRule };
      }
      return { allowed: true, reason: `Target matches in-scope rule ${rawRule}`, matchedRule: rawRule };
    } catch (error) {
      return { allowed: false, reason: `Invalid in-scope rule ${rawRule}: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  return { allowed: false, reason: "Target does not match any approved scope rule" };
}

export function assertTargetInScope(target: string, scope: NetworkScopePolicy): void {
  const decision = evaluateTargetScope(target, scope);
  if (!decision.allowed) throw new Error(decision.reason);
}

export function isValidCidr(value: string): boolean {
  try {
    return parseRule(value).kind === "cidr";
  } catch {
    return false;
  }
}
