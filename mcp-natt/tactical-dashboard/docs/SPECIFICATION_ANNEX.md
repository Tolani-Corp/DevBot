# NATT Tactical Dashboard — Specification Annex

**Classification:** SENSITIVE  
**Document Ref:** NATT-SPEC-ANNEX-001  
**Version:** 1.0.0  
**Date:** 2026-02-24  
**Status:** Approved for Field Use

---

## Table of Contents

1. [System Specification Table](#1-system-specification-table)
2. [Tool Input/Output Specification](#2-tool-inputoutput-specification)
3. [Security Classification Levels](#3-security-classification-levels)
4. [Data Retention Policy](#4-data-retention-policy)
5. [Network Ports and Protocols](#5-network-ports-and-protocols)
6. [Cryptographic Standards](#6-cryptographic-standards)
7. [Compliance Notes](#7-compliance-notes)
8. [Glossary / Acronym List](#8-glossary--acronym-list)

---

## 1. System Specification Table

### 1.1 Hardware Requirements

| Component | Minimum | Recommended | Notes |
|-----------|---------|-------------|-------|
| CPU | 1.0 GHz single-core (ARMv7) | 1.5 GHz quad-core (ARM64) | Raspberry Pi 4 or equivalent |
| RAM | 512 MB | 2 GB | 1 GB min for comfortable operation |
| Storage | 4 GB | 16 GB microSD or SSD | SSD preferred for write endurance |
| Network | None (offline capable) | Wi-Fi 802.11n or Ethernet | Required for remote access only |
| Display | None (headless supported) | Any HDMI display | Browser access via SSH tunnel |
| Power | 5V 2.5A (USB-C) | 5V 3A with quality cable | Brownout protection recommended |

**Android (Termux):**
| Component | Minimum |
|-----------|---------|
| Android version | 7.0 (Nougat) |
| RAM | 2 GB device |
| Storage | 500 MB free |
| CPU | ARMv8 (64-bit preferred) |

**Laptop/Desktop:**
| Component | Minimum |
|-----------|---------|
| OS | Windows 10, macOS 12, Ubuntu 20.04 |
| RAM | 2 GB available |
| Disk | 500 MB free |

### 1.2 Software Requirements

| Dependency | Minimum Version | Recommended | Source |
|------------|----------------|-------------|--------|
| Node.js | 18.0.0 | 22.x LTS | nodejs.org |
| npm | 9.0.0 | Included with Node 22 | — |
| TypeScript | 5.0.0 | 5.4+ | npm |
| @anthropic-ai/sdk | 0.20.0 | Latest | npm |
| express | 4.18.0 | 4.21+ | npm |
| Git | 2.30.0 | Latest | System |
| OS | Any POSIX-compliant | Linux (Debian/Ubuntu) | — |

### 1.3 Performance Targets

| Metric | Target | Maximum Acceptable | Notes |
|--------|--------|---------------------|-------|
| Server startup time | < 2 seconds | 5 seconds | Cold start |
| Health check response | < 50 ms | 200 ms | p99 |
| Static tool response | < 100 ms | 500 ms | p99 |
| Memory tool response | < 200 ms | 1000 ms | With disk I/O |
| E2E simulation (quick) | < 1000 ms | 3000 ms | Single scenario |
| E2E simulation (deep) | < 5000 ms | 15000 ms | Chained tools |
| Concurrent users | 5 | 20 | Same LAN |
| Memory file size (vault) | < 1 MB | 5 MB | Per file |
| Memory file size (AAR) | < 5 MB | 20 MB | Per file |
| Disk write frequency | < 10 writes/min | 60 writes/min | Flash wear |

---

## 2. Tool Input/Output Specification

The following 10 tools are documented with full JSON request/response examples.

### 2.1 identify_hash

**Request:**
```json
POST /api/tool/identify_hash
{
  "args": {
    "hash": "5f4dcc3b5aa765d61d8327deb882cf99",
    "context": "extracted from web app login response"
  }
}
```

**Response:**
```json
{
  "success": true,
  "tool": "identify_hash",
  "result": {
    "hash": "5f4dcc3b5aa765d61d8327deb882cf99",
    "identified": "MD5",
    "confidence": "high",
    "length": 32,
    "charset": "hexadecimal",
    "alternates": ["MD4", "LM"],
    "crackabilityIndex": 9.1,
    "hashcatMode": 0,
    "johnFormat": "raw-md5",
    "notes": "MD5 hashes are trivially crackable. Rainbow tables highly effective.",
    "recommendedTools": ["hashcat -m 0 hash.txt wordlist.txt", "john --format=raw-md5 hash.txt"]
  },
  "timestamp": "2026-02-24T12:00:00.000Z",
  "executionMs": 8
}
```

---

### 2.2 get_dast_profile

**Request:**
```json
POST /api/tool/get_dast_profile
{
  "args": {
    "targetType": "api-gateway",
    "depth": "standard",
    "auth": "jwt-bearer"
  }
}
```

**Response:**
```json
{
  "success": true,
  "tool": "get_dast_profile",
  "result": {
    "profileName": "API Gateway DAST — Standard",
    "targetType": "api-gateway",
    "scanPhases": [
      { "phase": "Discovery", "tools": ["OWASP ZAP Spider", "Burp Suite Crawl"], "duration": "15 min" },
      { "phase": "Authentication", "tools": ["JWT decode", "Bearer token fuzz"], "duration": "10 min" },
      { "phase": "Injection", "tools": ["SQLi", "NoSQLi", "SSTI", "XXE"], "duration": "30 min" },
      { "phase": "Authorization", "tools": ["IDOR scan", "Privilege escalation check"], "duration": "20 min" },
      { "phase": "Reporting", "tools": ["ZAP report", "Custom findings"], "duration": "10 min" }
    ],
    "checklistItems": 47,
    "estimatedDuration": "85 min",
    "authConfig": { "type": "jwt-bearer", "headerName": "Authorization", "prefix": "Bearer " }
  },
  "timestamp": "2026-02-24T12:00:00.000Z",
  "executionMs": 22
}
```

---

### 2.3 decode_jwt

**Request:**
```json
POST /api/tool/decode_jwt
{
  "args": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0Iiwicm9sZSI6InVzZXIifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    "showHeader": true,
    "showPayload": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "tool": "decode_jwt",
  "result": {
    "header": { "alg": "HS256", "typ": "JWT" },
    "payload": { "sub": "1234", "role": "user" },
    "signature": "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    "verified": false,
    "warnings": [
      "Algorithm HS256 uses symmetric key — server secret required to verify",
      "No 'exp' claim — token has no expiration",
      "No 'iat' claim — issuance time not recorded"
    ],
    "attackSurface": ["alg:none attack", "Key confusion (RS256→HS256)", "Brute-force HS256 secret"]
  }
}
```

---

### 2.4 get_vulnerability_info

**Request:**
```json
POST /api/tool/get_vulnerability_info
{
  "args": {
    "query": "CVE-2021-44228",
    "severity": "critical"
  }
}
```

**Response:**
```json
{
  "success": true,
  "tool": "get_vulnerability_info",
  "result": {
    "cve": "CVE-2021-44228",
    "name": "Log4Shell",
    "cvss": 10.0,
    "severity": "CRITICAL",
    "description": "Apache Log4j2 JNDI injection vulnerability allowing remote code execution.",
    "affectedVersions": "Log4j 2.0-beta9 through 2.14.1",
    "patchedVersions": "2.15.0+",
    "exploitAvailable": true,
    "exploitMaturity": "weaponized",
    "vectors": ["JNDI LDAP callback", "JNDI RMI callback", "Header injection"],
    "detectionMethods": ["WAF rule inspection", "Network egress monitoring", "Log file scanning"],
    "remediationSteps": [
      "Upgrade to Log4j 2.17.1+",
      "Set log4j2.formatMsgNoLookups=true",
      "Remove JndiLookup class from classpath"
    ]
  }
}
```

---

### 2.5 analyze_vpn_config

**Request:**
```json
POST /api/tool/analyze_vpn_config
{
  "args": {
    "config": "client\ndev tun\nproto udp\nremote vpn.example.com 1194\ncipher AES-128-CBC\ntls-auth ta.key 1",
    "protocol": "openvpn",
    "strict": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "tool": "analyze_vpn_config",
  "result": {
    "protocol": "OpenVPN",
    "findings": [
      { "severity": "medium", "issue": "AES-128-CBC: prefer AES-256-GCM for AEAD encryption", "line": "cipher AES-128-CBC" },
      { "severity": "low", "issue": "tls-auth is deprecated; prefer tls-crypt for mutual auth", "line": "tls-auth ta.key 1" },
      { "severity": "info", "issue": "UDP protocol: susceptible to port scanning detection", "line": "proto udp" }
    ],
    "score": 72,
    "grade": "B",
    "recommendations": ["Upgrade cipher to AES-256-GCM", "Replace tls-auth with tls-crypt", "Add verify-x509-name"]
  }
}
```

---

### 2.6 scan_for_secrets

**Request:**
```json
POST /api/tool/scan_for_secrets
{
  "args": {
    "content": "const API_KEY = 'sk-proj-1234abcd5678efghijklmnop';\nconst DB_PASS = 'admin123';",
    "context": "JavaScript configuration file",
    "reportFormat": "json"
  }
}
```

**Response:**
```json
{
  "success": true,
  "tool": "scan_for_secrets",
  "result": {
    "secretsFound": 2,
    "findings": [
      {
        "type": "OpenAI API Key",
        "pattern": "sk-proj-[A-Za-z0-9]+",
        "value": "sk-proj-1234abcd5678efghi...",
        "redacted": "sk-proj-***REDACTED***",
        "severity": "critical",
        "line": 1,
        "recommendation": "Rotate immediately. Add to .gitignore. Use environment variables."
      },
      {
        "type": "Weak Password Assignment",
        "pattern": "password.*=.*['\"].*['\"]",
        "value": "admin123",
        "severity": "high",
        "line": 2,
        "recommendation": "Use secret manager or environment variable."
      }
    ]
  }
}
```

---

### 2.7 validate_roe_checklist

**Request:**
```json
POST /api/tool/validate_roe_checklist
{
  "args": {
    "scope": "192.168.10.0/24, app.example.com",
    "authorization": "Signed SOW #2026-001 from CISO dated 2026-02-20",
    "targetType": "web",
    "timeWindow": "Sat–Sun 00:00–08:00 UTC"
  }
}
```

**Response:**
```json
{
  "success": true,
  "tool": "validate_roe_checklist",
  "result": {
    "overall": "APPROVED",
    "checklist": [
      { "item": "Written authorization exists", "status": "PASS" },
      { "item": "Scope is clearly defined", "status": "PASS" },
      { "item": "Emergency contact identified", "status": "WARN", "note": "Not provided in submission" },
      { "item": "Out-of-scope systems listed", "status": "WARN", "note": "Not specified" },
      { "item": "Data handling policy agreed", "status": "PASS" },
      { "item": "Time window defined", "status": "PASS" }
    ],
    "warnings": 2,
    "blockers": 0,
    "recommendation": "Resolve 2 warnings before commencing. Add emergency contact and out-of-scope list."
  }
}
```

---

### 2.8 submit_aar

**Request:**
```json
POST /api/tool/submit_aar
{
  "args": {
    "missionId": "OP-2026-003",
    "outcome": "success",
    "toolsUsed": ["identify_hash", "get_dast_profile", "decode_jwt"],
    "lessons": "JWT alg:none attack still effective on legacy endpoints.",
    "recommendations": "Add JWT algorithm validation to pentest checklist.",
    "operator": "T.Hines"
  }
}
```

**Response:**
```json
{
  "success": true,
  "tool": "submit_aar",
  "result": {
    "aarId": "uuid-v4-here",
    "missionId": "OP-2026-003",
    "saved": true,
    "weightsUpdated": true,
    "updatedWeights": {
      "identify_hash": 0.89,
      "get_dast_profile": 0.93,
      "decode_jwt": 0.91
    },
    "message": "AAR recorded. Algorithm weights updated from 42 → 43 samples."
  }
}
```

---

### 2.9 generate_password

**Request:**
```json
POST /api/tool/generate_password
{
  "args": {
    "length": 20,
    "complexity": "maximum",
    "avoid": "O0lI1",
    "prefix": "NATT-"
  }
}
```

**Response:**
```json
{
  "success": true,
  "tool": "generate_password",
  "result": {
    "password": "NATT-k9#mP@2vXqR!nZ$wY",
    "strength": "very-strong",
    "strengthScore": 98,
    "entropy": 131.4,
    "crackTimeBruteForce": "1.3 × 10^28 years at 10 billion/sec",
    "characterSets": ["uppercase", "lowercase", "numbers", "symbols"],
    "length": 21,
    "storePrompt": "Use store_generated_password tool to save this to vault."
  }
}
```

---

### 2.10 run_e2e_simulation

**Request:**
```json
POST /api/tool/run_e2e_simulation
{
  "args": {
    "scenario": "web-app",
    "depth": "standard",
    "reportFormat": "markdown"
  }
}
```

**Response:**
```json
{
  "success": true,
  "tool": "run_e2e_simulation",
  "result": {
    "scenario": "web-app",
    "depth": "standard",
    "phases": [
      { "name": "Reconnaissance", "toolsRun": ["get_secret_patterns", "get_scraper_pattern"], "status": "complete", "findings": 3 },
      { "name": "Authentication Testing", "toolsRun": ["get_auth_bypass_techniques", "get_password_attacks"], "status": "complete", "findings": 5 },
      { "name": "Vulnerability Assessment", "toolsRun": ["get_dast_profile", "get_vulnerability_info"], "status": "complete", "findings": 8 },
      { "name": "JWT Analysis", "toolsRun": ["decode_jwt", "get_jwt_attack"], "status": "complete", "findings": 2 },
      { "name": "Reporting", "toolsRun": [], "status": "complete", "findings": 0 }
    ],
    "totalFindings": 18,
    "criticalFindings": 3,
    "executionMs": 1840,
    "report": "# Web App Simulation Report\n\n..."
  }
}
```

---

## 3. Security Classification Levels

NATT uses four classification levels for operational data stored in `.natt-memory/`.

| Level | Label | Color | Description | Examples | Storage Policy |
|-------|-------|-------|-------------|----------|----------------|
| 1 | ROUTINE | Green | Non-sensitive operational data | Tool usage logs, timing data | Retain indefinitely |
| 2 | SENSITIVE | Yellow | Data with limited operational sensitivity | AAR mission objectives, target types | Retain 90 days, then archive |
| 3 | RESTRICTED | Orange | Data that could compromise operations or individuals | Vault entries with credentials, specific IP targets | Retain 30 days, then wipe or encrypt |
| 4 | SECRET | Red | Highly sensitive — targets, vulnerabilities, exfil data | Active CVE exploitation notes, live credential pairs | Never persist to disk; in-memory only |

**Classification Rules:**
- `password-vault.json` — minimum RESTRICTED
- `aar-history.json` — minimum SENSITIVE
- `algorithm-weights.json` — ROUTINE
- `feedback-log.json` — ROUTINE
- Any entry with real target hostnames/IPs — RESTRICTED or higher
- Any entry with exploited credentials — SECRET (do not store)

---

## 4. Data Retention Policy

| File | Default Retention | Archive After | Delete After | Notes |
|------|------------------|---------------|--------------|-------|
| password-vault.json | Active use | N/A | Manual review | Entries unused >90 days flagged for review |
| aar-history.json | 90 days active | Day 91–365 (archive file) | 1 year | Annual archive to encrypted backup |
| algorithm-weights.json | Indefinite | N/A | On full reset | Accumulates value over time |
| feedback-log.json | 30 days | Aggregated into weights | After aggregation | Raw entries not needed after weight update |
| Backup archives | 30 backups (daily) | N/A | Auto-pruned by backup script | Keep last 30 daily backups |

**Right to Erasure (Panic):** The `/api/panic` endpoint provides immediate erasure of all memory files. This satisfies field sanitization requirements. Backup archives must be separately destroyed.

---

## 5. Network Ports and Protocols

| Port | Protocol | Direction | Service | Notes |
|------|----------|-----------|---------|-------|
| 3000 | TCP/HTTP | Inbound | NATT Dashboard REST API | Default; configurable via PORT env var |
| 3000 | TCP/HTTP | Inbound | Static UI file serving | Same port as API |
| 22 | TCP/SSH | Inbound (to Pi) | SSH access + port forwarding | For remote headless access |
| N/A | stdio | Process | MCP JSON-RPC 2.0 | AI agent integration; no network port |

**Recommended Network Policy:**
- Port 3000: Allow only from localhost or trusted LAN subnet
- Port 3000: Do NOT expose to internet without authentication proxy (nginx + basic auth at minimum)
- Port 22: Restrict to known SSH client IPs when possible

**No outbound connections:** NATT makes zero outbound network connections during normal operation. All knowledge is embedded in the codebase.

---

## 6. Cryptographic Standards

| Function | Algorithm | Key Size | Notes |
|----------|-----------|----------|-------|
| Hash identification | Detection only | N/A | NATT detects MD5, SHA-1, SHA-256, SHA-512, bcrypt, scrypt, Argon2, NTLM, and 20+ others |
| Password generation | CSPRNG (Node.js crypto.randomBytes) | N/A | Cryptographically secure; entropy ≥ 128 bits for length ≥ 20 |
| JWT analysis | Decode only (no signing) | N/A | NATT decodes base64url; never re-signs |
| Backup encryption | GPG AES-256 (recommended) | 256-bit | User responsibility; NATT does not encrypt backups automatically |
| Memory at rest | None (plaintext JSON) | N/A | OS-level encryption recommended for RESTRICTED+ data |
| Transport | HTTP (plaintext) | N/A | TLS not included; use SSH tunnel or nginx TLS proxy for sensitive deployments |

**Recommended additions for sensitive deployments:**
1. Encrypt `.natt-memory/` directory using eCryptfs (Linux) or BitLocker/FileVault (Windows/macOS)
2. Deploy behind nginx with TLS 1.3 + client certificate authentication
3. Use dm-crypt full-disk encryption on Raspberry Pi

---

## 7. Compliance Notes

### 7.1 OWASP Coverage

| OWASP WSTG Category | NATT Tools | Coverage |
|---------------------|------------|----------|
| OTG-INFO (Information Gathering) | get_scraper_pattern, scan_for_secrets | Partial |
| OTG-CRYPST (Cryptography) | identify_hash, get_content_integrity | Partial |
| OTG-AUTHN (Authentication) | get_auth_bypass_techniques, get_default_credentials | Partial |
| OTG-AUTHZ (Authorization) | get_dast_profile | Partial |
| OTG-INPVLD (Input Validation) | get_dast_profile, get_vulnerability_info | Partial |
| OTG-CLIENT (Client-Side Testing) | decode_jwt, get_jwt_attack | Partial |

**NATT does NOT provide:** automated scanning engines, exploit payloads, proof-of-concept code, or network traffic manipulation.

### 7.2 PTES Coverage

| PTES Phase | NATT Support |
|------------|-------------|
| Pre-Engagement | validate_roe_checklist, get_roe_template |
| Intelligence Gathering | get_scraper_pattern, scan_for_secrets |
| Threat Modeling | get_pentest_methodology, get_mission_guidance |
| Vulnerability Research | get_vulnerability_info, get_dast_profile |
| Exploitation | Guidance only — no exploit execution |
| Post Exploitation | Guidance only |
| Reporting | submit_aar, get_algorithm_weights |

### 7.3 NIST SP 800-115 Alignment

NATT aligns with NIST SP 800-115 (Technical Guide to Information Security Testing) as a **knowledge reference tool only**. It does not constitute an automated testing platform and should be used as an aid to human testers.

### 7.4 Legal Disclaimer

NATT is a knowledge tool. Users are solely responsible for ensuring all use complies with applicable laws and contractual obligations. The `validate_roe_checklist` tool assists with pre-engagement validation but does not provide legal advice.

---

## 8. Glossary / Acronym List

| Acronym / Term | Definition |
|----------------|------------|
| AAR | After-Action Review — structured post-operation debrief capturing lessons learned |
| AEAD | Authenticated Encryption with Associated Data |
| API | Application Programming Interface |
| ARM | Advanced RISC Machine — CPU architecture used in Raspberry Pi and mobile |
| AST | Abstract Syntax Tree |
| CLLM | Custom Language Learning Model — internal weight adaptation system |
| CORS | Cross-Origin Resource Sharing — HTTP security header mechanism |
| CSPRNG | Cryptographically Secure Pseudo-Random Number Generator |
| CVE | Common Vulnerabilities and Exposures — standardized vulnerability identifiers |
| CVSS | Common Vulnerability Scoring System |
| DAST | Dynamic Application Security Testing |
| DNS | Domain Name System |
| E2E | End-to-End — full-pipeline simulation mode |
| ESM | ECMAScript Modules — JavaScript native module system |
| GRC | Governance, Risk, and Compliance |
| HTTP | Hypertext Transfer Protocol |
| IDOR | Insecure Direct Object Reference — class of authorization vulnerability |
| IP | Internet Protocol |
| JNDI | Java Naming and Directory Interface |
| JSON | JavaScript Object Notation |
| JWT | JSON Web Token — compact, self-contained token format (RFC 7519) |
| KPI | Key Performance Indicator |
| LDAP | Lightweight Directory Access Protocol |
| MCP | Model Context Protocol — Anthropic's open protocol for AI tool integration |
| MD5 | Message Digest Algorithm 5 — deprecated hash function |
| NATT | Network Attack & Tactics Toolkit |
| NIST | National Institute of Standards and Technology |
| NTLM | NT LAN Manager — Windows authentication protocol |
| OWASP | Open Web Application Security Project |
| PTES | Penetration Testing Execution Standard |
| RAG | Retrieval-Augmented Generation |
| RE | Reverse Engineering |
| REST | Representational State Transfer — API architectural style |
| RMI | Remote Method Invocation (Java) |
| ROE | Rules of Engagement — authorized scope and constraints for an operation |
| RPM | Requests Per Minute |
| SAST | Static Application Security Testing |
| SHA | Secure Hash Algorithm |
| SOW | Statement of Work |
| SQL | Structured Query Language |
| SQLi | SQL Injection — class of injection vulnerability |
| SSH | Secure Shell Protocol |
| SSL/TLS | Secure Sockets Layer / Transport Layer Security |
| SSTI | Server-Side Template Injection |
| TCP | Transmission Control Protocol |
| tmpfs | Temporary File System — RAM-backed filesystem (Linux) |
| UDP | User Datagram Protocol |
| UUID | Universally Unique Identifier |
| VPN | Virtual Private Network |
| WAF | Web Application Firewall |
| WSTG | OWASP Web Security Testing Guide |
| XXE | XML External Entity injection |
| XSS | Cross-Site Scripting |
| Zod | TypeScript-first schema validation library |

---

*End of Specification Annex — NATT-SPEC-ANNEX-001 v1.0.0*
