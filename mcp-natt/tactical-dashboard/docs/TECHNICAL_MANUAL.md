# NATT Tactical Dashboard — Technical & Maintenance Manual

**Classification:** SENSITIVE  
**Version:** 1.0.0  
**Date:** 2026-02-24  
**System:** NATT MCP Server + Tactical Dashboard  
**Maintainer:** Tolani Labs / NATT Development Team

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [System Architecture](#2-system-architecture)
3. [File Structure Reference](#3-file-structure-reference)
4. [API Reference](#4-api-reference)
5. [MCP Handler Reference](#5-mcp-handler-reference)
6. [Memory System](#6-memory-system)
7. [Deployment Configurations](#7-deployment-configurations)
8. [Maintenance Procedures](#8-maintenance-procedures)
9. [Troubleshooting](#9-troubleshooting)
10. [Security Hardening](#10-security-hardening)

---

## 1. System Overview

NATT (Network Attack & Tactics Toolkit) Tactical Dashboard is a self-hosted, offline-capable security knowledge and operations platform. It exposes 37+ security tools via a Model Context Protocol (MCP) server, a REST API layer, and a static browser dashboard. The system persists operational memory in local JSON files and supports after-action review (AAR) machine learning weight adaptation.

**Design Goals:**
- Operate fully offline on edge hardware (Raspberry Pi 4, Android/Termux, laptops)
- Expose security knowledge without requiring cloud connectivity
- Store operational artifacts locally with no external telemetry
- Support AI agent tool-use via MCP protocol

---

## 2. System Architecture

### 2.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        OPERATOR DEVICES                             │
│                 Browser / AI Agent / CLI Client                     │
└────────────────────────┬────────────────────────────────────────────┘
                         │ HTTP / WebSocket
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    EXPRESS API SERVER                               │
│               (tactical-dashboard/server.js)                       │
│                                                                     │
│  Routes:                                                            │
│  GET  /api/health       GET  /api/vault                            │
│  GET  /api/aar          GET  /api/weights                          │
│  POST /api/feedback     POST /api/panic                            │
│  POST /api/tool/:name   GET  /                (static UI)          │
└────────────────────────┬────────────────────────────────────────────┘
                         │ Internal function calls
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     MCP HANDLER LAYER                               │
│                    (mcp-natt/src/index.ts)                          │
│                                                                     │
│  Tool Registry → 37 named handlers                                 │
│  Input validation → Zod schemas                                    │
│  Knowledge base calls → knowledge.ts                               │
│  Memory read/write → .natt-memory/                                 │
└────────┬──────────────────────────────────┬────────────────────────┘
         │                                  │
         ▼                                  ▼
┌─────────────────┐               ┌─────────────────────────────────┐
│  knowledge.ts   │               │       .natt-memory/             │
│                 │               │                                 │
│  Static lookup  │               │  password-vault.json            │
│  tables for:    │               │  aar-history.json               │
│  - hashes       │               │  algorithm-weights.json         │
│  - CVEs         │               │  feedback-log.json              │
│  - JWT attacks  │               └─────────────────────────────────┘
│  - VPN data     │
│  - ROE templates│
│  - credentials  │
└─────────────────┘
```

### 2.2 Data Flow

```
[Browser / AI Client]
        │
        │  1. HTTP Request  (GET /api/tool/:name  or  POST /api/tool/:name)
        ▼
[Express Router — server.js]
        │
        │  2. Route matched → middleware chain
        │     a. Body parsing (express.json)
        │     b. CORS headers
        │     c. Rate limit check (in-memory, per-IP)
        ▼
[Tool Dispatcher]
        │
        │  3. Look up tool name in registry
        │  4. Validate input args against tool schema
        ▼
[MCP Handler — index.ts]
        │
        │  5. Execute handler function
        │  6. Query knowledge.ts for static data
        │     OR read/write .natt-memory/ files
        ▼
[Response Serializer]
        │
        │  7. Wrap result: { success: true, tool, result, timestamp }
        │  8. Return JSON to caller
        ▼
[Browser / AI Client]
        │
        │  9. Dashboard renders result in tool output panel
        │     OR AI agent processes tool response
```

### 2.3 MCP Protocol Flow (AI Agent Mode)

```
[Claude / AI Agent]
     │
     │  MCP JSON-RPC 2.0 over stdio or SSE
     ▼
[MCP Server — index.ts]
     │
     │  tools/list  →  returns manifest of 37 tools with schemas
     │  tools/call  →  executes named tool, returns content[]
     ▼
[Same handler layer as REST API]
```

---

## 3. File Structure Reference

```
mcp-natt/
├── package.json                    # Node.js dependencies and scripts
├── tsconfig.json                   # TypeScript compiler config (ESM, strict)
├── README.md                       # Quick-start documentation
├── src/
│   ├── index.ts                    # MCP server entry point + all 37 tool handlers
│   ├── knowledge.ts                # Static security knowledge database
│   └── formatters.ts               # Output formatting utilities
├── tactical-dashboard/
│   ├── server.js                   # Express REST API server
│   ├── package.json                # Dashboard server dependencies
│   ├── public/                     # Static frontend assets
│   │   ├── index.html              # Main dashboard UI
│   │   ├── app.js                  # Frontend JavaScript
│   │   └── styles.css              # Dashboard styles
│   └── docs/                       # This documentation suite
│       ├── USER_GUIDE.md
│       ├── FAQ.md
│       ├── QUICK_START.md
│       ├── TECHNICAL_MANUAL.md     # ← This file
│       ├── SPECIFICATION_ANNEX.md
│       ├── BUSINESS_REQUIREMENTS.md
│       └── MAINTENANCE_CHECKLIST.md
├── .natt-memory/                   # Operational memory (auto-created)
│   ├── password-vault.json         # Encrypted password store
│   ├── aar-history.json            # After-action review history
│   ├── algorithm-weights.json      # ML weight adaptation data
│   └── feedback-log.json           # User feedback entries
└── dist/                           # Compiled TypeScript output
    ├── index.js
    ├── knowledge.js
    └── formatters.js
```

---

## 4. API Reference

All API endpoints are served on the configured port (default: **3000**).  
Base URL: `http://localhost:3000`

Content-Type for all requests and responses: `application/json`

---

### 4.1 GET /api/health

Returns system health status including memory file availability and uptime.

**Request:** No body required.

**Response Schema:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-24T12:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "memory": {
    "vault": true,
    "aar": true,
    "weights": true,
    "feedback": true
  },
  "toolCount": 37,
  "environment": "production"
}
```

| Field | Type | Description |
|-------|------|-------------|
| status | string | "ok" or "degraded" |
| timestamp | ISO8601 | Server time at request |
| uptime | number | Process uptime in seconds |
| version | string | Dashboard server version |
| memory.vault | boolean | password-vault.json readable |
| memory.aar | boolean | aar-history.json readable |
| memory.weights | boolean | algorithm-weights.json readable |
| memory.feedback | boolean | feedback-log.json readable |
| toolCount | number | Number of registered MCP tools |
| environment | string | "production" or "development" |

**Error Response (500):**
```json
{ "status": "error", "message": "Health check failed", "detail": "..." }
```

---

### 4.2 GET /api/vault

Returns all entries from the password vault memory file.

**Request:** No body required.

**Response Schema:**
```json
{
  "success": true,
  "count": 3,
  "entries": [
    {
      "id": "uuid-v4",
      "label": "Target SSH Gateway",
      "password": "P@ssw0rd!",
      "strength": "strong",
      "tags": ["ssh", "linux"],
      "createdAt": "2026-02-24T10:00:00.000Z",
      "lastUsed": "2026-02-24T11:30:00.000Z",
      "notes": "Port 2222"
    }
  ]
}
```

**Error Response (500):**
```json
{ "success": false, "error": "Could not read vault" }
```

---

### 4.3 GET /api/aar

Returns all after-action review entries.

**Response Schema:**
```json
{
  "success": true,
  "count": 5,
  "entries": [
    {
      "id": "uuid-v4",
      "missionId": "OP-2026-001",
      "date": "2026-02-24T09:00:00.000Z",
      "objective": "Web application penetration test",
      "outcome": "success",
      "toolsUsed": ["identify_hash", "get_dast_profile"],
      "lessonsLearned": "Rate limiting bypassed via header rotation",
      "recommendations": "Add IP rotation to standard DAST profile",
      "operator": "T.Hines",
      "classification": "SENSITIVE"
    }
  ]
}
```

---

### 4.4 GET /api/weights

Returns the current algorithm learning weights.

**Response Schema:**
```json
{
  "success": true,
  "weights": {
    "tool_effectiveness": {
      "identify_hash": 0.87,
      "get_dast_profile": 0.92,
      "get_password_attacks": 0.78
    },
    "context_modifiers": {
      "web_application": 1.2,
      "network_infrastructure": 0.95,
      "mobile": 1.05
    },
    "last_updated": "2026-02-24T08:00:00.000Z",
    "total_aar_samples": 42
  }
}
```

---

### 4.5 POST /api/feedback

Submits operator feedback for a tool invocation. Used to update learning weights.

**Request Schema:**
```json
{
  "toolName": "identify_hash",
  "rating": 5,
  "comment": "Correctly identified bcrypt hash in under 1 second",
  "missionContext": "credential-audit",
  "timestamp": "2026-02-24T12:00:00.000Z"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| toolName | string | Yes | Must match registered tool name |
| rating | number | Yes | 1–5 integer |
| comment | string | No | Max 500 chars |
| missionContext | string | No | Max 100 chars |
| timestamp | ISO8601 | No | Defaults to server time |

**Response Schema:**
```json
{
  "success": true,
  "feedbackId": "uuid-v4",
  "message": "Feedback recorded. Weights will update on next AAR submission."
}
```

**Error Response (400):**
```json
{ "success": false, "error": "Invalid rating. Must be 1–5." }
```

---

### 4.6 POST /api/panic

**⚠ DESTRUCTIVE OPERATION — IRREVERSIBLE WITHOUT BACKUP ⚠**

Wipes all .natt-memory/ files. Use in emergency sanitize scenarios (e.g., imminent device seizure).

**Request Schema:**
```json
{
  "confirm": "WIPE-ALL-MEMORY",
  "reason": "device-compromise",
  "operator": "T.Hines"
}
```

The `confirm` field must be exactly the string `"WIPE-ALL-MEMORY"`. Any other value returns 400.

**Response Schema (success):**
```json
{
  "success": true,
  "wiped": ["password-vault.json", "aar-history.json", "algorithm-weights.json", "feedback-log.json"],
  "timestamp": "2026-02-24T12:05:00.000Z",
  "auditEntry": "uuid-v4"
}
```

**Response Schema (error — wrong confirm string):**
```json
{ "success": false, "error": "Panic not confirmed. Send confirm: 'WIPE-ALL-MEMORY'" }
```

**Warning:** This endpoint has no authentication beyond the confirmation string. Ensure network access to the dashboard is restricted to localhost or a trusted interface.

---

### 4.7 POST /api/tool/:name

Executes a named MCP tool via the REST API.

**URL Parameter:** `:name` — tool name from the registry (e.g., `identify_hash`)

**Request Schema:**
```json
{
  "args": {
    "hash": "5f4dcc3b5aa765d61d8327deb882cf99"
  }
}
```

The `args` object structure varies per tool. See Section 5 (MCP Handler Reference) for each tool's argument schema.

**Success Response:**
```json
{
  "success": true,
  "tool": "identify_hash",
  "result": { ... },
  "timestamp": "2026-02-24T12:00:00.000Z",
  "executionMs": 12
}
```

**Error Codes:**

| HTTP Code | Condition |
|-----------|-----------|
| 400 | Missing or invalid args |
| 404 | Tool name not found in registry |
| 422 | Args failed schema validation |
| 429 | Rate limit exceeded (60 req/min default) |
| 500 | Handler threw unexpected error |

**Security Validation:** All `:name` parameters are sanitized. Path traversal characters, null bytes, and shell metacharacters are rejected with 400.

---

## 5. MCP Handler Reference

All 37 tools are registered with the MCP server and callable via either the MCP stdio protocol or the REST API.

### 5.1 Complete Tool Registry

| # | Tool Name | Category | Description | Required Args | Optional Args |
|---|-----------|----------|-------------|---------------|---------------|
| 1 | `validate_roe_checklist` | ROE | Validates engagement parameters against ROE checklist | `scope`, `authorization` | `targetType`, `timeWindow` |
| 2 | `get_roe_template` | ROE | Returns a blank ROE template for a given engagement type | `engagementType` | `classification` |
| 3 | `get_mission_guidance` | Planning | Returns tactical guidance for a specific mission type | `missionType` | `environment`, `constraints` |
| 4 | `identify_hash` | Crypto | Identifies hash algorithm from hash string | `hash` | `context` |
| 5 | `get_password_attacks` | Auth | Returns password attack techniques for a target context | `targetType` | `protections`, `context` |
| 6 | `get_auth_bypass_techniques` | Auth | Returns authentication bypass techniques | `authType` | `platform`, `version` |
| 7 | `get_secret_patterns` | Recon | Returns regex patterns for secret discovery | `secretType` | `fileType` |
| 8 | `scan_for_secrets` | Recon | Analyzes provided text/content for embedded secrets | `content` | `context`, `reportFormat` |
| 9 | `get_default_credentials` | Auth | Returns known default credentials for a vendor/product | `vendor` | `product`, `version` |
| 10 | `get_reverse_engineering_guidance` | RE | Returns guidance for reverse engineering a binary/format | `target` | `platform`, `toolchain` |
| 11 | `generate_password` | Vault | Generates a password meeting specified criteria | `length` | `complexity`, `avoid`, `prefix` |
| 12 | `get_vulnerability_info` | Intel | Returns vulnerability information by CVE or description | `query` | `severity`, `ecosystem` |
| 13 | `get_dast_profile` | DAST | Returns a DAST scan profile for a target type | `targetType` | `depth`, `auth` |
| 14 | `get_compliance_mapping` | GRC | Maps a control to compliance frameworks | `control` | `frameworks` |
| 15 | `get_bug_bounty_guidance` | BugBounty | Returns bug bounty program guidance | `programType` | `platform`, `scope` |
| 16 | `get_devsecops_guidance` | DevSecOps | Returns DevSecOps pipeline integration guidance | `stage` | `platform`, `language` |
| 17 | `get_pentest_methodology` | Methodology | Returns methodology steps for a pentest phase | `phase` | `targetType`, `depth` |
| 18 | `get_scraper_pattern` | Recon | Returns web scraping patterns for a target type | `targetType` | `anti_bot`, `format` |
| 19 | `get_defense_playbook` | Blue Team | Returns defensive playbook for a threat scenario | `threat` | `environment`, `maturity` |
| 20 | `get_platform_defense` | Blue Team | Returns platform-specific hardening guidance | `platform` | `version`, `role` |
| 21 | `get_content_integrity` | Integrity | Returns content integrity verification techniques | `contentType` | `algorithm`, `context` |
| 22 | `decode_jwt` | JWT | Decodes a JWT without verification | `token` | `showHeader`, `showPayload` |
| 23 | `get_jwt_attack` | JWT | Returns JWT attack techniques | `attackType` | `algorithm`, `context` |
| 24 | `get_jwt_defense` | JWT | Returns JWT defense recommendations | `context` | `algorithm`, `framework` |
| 25 | `analyze_jwt_config` | JWT | Analyzes a JWT configuration for vulnerabilities | `config` | `strict` |
| 26 | `get_jwt_library_vulns` | JWT | Returns known vulnerabilities for JWT libraries | `library` | `version`, `language` |
| 27 | `get_vpn_protocol` | VPN | Returns details on a VPN protocol | `protocol` | `useCase`, `context` |
| 28 | `get_vpn_leak` | VPN | Returns VPN leak detection techniques | `leakType` | `platform`, `protocol` |
| 29 | `get_vpn_defense` | VPN | Returns VPN hardening and defense techniques | `context` | `platform`, `provider` |
| 30 | `get_vpn_provider` | VPN | Returns analysis of a VPN provider | `provider` | `useCase`, `jurisdiction` |
| 31 | `analyze_vpn_config` | VPN | Analyzes a VPN config file for security issues | `config` | `protocol`, `strict` |
| 32 | `analyze_ip_reputation` | Intel | Analyzes IP address characteristics | `ip` | `context`, `enrichment` |
| 33 | `build_operational_config` | Ops | Builds an operational configuration template | `operationType` | `environment`, `constraints` |
| 34 | `submit_aar` | Memory | Submits an after-action review to memory | `missionId`, `outcome`, `toolsUsed` | `lessons`, `recommendations`, `operator` |
| 35 | `get_algorithm_weights` | Memory | Returns current learning algorithm weights | _(none)_ | `category` |
| 36 | `store_generated_password` | Vault | Stores a generated password in vault | `label`, `password` | `tags`, `notes` |
| 37 | `get_top_passwords` | Vault | Returns most-used/strongest vault entries | _(none)_ | `limit`, `filter` |
| 38 | `run_e2e_simulation` | Simulation | Runs an end-to-end engagement simulation | `scenario` | `depth`, `reportFormat` |

### 5.2 Tool Detail: validate_roe_checklist

**Purpose:** Validates planned engagement parameters against a rules-of-engagement checklist to ensure legal and operational compliance.

**Input Schema:**
```typescript
{
  scope: string;          // IP ranges, domains, or asset list
  authorization: string;  // Authorization document reference or summary
  targetType?: string;    // "web" | "network" | "mobile" | "social"
  timeWindow?: string;    // Authorized testing window (e.g., "Sat 02:00–06:00 UTC")
}
```

**Output:** Checklist with pass/fail for each ROE criterion plus recommendations.

### 5.3 Tool Detail: identify_hash

**Purpose:** Identifies the cryptographic hash algorithm used to produce a given hash string.

**Input Schema:**
```typescript
{
  hash: string;     // The hash value to identify
  context?: string; // Additional context (e.g., "from /etc/shadow")
}
```

**Detection Logic:** Length-based primary detection + character set validation + context-aware disambiguation.

**Output Example:**
```json
{
  "hash": "5f4dcc3b5aa765d61d8327deb882cf99",
  "identified": "MD5",
  "confidence": "high",
  "length": 32,
  "charset": "hex",
  "crackabilityIndex": 9.1,
  "notes": "Common MD5 hash. Rainbow table attack highly effective.",
  "recommendedTools": ["hashcat -m 0", "john --format=raw-md5"]
}
```

### 5.4 Tool Detail: run_e2e_simulation

**Purpose:** Executes a scripted end-to-end engagement simulation that chains multiple tools and produces a structured report.

**Input Schema:**
```typescript
{
  scenario: string;       // Scenario name from: "web-app", "api-gateway", "vpn-bypass", "credential-stuffing"
  depth?: "quick" | "standard" | "deep";
  reportFormat?: "json" | "markdown" | "text";
}
```

**How it works:**
1. Loads the named scenario definition
2. Chains tool calls in sequence (e.g., recon → vulnerability scan → exploitation guidance → defense)
3. Records results at each stage
4. Generates a consolidated report with findings, tool outputs, and recommendations

---

## 6. Memory System

### 6.1 Directory Structure

```
.natt-memory/
├── password-vault.json      # All vault entries
├── aar-history.json         # All AAR submissions
├── algorithm-weights.json   # Learning weights by tool/category
└── feedback-log.json        # Raw feedback entries
```

The `.natt-memory/` directory is created automatically on first write. It should be excluded from version control (add to `.gitignore`).

### 6.2 VaultEntry Schema

```typescript
interface VaultEntry {
  id: string;           // UUID v4
  label: string;        // Human-readable label (max 100 chars)
  password: string;     // The password value (stored in plaintext on disk)
  strength: "weak" | "medium" | "strong" | "very-strong";
  strengthScore: number; // 0–100
  tags: string[];       // Categorization tags
  createdAt: string;    // ISO 8601
  lastUsed: string | null;
  usageCount: number;
  notes: string;        // Free-text notes (max 500 chars)
  generated: boolean;   // true if created by generate_password tool
  operator: string;     // Who stored it
}
```

**password-vault.json structure:**
```json
{
  "version": "1.0",
  "createdAt": "2026-02-24T00:00:00.000Z",
  "lastModified": "2026-02-24T12:00:00.000Z",
  "entries": [ ...VaultEntry[] ]
}
```

⚠️ **Warning:** Passwords are stored in plaintext in `password-vault.json`. Encrypt the file system or the `.natt-memory/` directory at the OS level for sensitive deployments.

### 6.3 AAR Schema

```typescript
interface AAREntry {
  id: string;               // UUID v4
  missionId: string;        // Operator-assigned mission identifier
  date: string;             // ISO 8601
  objective: string;        // Mission objective (max 500 chars)
  outcome: "success" | "partial" | "failure" | "aborted";
  toolsUsed: string[];      // Tool names used during the mission
  toolRatings: Record<string, number>; // Tool name → 1–5 rating
  lessonsLearned: string;   // Free text (max 2000 chars)
  recommendations: string;  // Free text (max 2000 chars)
  operator: string;         // Operator identifier
  classification: "ROUTINE" | "SENSITIVE" | "RESTRICTED";
  environment: string;      // Target environment description
  duration: number;         // Mission duration in minutes
  tags: string[];
}
```

### 6.4 Algorithm Weights Format

```json
{
  "version": "1.0",
  "lastUpdated": "2026-02-24T12:00:00.000Z",
  "sampleCount": 42,
  "toolWeights": {
    "identify_hash": { "effectiveness": 0.87, "usageCount": 23, "avgRating": 4.3 },
    "get_dast_profile": { "effectiveness": 0.92, "usageCount": 18, "avgRating": 4.6 }
  },
  "categoryWeights": {
    "auth": 1.15,
    "jwt": 1.08,
    "vpn": 0.95,
    "recon": 1.02
  },
  "contextModifiers": {
    "web_application": 1.20,
    "network": 0.95,
    "mobile": 1.05,
    "api": 1.12
  }
}
```

**Weight Update Logic:** After each AAR submission, weights are recalculated using an exponential moving average (α = 0.1) weighted by mission outcome:
- success → full weight contribution
- partial → 0.5 weight contribution
- failure → 0.1 weight contribution (negative feedback)
- aborted → 0 weight contribution

### 6.5 Feedback Log Format

```json
{
  "version": "1.0",
  "entries": [
    {
      "id": "uuid-v4",
      "toolName": "identify_hash",
      "rating": 5,
      "comment": "Accurate and fast",
      "missionContext": "credential-audit",
      "timestamp": "2026-02-24T12:00:00.000Z",
      "operator": "T.Hines"
    }
  ]
}
```

### 6.6 Backup Procedure

**Manual backup (Linux/Pi):**
```bash
# Create timestamped backup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
tar -czf /backup/natt-memory-${TIMESTAMP}.tar.gz ~/.natt-memory/
echo "Backup created: natt-memory-${TIMESTAMP}.tar.gz"
```

**Automated backup via cron:**
```bash
# Add to crontab (crontab -e)
0 2 * * * tar -czf /backup/natt-memory-$(date +\%Y\%m\%d).tar.gz /home/pi/.natt-memory/ 2>/dev/null
```

**Restore procedure:**
```bash
# Stop the server first
sudo systemctl stop natt-dashboard

# Extract backup
tar -xzf /backup/natt-memory-20260224_020000.tar.gz -C /

# Restart
sudo systemctl start natt-dashboard
```

**Windows backup:**
```powershell
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
Compress-Archive -Path "$env:USERPROFILE\.natt-memory" `
  -DestinationPath "C:\Backup\natt-memory-$ts.zip"
```

---

## 7. Deployment Configurations

### 7.1 Raspberry Pi 4 (Recommended Full Setup)

**Requirements:** Raspberry Pi 4 (2GB+ RAM), Raspberry Pi OS Lite (64-bit), Node.js 22+, 16GB+ SD card

**Step 1: System Preparation**
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential

# Install Node.js 22 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Should be v22.x.x
```

**Step 2: Clone and Build**
```bash
cd /home/pi
git clone https://github.com/tolani-corp/devbot.git
cd devbot/mcp-natt
npm install
npm run build

cd tactical-dashboard
npm install
```

**Step 3: Create Memory Directory**
```bash
mkdir -p /home/pi/.natt-memory
chmod 700 /home/pi/.natt-memory
```

**Step 4: systemd Service**

Create `/etc/systemd/system/natt-dashboard.service`:
```ini
[Unit]
Description=NATT Tactical Dashboard
After=network.target
StartLimitIntervalSec=0

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/devbot/mcp-natt/tactical-dashboard
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=NATT_MEMORY_DIR=/home/pi/.natt-memory
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=natt-dashboard

[Install]
WantedBy=multi-user.target
```

**Enable and Start:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable natt-dashboard
sudo systemctl start natt-dashboard
sudo systemctl status natt-dashboard
```

**Step 5: Firewall (restrict to local network only)**
```bash
sudo apt install -y ufw
sudo ufw default deny incoming
sudo ufw allow ssh
sudo ufw allow from 192.168.1.0/24 to any port 3000
sudo ufw enable
```

**Step 6: Verify**
```bash
curl http://localhost:3000/api/health | python3 -m json.tool
```

---

### 7.2 Headless Pi via SSH

After Wi-Fi/SSH is configured on the Pi:
```bash
# On your laptop:
ssh pi@<pi-ip-address>

# Forward dashboard port to your laptop:
ssh -L 3000:localhost:3000 pi@<pi-ip-address>

# Now open http://localhost:3000 in your laptop's browser
```

For a static IP on the Pi:
```bash
# Edit /etc/dhcpcd.conf
sudo nano /etc/dhcpcd.conf

# Add at the bottom:
interface wlan0
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=1.1.1.1 8.8.8.8
```

---

### 7.3 Android via Termux

**Step 1: Install Termux from F-Droid (not Google Play)**

**Step 2: Setup**
```bash
pkg update && pkg upgrade -y
pkg install -y nodejs git

# Create memory directory
mkdir -p ~/.natt-memory
chmod 700 ~/.natt-memory

# Clone repo
git clone https://github.com/tolani-corp/devbot.git
cd devbot/mcp-natt
npm install
npm run build

cd tactical-dashboard
npm install
```

**Step 3: Start Server**
```bash
PORT=3000 node server.js &
```

**Step 4: Access Dashboard**

Open Android browser and navigate to `http://localhost:3000`

**Keep Alive (Termux):**
```bash
# Install Termux:Boot from F-Droid
# Create ~/.termux/boot/start-natt.sh:
#!/data/data/com.termux/files/usr/bin/bash
cd ~/devbot/mcp-natt/tactical-dashboard
PORT=3000 node server.js &
```

---

### 7.4 Windows/macOS Laptop

**Windows:**
```powershell
# Install Node.js 22 from https://nodejs.org
# Then in PowerShell:
cd C:\Users\<user>\devbot\mcp-natt
npm install
npm run build

cd tactical-dashboard
npm install

# Create memory directory
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.natt-memory"

# Start server
$env:PORT = "3000"
$env:NATT_MEMORY_DIR = "$env:USERPROFILE\.natt-memory"
node server.js
```

**macOS:**
```bash
brew install node@22
cd ~/devbot/mcp-natt
npm install && npm run build
cd tactical-dashboard && npm install
mkdir -p ~/.natt-memory && chmod 700 ~/.natt-memory
PORT=3000 node server.js
```

---

### 7.5 Docker Container

**Dockerfile** (place at `mcp-natt/tactical-dashboard/Dockerfile`):
```dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

# Copy MCP source and build
COPY ../package.json ../tsconfig.json ./mcp/
COPY ../src ./mcp/src/
RUN cd mcp && npm install && npm run build

# Copy dashboard
COPY package.json ./
RUN npm install --production

COPY public ./public
COPY server.js ./

# Runtime stage
FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY server.js ./
COPY --from=builder /app/mcp/dist ./mcp-dist/

RUN mkdir -p /data/.natt-memory && chmod 700 /data/.natt-memory

ENV NODE_ENV=production
ENV PORT=3000
ENV NATT_MEMORY_DIR=/data/.natt-memory

EXPOSE 3000

VOLUME ["/data/.natt-memory"]

CMD ["node", "server.js"]
```

**Build and Run:**
```bash
docker build -t natt-dashboard .
docker run -d \
  --name natt \
  -p 3000:3000 \
  -v natt-memory:/data/.natt-memory \
  natt-dashboard

# View logs
docker logs -f natt

# Health check
curl http://localhost:3000/api/health
```

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  natt-dashboard:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - natt-memory:/data/.natt-memory
    environment:
      - NODE_ENV=production
      - PORT=3000
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  natt-memory:
    driver: local
```

---

## 8. Maintenance Procedures

### 8.1 Regular Backup Procedure

Backups should be performed:
- Daily (automated, via cron)
- Before any update
- After any significant operation (AAR submission)
- Before deploying to a new environment

**Backup script (`/opt/natt/backup.sh`):**
```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/backup/natt"
MEMORY_DIR="${NATT_MEMORY_DIR:-$HOME/.natt-memory}"
MAX_BACKUPS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Create backup
tar -czf "$BACKUP_DIR/natt-memory-${TIMESTAMP}.tar.gz" "$MEMORY_DIR"

# Prune old backups (keep last 30)
ls -t "$BACKUP_DIR"/natt-memory-*.tar.gz | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm

echo "[$(date)] Backup complete: natt-memory-${TIMESTAMP}.tar.gz"
```

### 8.2 Log Rotation

The systemd journal handles log rotation automatically. To view logs:
```bash
# Last 100 lines
journalctl -u natt-dashboard -n 100

# Follow live
journalctl -u natt-dashboard -f

# Last 24 hours
journalctl -u natt-dashboard --since "24 hours ago"
```

For manual log files, add logrotate config at `/etc/logrotate.d/natt-dashboard`:
```
/var/log/natt-dashboard.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
    sharedscripts
    postrotate
        systemctl reload natt-dashboard 2>/dev/null || true
    endscript
}
```

### 8.3 Dependency Updates

```bash
# Check for outdated packages
cd /home/pi/devbot/mcp-natt
npm outdated
cd tactical-dashboard
npm outdated

# Update all packages (test first)
npm update

# For major version updates, pin and test manually
npm install @anthropic-ai/sdk@latest --save-exact

# After updates: rebuild TypeScript and restart
cd ..
npm run build
sudo systemctl restart natt-dashboard
```

### 8.4 Security Audit Checklist

Run this checklist monthly or after any update:

```
[ ] npm audit — no high/critical vulnerabilities
[ ] Check .natt-memory/ permissions are 700 (not world-readable)
[ ] Verify firewall rules: port 3000 not exposed to internet
[ ] Review feedback-log.json for anomalous entries
[ ] Check AAR history for unauthorized operationIDs
[ ] Rotate any passwords stored in vault older than 90 days
[ ] Verify Node.js version is still under active support
[ ] Check systemd service is running as unprivileged user (not root)
[ ] Review server.js rate limiting config — still appropriate?
[ ] Confirm NATT_MEMORY_DIR is not on a network share
```

### 8.5 Performance Tuning

**Pi 4 memory optimization:**
```bash
# Set Node.js heap size (default is ~512MB on 32-bit or ~1.5GB on 64-bit)
# Add to systemd service Environment:
Environment=NODE_OPTIONS=--max-old-space-size=256

# If running headless, disable GUI memory allocation:
sudo raspi-config  # Advanced → GPU Memory → set to 16
```

**JSON file size management:**
- AAR history: Archive entries older than 90 days to `aar-history-archive-YYYY.json`
- Feedback log: Compact to aggregated weights after processing
- Vault: No automated pruning — requires manual review

**Response time targets:**
- Health check: < 50ms
- Tool invocation (static data): < 100ms
- Tool invocation (memory read/write): < 200ms
- E2E simulation (deep): < 5000ms

---

## 9. Troubleshooting

### 9.1 Server Won't Start

```bash
# Check for port conflict
sudo ss -tlnp | grep 3000

# Check Node version
node --version  # Must be 18+

# Check for syntax errors
node --check server.js

# View systemd failure reason
journalctl -u natt-dashboard -n 50 --no-pager
```

### 9.2 Memory Files Corrupted

```bash
# Validate JSON
node -e "JSON.parse(require('fs').readFileSync('.natt-memory/password-vault.json', 'utf8'))"

# If corrupted, restore from backup
sudo systemctl stop natt-dashboard
cp /backup/natt/natt-memory-LATEST.tar.gz /tmp/
tar -xzf /tmp/natt-memory-LATEST.tar.gz -C /
sudo systemctl start natt-dashboard
```

### 9.3 Tools Returning Empty Results

1. Verify the tool name is correct (check tool registry table)
2. Verify required args are provided
3. Check server logs for validation errors
4. Test via curl: `curl -X POST http://localhost:3000/api/tool/identify_hash -H 'Content-Type: application/json' -d '{"args":{"hash":"test"}}'`

### 9.4 Dashboard Not Loading in Browser

1. Confirm server is running: `curl http://localhost:3000/api/health`
2. Check if `public/index.html` exists
3. Verify PORT environment variable matches what you're connecting to
4. On Pi: ensure same network segment for CORS

---

## 10. Security Hardening

### 10.1 Network Isolation

```bash
# Bind to localhost only (add to server.js or env)
HOST=127.0.0.1 PORT=3000 node server.js

# Or use SSH tunnel exclusively for remote access
ssh -L 3000:127.0.0.1:3000 pi@192.168.1.100
```

### 10.2 File System Encryption

```bash
# Encrypt .natt-memory using GPG on export
tar -cz ~/.natt-memory | gpg --symmetric --cipher-algo AES256 > natt-backup.tar.gz.gpg

# Decrypt
gpg --decrypt natt-backup.tar.gz.gpg | tar -xz
```

### 10.3 Panic Button Integration

For field operations, create a quick-wipe alias:
```bash
# Add to ~/.bashrc or ~/.zshrc
alias natt-panic='curl -s -X POST http://localhost:3000/api/panic \
  -H "Content-Type: application/json" \
  -d "{\"confirm\":\"WIPE-ALL-MEMORY\",\"reason\":\"field-sanitize\"}" | jq .'
```

### 10.4 Minimal Footprint Deployment

For high-security field deployments:
1. Run on tmpfs (RAM disk) — all data lost on power off
2. No persistent storage for .natt-memory
3. Disable AAR/vault features if not needed
4. Use `--no-persist` flag (if implemented) to disable all disk writes

---

*End of Technical Manual — Version 1.0.0*
