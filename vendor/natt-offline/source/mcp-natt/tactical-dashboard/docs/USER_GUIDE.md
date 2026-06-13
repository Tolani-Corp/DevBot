# NATT Tactical Dashboard — User Guide

> **NATT** — Network Attack & Testing Toolkit  
> Dashboard Version: 1.0 | MCP Server: 35+ Tools | Port: 7474

---

## Table of Contents

1. [Overview](#1-overview)
2. [System Requirements](#2-system-requirements)
3. [Quick Start](#3-quick-start)
4. [Dashboard Navigation](#4-dashboard-navigation)
5. [STATUS Tab](#5-status-tab)
6. [OPS Tab — All Tools Reference](#6-ops-tab--all-tools-reference)
7. [VAULT Tab — Password Manager](#7-vault-tab--password-manager)
8. [INTEL Tab — Algorithm Weights & AARs](#8-intel-tab--algorithm-weights--aars)
9. [SURVIVAL Tab — Offline Guide](#9-survival-tab--offline-guide)
10. [PANIC Button](#10-panic-button)
11. [Feedback System & CLLM Learning](#11-feedback-system--cllm-learning)
12. [Offline Usage](#12-offline-usage)
13. [Updating the System](#13-updating-the-system)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Overview

### What Is NATT Tactical Mode?

NATT (Network Attack & Testing Toolkit) Tactical Mode is a self-hosted, offline-capable security operations dashboard designed to run on resource-constrained hardware — including Raspberry Pi 4, Android phones (via Termux), iOS devices (via iSH), and standard laptops.

It combines:

- **A Node.js MCP server** (`mcp-natt/`) exposing 35+ security knowledge tools via the Model Context Protocol, making them available to Claude and other AI assistants
- **A lightweight Express web dashboard** (`tactical-dashboard/`) accessible at `http://localhost:7474` (or your Pi's LAN IP)
- **A password vault** with tagging, labeling, and filtering
- **After Action Reports (AAR)** feeding a Continuous Learning Loop Model (CLLM) that improves tool responses over time
- **An E2E simulation engine** for testing tool chains without live targets
- **An offline survival guide** covering field procedures, protocols, and checklists

### Who Is This For?

- Penetration testers operating in air-gapped or low-connectivity environments
- Red team operators running field assessments
- Security researchers who want a portable, self-contained AI-assisted toolkit
- CTF competitors who benefit from structured knowledge retrieval
- Students learning offensive and defensive security fundamentals

### Design Philosophy

The dashboard is intentionally minimal. It renders fast on low-power hardware, uses no heavy frameworks, and stores all data locally. Nothing is phoned home. No cloud account is required. No API keys expire in the field.

---

## 2. System Requirements

### Hardware

| Device | Minimum | Recommended |
|--------|---------|-------------|
| Raspberry Pi | Pi 4 2GB RAM | Pi 4 4GB RAM |
| Android Phone | Android 9, 2GB RAM, Termux | Android 11+, 3GB RAM |
| iOS Device | iOS 14, iSH installed | iOS 16+, iPad preferred |
| Laptop/Desktop | Any x86-64, 2GB RAM | 4GB+ RAM, SSD |
| SD Card (Pi) | Class 10, 16GB | A2 rated, 32GB+ |

### Software

| Dependency | Minimum Version | Notes |
|------------|----------------|-------|
| Node.js | 18.0.0 | LTS recommended; 20+ for best performance |
| npm / pnpm | npm 9+ or pnpm 8+ | pnpm is preferred for speed |
| Git | 2.30+ | Required for updates |
| Storage | 500MB available | 1GB+ recommended for AAR history |
| OS | Linux / macOS / Windows WSL2 | Native Windows supported but slower |

### Network (Optional)

- Dashboard runs **fully offline** once installed
- LAN access: any device on the same Wi-Fi or wired network can connect via the Pi's IP
- No internet required after `npm install`

---

## 3. Quick Start

Follow these 5 steps to go from zero to a fully operational dashboard.

### Step 1 — Clone the Repository

```bash
git clone https://github.com/your-org/devbot.git
cd devbot/mcp-natt
```

### Step 2 — Install Dependencies

```bash
npm install
# or if using pnpm:
pnpm install
```

This installs the MCP server dependencies AND the tactical dashboard dependencies in one pass. Expected time: 30–90 seconds on a Pi 4, 5–15 seconds on a modern laptop.

### Step 3 — Build the MCP Server

```bash
npm run build
```

This compiles TypeScript to JavaScript in `dist/`. Required before the server or dashboard can start.

### Step 4 — Start the Dashboard

```bash
npm run dashboard
```

You should see:

```
[NATT] Tactical Dashboard running at http://localhost:7474
[NATT] MCP server tools loaded: 35
[NATT] Vault initialized (0 entries)
[NATT] Survival guide: 847 entries indexed
```

### Step 5 — Open the Dashboard

Open a browser and navigate to:

```
http://localhost:7474
```

If accessing from another device on the LAN:

```
http://<pi-ip-address>:7474
```

To find your Pi's IP address:
```bash
hostname -I | awk '{print $1}'
```

You're operational. The STATUS tab should show all systems green.

---

## 4. Dashboard Navigation

The dashboard has **5 tabs** visible in the top navigation bar:

```
[ STATUS ] [ OPS ] [ VAULT ] [ INTEL ] [ SURVIVAL ]
```

### Tab Summary

| Tab | Purpose | Key Features |
|-----|---------|--------------|
| STATUS | System health overview | Server uptime, tool count, vault stats, network info |
| OPS | Run security tools | 35+ tools organized by category, input forms, output viewer |
| VAULT | Password manager | Store, tag, label, filter, copy credentials |
| INTEL | Learning and analysis | AAR history, CLLM weights, algorithm performance |
| SURVIVAL | Offline reference | Full-text search, categorized survival procedures |

### Navigation Behavior

- All navigation is **client-side** — no page reloads
- Active tab is highlighted with a green border
- Tab state is preserved during the session (returning to OPS keeps your last tool open)
- Keyboard shortcut: `Alt+1` through `Alt+5` switches tabs

---

## 5. STATUS Tab

The STATUS tab is your operational health dashboard. Load it first to confirm all systems are ready before starting an engagement.

### Status Cards

**MCP Server Status**
- Shows: `ONLINE` (green) or `OFFLINE` (red)
- If offline: the dashboard is still usable in limited mode, but tools will return cached/simulated results

**Tools Loaded**
- The count of MCP tools currently registered (should be 35+)
- Click to expand the full tool manifest

**Vault Entries**
- Count of stored credentials
- Last modified timestamp

**Survival Guide**
- Entry count from the indexed guide
- Index build date

**Node.js Version**
- Running version vs minimum required
- Warns if below Node 18

**System Memory**
- Available vs total RAM
- Warns if available < 256MB (critical threshold for Pi)

**Uptime**
- Dashboard process uptime
- Restarts automatically tracked

### Network Info Panel

Displays:
- Local IP address (clickable to copy)
- LAN access URL for sharing with other devices
- Port 7474 status (open/closed to LAN)

---

## 6. OPS Tab — All Tools Reference

The OPS tab is the core of the tactical dashboard. Tools are grouped into **6 categories** in the sidebar.

### How to Use a Tool

1. Click a category in the left sidebar to expand it
2. Click a tool name to load its input form
3. Fill in the required fields (marked with `*`)
4. Click **Run** or press `Ctrl+Enter`
5. Results appear in the right panel with syntax highlighting
6. Use the thumbs up/down buttons to submit feedback (affects CLLM)

---

### Category 1: Reconnaissance

#### `subdomain_enum`
Enumerates subdomains for a given domain using wordlist-based DNS brute force.

**Input:**
- `domain *` — e.g., `example.com`
- `wordlist` — leave blank for built-in list (500 entries); can specify `large`, `medium`, `small`
- `timeout` — per-query timeout in ms (default: 2000)

**Example:**
```
domain: target.local
wordlist: large
timeout: 3000
```

**What to look for:** Subdomains resolving to internal IP ranges (10.x, 192.168.x, 172.16–31.x) often indicate internal services exposed by misconfiguration.

---

#### `port_scan_knowledge`
Returns knowledge about common ports, service banners, and detection tips. This is a **knowledge tool** — it does not scan live hosts. Use it to understand what to expect when you run Nmap.

**Input:**
- `port` — single port (e.g., `22`) or range keyword (e.g., `web`, `database`, `ics`)

**What to look for:** Unusual default credentials and known CVEs listed per service.

---

#### `dns_lookup`
Resolves DNS records for a domain (A, AAAA, MX, TXT, NS, CNAME, SOA).

**Input:**
- `domain *` — e.g., `target.com`
- `type` — record type or `ALL`

**What to look for:** SPF/DKIM misconfiguration in TXT records; internal hostnames in MX records.

---

#### `whois_analysis`
Provides WHOIS data interpretation guidance and known registrar patterns.

**Input:**
- `domain *` — target domain

**What to look for:** Registrar privacy services hiding ownership; recently registered domains (< 30 days old) are higher risk.

---

### Category 2: Exploitation Knowledge

#### `validate_roe`
Validates a proposed action against standard Rules of Engagement templates.

**Input:**
- `action *` — e.g., `run sqlmap against 192.168.1.50`
- `roe_type` — `pentest`, `red_team`, `bug_bounty`, `ctf` (default: `pentest`)

**Example:**
```
action: run a SYN flood against the DMZ router
roe_type: pentest
```

**What to look for:** `ALLOWED`, `CAUTION`, `PROHIBITED`, or `REQUIRES_APPROVAL` responses. Never proceed on PROHIBITED actions.

---

#### `exploit_framework_guide`
Returns structured guidance for Metasploit, SQLMap, Hydra, Burp Suite, and other frameworks.

**Input:**
- `tool *` — e.g., `metasploit`, `sqlmap`, `hydra`
- `scenario` — optional context, e.g., `initial access web app`

---

#### `payload_construction_guide`
Explains payload construction techniques for different delivery methods.

**Input:**
- `payload_type *` — e.g., `reverse_shell`, `webshell`, `macro`, `lnk`
- `platform` — `windows`, `linux`, `macos` (default: `linux`)

---

#### `cve_lookup`
Returns structured CVE information, affected versions, and recommended exploit paths.

**Input:**
- `cve_id *` — e.g., `CVE-2021-44228`

**What to look for:** CVSS score, affected versions, proof-of-concept availability flag, patch status.

---

#### `privilege_escalation_paths`
Lists known privilege escalation techniques for a given OS and context.

**Input:**
- `os *` — `windows`, `linux`, `macos`
- `context` — `local`, `docker`, `cloud`, `active_directory`

---

### Category 3: Network Analysis

#### `protocol_analysis`
Explains protocol behavior, common misconfigurations, and intercept techniques.

**Input:**
- `protocol *` — e.g., `http`, `smb`, `ldap`, `kerberos`, `mqtt`

---

#### `traffic_patterns`
Identifies malicious traffic patterns and detection evasion techniques.

**Input:**
- `scenario *` — e.g., `c2 beacon`, `data exfil`, `lateral movement`

---

#### `firewall_bypass`
Documents known firewall bypass techniques and detection signatures.

**Input:**
- `technique` — `fragment`, `tunnel`, `protocol_abuse`, `timing` (default: returns all)

---

### Category 4: Hash & Crypto

#### `identify_hash`
Identifies a hash type by length and character set.

**Input:**
- `hash *` — the hash string to identify

**Example:**
```
hash: 5f4dcc3b5aa765d61d8327deb882cf99
```

**What to look for:** The identified type, likely algorithm, and recommended cracking approach.

---

#### `hash_cracking_guide`
Returns guidance on cracking specific hash types using Hashcat and John the Ripper.

**Input:**
- `hash_type *` — e.g., `md5`, `ntlm`, `bcrypt`, `sha256crypt`
- `mode` — `wordlist`, `brute`, `hybrid`, `rainbow`

---

#### `crypto_weaknesses`
Documents known cryptographic weaknesses in protocols and libraries.

**Input:**
- `algorithm *` — e.g., `rc4`, `des`, `rsa-512`, `md5`

---

### Category 5: Web Application

#### `scan_for_secrets`
Guidance on scanning code repositories and web apps for exposed secrets.

**Input:**
- `target_type *` — `git_repo`, `web_app`, `docker_image`, `s3_bucket`

---

#### `sqli_techniques`
Comprehensive SQL injection technique reference with payloads by database type.

**Input:**
- `db_type *` — `mysql`, `mssql`, `postgresql`, `oracle`, `sqlite`
- `technique` — `error_based`, `blind`, `time_based`, `union` (default: all)

---

#### `xss_vectors`
XSS payload vectors organized by context (HTML, attribute, JavaScript, SVG).

**Input:**
- `context *` — `html`, `attribute`, `js`, `svg`, `css`
- `filter_bypass` — `true`/`false` — include filter bypass variants

---

#### `api_security`
API security testing methodologies and common vulnerabilities.

**Input:**
- `api_type *` — `rest`, `graphql`, `grpc`, `soap`

---

#### `auth_bypass`
Authentication bypass techniques by mechanism type.

**Input:**
- `mechanism *` — `jwt`, `oauth`, `saml`, `basic`, `session`

---

### Category 6: Defense & Hardening

#### `defensive_posture`
Returns hardening recommendations for a given system or service.

**Input:**
- `target *` — e.g., `nginx`, `ssh`, `active_directory`, `kubernetes`
- `level` — `baseline`, `hardened`, `paranoid` (default: `hardened`)

---

#### `detection_evasion`
Documents AV/EDR evasion techniques and blue team detection signatures.

**Input:**
- `evasion_type *` — `obfuscation`, `living_off_land`, `process_injection`, `timestomp`

---

#### `incident_response`
Incident response playbooks and forensic collection procedures.

**Input:**
- `incident_type *` — `ransomware`, `data_breach`, `insider_threat`, `phishing`, `c2`

---

#### `threat_modeling`
STRIDE/PASTA threat modeling guidance for a given system type.

**Input:**
- `system_type *` — e.g., `web_app`, `iot_device`, `internal_network`

---

### Simulation Mode

At the bottom of the OPS tab is a **Simulation** toggle. When enabled:

- All tools run against simulated targets using the E2E simulation engine
- Results are realistic but fictional — safe for demos and training
- A yellow `[SIM]` badge appears on all output panels
- Simulation results do NOT feed into CLLM learning

To run a full simulation chain:
1. Enable Simulation mode
2. Click **Load Scenario** and choose a scenario (e.g., "Web App Pentest", "AD Compromise", "Wi-Fi Assessment")
3. The scenario pre-fills a sequence of tool calls
4. Click **Run Chain** to execute all tools in sequence

---

## 7. VAULT Tab — Password Manager

The VAULT tab is a local-only, session-encrypted password manager designed for field credentials.

### Adding an Entry

1. Click **+ New Entry** (top right)
2. Fill in the form:
   - **Label** `*` — human-readable name, e.g., `Target Admin Panel`
   - **Username** — credential username
   - **Password** `*` — the credential value (can be any secret string)
   - **URL / Host** — optional IP or URL
   - **Tags** — comma-separated, e.g., `web,admin,target-192.168.1.10`
   - **Notes** — free text, e.g., discovered via default creds guide
3. Click **Save**

### Viewing and Copying

- Passwords are masked by default (`••••••••`)
- Click the **eye icon** to reveal for 10 seconds (auto-hides)
- Click the **copy icon** to copy to clipboard (confirmed with a toast notification)
- Clipboard is cleared after **60 seconds** automatically

### Tagging and Labeling

Tags are the primary way to organize vault entries during an engagement. Best practices:

| Tag Strategy | Example Tags |
|-------------|---------|
| By target host | `host-10.0.0.5`, `host-192.168.1.50` |
| By service | `ssh`, `rdp`, `web`, `ftp`, `smb` |
| By status | `active`, `expired`, `unverified`, `rotated` |
| By privilege level | `admin`, `user`, `service-account`, `domain-admin` |
| By source | `found-via-default`, `cracked`, `phished`, `reused` |

Combine tags for powerful filtering:
```
Filter: admin host-10.0.0.5
```
Returns only entries tagged with BOTH `admin` AND `host-10.0.0.5`.

### Filtering

The filter bar searches across:
- Label
- Username
- Tags
- Notes (partial match)

It does **not** search inside password values (by design).

### Bulk Operations

Select multiple entries using the checkboxes:
- **Export Selected** — exports to an encrypted JSON file (AES-256 via Web Crypto API)
- **Tag Selected** — adds a tag to all selected entries at once
- **Delete Selected** — permanently removes entries (no recovery)

### Import

Click **Import** and select a previously exported vault JSON file. You will be prompted for the export passphrase. Entries are merged (duplicates detected by label + username combination).

### Vault Security Architecture

- All vault data is stored in **localStorage** (session-scoped on mobile browsers) or **a local SQLite file** when running via Node
- The Node-backed vault is AES-256 encrypted at rest using a key derived from a passphrase you set on first launch
- No vault data is ever sent over the network
- The PANIC button wipes vault data — see Section 10

---

## 8. INTEL Tab — Algorithm Weights & AARs

### What Is the CLLM?

The Continuous Learning Loop Model (CLLM) is a lightweight feedback system that tracks which tool responses were helpful (thumbs up) vs unhelpful (thumbs down) and adjusts the **algorithm weights** used to rank and prioritize tool responses.

It does not use a neural network or make API calls. It's a weighted scoring system stored locally.

### After Action Reports (AARs)

Every completed tool run generates an AAR entry automatically. AARs contain:

- Tool name
- Input parameters (redacted of sensitive values)
- Execution timestamp
- Response time
- User feedback (if given)
- Notes (optional — click a result panel to add notes)

### Viewing AARs

In the INTEL tab:

1. The **AAR Feed** panel shows the last 50 entries, newest first
2. Click any AAR to expand it and see full detail
3. Use the **search bar** to filter AARs by tool name, date, or tag
4. Click **Export AARs** to download a JSON file for external analysis

### Understanding Algorithm Weights

The **Weights Panel** shows a table of all 35+ tools with their current scores:

| Column | Description |
|--------|-------------|
| Tool | Tool name |
| Runs | Total times executed |
| Positive | Thumbs-up count |
| Negative | Thumbs-down count |
| Score | Weighted score (0.0 – 1.0) |
| Rank | Rank among all tools |

A higher score means the tool has consistently produced useful output. Lower-scored tools are candidates for improvement — you can export their AARs and submit them as issues with the `cllm-feedback` label.

### Score Formula

```
score = (positive + 1) / (positive + negative + 2)
```

This is a Laplace-smoothed proportion. The `+1` and `+2` prevent 0/0 on new tools and give new tools a neutral 0.5 starting score instead of no score.

### How Many AARs Before It Matters?

- **< 5 AARs**: Score is unreliable, essentially the neutral prior
- **5–20 AARs**: Score reflects rough trend
- **20+ AARs**: Score is meaningfully calibrated
- **50+ AARs**: Score is highly reliable

### The Learning Loop in Practice

After ~20 AARs per tool, you'll notice:
- Tool responses the system has scored positively appear with a **green border**
- Tools with low scores show a **yellow caution indicator** reminding you to verify output
- The OPS tab sorts tools within categories by their CLLM score (highest first after 20+ runs)

---

## 9. SURVIVAL Tab — Offline Guide

### What Is the Survival Guide?

The Survival Guide is a fully indexed, offline reference database embedded in the dashboard. It covers:

- Field assessment procedures
- Protocol checklists (reconnaissance, exploitation, post-exploitation, exfil, cover tracks)
- Emergency procedures (PANIC, evidence preservation, abort protocols)
- Radio and communication basics
- Physical security assessment techniques
- Hardware implant detection procedures
- Common tool command references (Nmap, Burp, Metasploit, Aircrack-ng)
- Legal and ethics quick reference (jurisdiction checklist, scope verification)

### Navigating the Survival Guide

The guide is organized into **top-level categories** shown in the left sidebar:

- Fieldcraft
- Network Ops
- Web Ops
- Wireless
- Physical
- Hardware
- Legal & Ethics
- Emergency
- Tool Reference

Click a category to expand it. Click a subcategory or article title to load it in the reading panel.

### Searching

The search bar at the top of the SURVIVAL tab performs **full-text search** across all indexed articles:

1. Type your query (minimum 2 characters)
2. Results appear as you type (debounced 200ms)
3. Results show article title, category, and a matched excerpt
4. Click a result to open the article

Search is **case-insensitive** and supports:
- Single words: `kerberos`
- Phrases (quoted): `"privilege escalation"`
- Boolean: partial support — just list words and all must match

### Adding Custom Tips

You can add personal notes and custom articles to the guide:

1. Click **+ Add Note** in the Survival tab header
2. Give it a title and select a category (or create a new one)
3. Write your note in Markdown
4. Click **Save**

Custom entries are stored locally and are marked with a `[CUSTOM]` badge. They are searchable alongside built-in content and are **excluded from PANIC wipes** by default (see Section 10 for override).

### Bookmarks

Click the **bookmark icon** on any article to save it to your personal bookmark list. Bookmarks are accessible via the bookmark icon in the top navigation bar.

---

## 10. PANIC Button

The PANIC button is located in the **top-right corner** of the dashboard header, styled in red. It is always visible regardless of which tab is active.

### When to Use It

Use the PANIC button when:

- You believe the device has been seized or is about to be
- You need to immediately sanitize the device of engagement data
- You detect unauthorized remote access to the device
- You are ending an engagement and need to clean up on-device data

### What It DOES Wipe

Upon confirmation, PANIC immediately wipes:

- **All vault entries** (credentials, labels, tags, notes)
- **All AARs** (after action reports and CLLM feedback data)
- **All algorithm weight scores** (reset to neutral 0.5)
- **Session tokens** and any cached authentication
- **Recent tool inputs** stored in browser localStorage

### What It Does NOT Wipe

PANIC does **not** wipe:

- The survival guide built-in content (it's read-only)
- **Custom notes** you added (default behavior — see override below)
- The dashboard application code itself
- Your pnpm/npm package installations
- System logs outside the dashboard process
- Any files you saved outside the vault (e.g., screenshots, downloads)

### Override: Wipe Custom Notes

Before confirming PANIC, a checkbox option reads:
> `☐ Also wipe custom notes`

Check this box if you also want to remove custom Survival Guide entries.

### The Confirmation Flow

PANIC requires a 3-step confirmation to prevent accidental activation:

1. Click **PANIC** button → modal appears with summary of what will be wiped
2. Type `WIPE` into the confirmation text field
3. Click **CONFIRM WIPE** (red, pulsing)

Total time from click to wipe: under 5 seconds if you proceed immediately.

### After a PANIC

After PANIC completes:
- The dashboard reloads to a clean state
- A single log line is written: `[PANIC] Wipe completed at <timestamp>`
- This log line is the **only** thing retained after a PANIC event
- The STATUS tab will show vault: 0 entries, AARs: 0

---

## 11. Feedback System & CLLM Learning

### Submitting Feedback

Every tool result panel has a **thumbs up (👍)** and **thumbs down (👎)** button.

- **Thumbs up**: The result was accurate, relevant, and actionable
- **Thumbs down**: The result was wrong, unhelpful, or misleading

You can submit feedback at any point during the session — you do not need to submit immediately after seeing a result.

### What Feedback Affects

Feedback affects:
- The tool's CLLM score (visible in INTEL tab)
- Tool ranking order in the OPS sidebar (after 20+ runs)
- The caution/positive visual indicator on tool results

Feedback does **not** change the tool's code or logic. For that, create an issue or PR.

### Adding Notes to Feedback

After clicking thumbs down, an optional text field appears:
> `What went wrong? (optional)`

This note is saved in the AAR and is visible when you export AARs for review. Use this to record exactly what was inaccurate so it can inform future tool improvements.

### How the Loop Works

```
Tool Run → AAR Created → Feedback Submitted →
Score Updated → OPS Sidebar Re-sorted →
Export AARs → Submit Issues → Tool Updated →
Rebuild → Better Results → More Positive Feedback
```

---

## 12. Offline Usage

### Confirming Offline Functionality

To verify the dashboard works without internet:

1. Start the dashboard normally
2. Disconnect from the internet (disable Wi-Fi, unplug Ethernet)
3. Reload `http://localhost:7474`
4. The dashboard should load fully with no errors

Everything in the dashboard — tools, vault, survival guide, INTEL — works offline. The only feature that requires internet is:
- Checking for updates (the update checker in STATUS tab)

### Offline on Raspberry Pi

For maximum offline reliability on a Pi:

1. Run `npm install` while connected to internet
2. Run `npm run build` once
3. After that, the Pi never needs internet for dashboard operation
4. Mount the SD card read-only for tamper resistance (advanced):
   ```bash
   # In /etc/fstab, add 'ro' to root partition options
   # Then remount tmpfs for /tmp and /var/log
   ```

### Mobile Offline (Termux on Android)

```bash
pkg install nodejs git
git clone <repo>
cd mcp-natt && npm install && npm run build
npm run dashboard
```

Access via browser at `http://localhost:7474` on the same device, or `http://<android-ip>:7474` from other LAN devices.

---

## 13. Updating the System

### Standard Update (Internet Connected)

```bash
# 1. Navigate to the project root
cd /path/to/devbot

# 2. Pull latest code
git pull origin main

# 3. Install any new dependencies
npm install

# 4. Rebuild the MCP server
npm run build

# 5. Restart the dashboard
# (kill existing process first if running as background process)
pkill -f "tactical-dashboard"
npm run dashboard
```

### Checking for Updates (STATUS Tab)

In the STATUS tab, the **Version** card shows:
- Current version
- A **Check for Updates** button (requires internet)
- Last checked timestamp

### Rollback

If an update breaks something:

```bash
git log --oneline -10          # Find last working commit hash
git checkout <commit-hash>     # Roll back
npm install && npm run build   # Rebuild at that version
```

---

## 14. Troubleshooting

### Issue 1: Dashboard won't start — `Error: Cannot find module './dist/index.js'`

**Cause:** TypeScript hasn't been compiled yet.  
**Fix:** Run `npm run build` then retry `npm run dashboard`.

---

### Issue 2: Port 7474 already in use

**Fix:**
```bash
# Find what's using the port
lsof -i :7474
# or on Windows:
netstat -ano | findstr :7474

# Kill the process
kill -9 <PID>
# or change the port in tactical-dashboard/server.js: PORT=7575
```

---

### Issue 3: `npm install` fails with ENOMEM on Raspberry Pi

**Cause:** Insufficient swap space.  
**Fix:**
```bash
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile    # Set CONF_SWAPSIZE=1024
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
npm install
```

---

### Issue 4: Vault entries disappeared after refresh

**Cause:** Using browser localStorage which was cleared, OR the vault file path changed.  
**Fix:** Check `tactical-dashboard/data/vault.db` exists and has correct permissions:
```bash
ls -la tactical-dashboard/data/
chmod 600 tactical-dashboard/data/vault.db
```

---

### Issue 5: A tool returns "not found" or empty results

**Cause 1:** The MCP server build is stale.  
**Fix:** `npm run build && npm run dashboard`

**Cause 2:** The tool requires a network connection (uncommon — most tools are knowledge-only).  
**Fix:** Enable Simulation mode to get a representative result offline.

---

### Issue 6: Dashboard is slow / tabs take >2s to load

**Cause:** Running on Pi with < 512MB free RAM.  
**Fix:**
```bash
# Check free memory
free -h
# Kill any non-essential services
sudo systemctl stop bluetooth
sudo systemctl stop avahi-daemon
```

---

### Issue 7: Can't access from other devices on LAN

**Cause:** Firewall blocking port 7474.  
**Fix:**
```bash
# Allow port 7474 through ufw
sudo ufw allow 7474/tcp
sudo ufw reload
```

---

### Issue 8: Survival Guide search returns no results

**Cause:** The search index failed to build.  
**Fix:** Check the console (`F12 → Console`) for index errors. If index is missing, restart the dashboard — it rebuilds the index on start.

---

### Issue 9: AAR count shows 0 in INTEL tab

**Cause:** Tools haven't been run yet, or AARs are stored in a different session.  
**Fix:** Run any tool in the OPS tab. An AAR should appear immediately after the run completes.

---

### Issue 10: PANIC button won't activate — stuck on "WIPE" confirmation

**Cause:** Browser autocomplete is interfering with the input field.  
**Fix:** Type `WIPE` manually (not via autofill). The text comparison is exact and case-sensitive.

---

### Issue 11: Node.js version too old — `SyntaxError: Unexpected token '??='`

**Cause:** Running Node < 15 (nullish assignment operators not supported).  
**Fix:**
```bash
# Install Node 20 via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20
nvm use 20
```

---

### Issue 12: Git pull fails — merge conflicts in dist/

**Cause:** The `dist/` directory is tracked and has local changes.  
**Fix:**
```bash
git checkout -- dist/
git pull origin main
npm run build
```

---

### Issue 13: MCP tools not showing in Claude

**Cause:** The MCP server (`npm run mcp`) is not running alongside the dashboard, or the Claude MCP config is pointing to the wrong path.  
**Fix:** Ensure your `claude_desktop_config.json` or `.mcp.json` has the correct path to `dist/index.js` and that the process is running.

---

### Issue 14: Custom Vault export can't be imported — "Invalid passphrase"

**Cause:** The export passphrase and import passphrase don't match, or the file was corrupted.  
**Fix:** Ensure you're using the exact passphrase (case-sensitive). Try importing on the same device. Corrupted files cannot be recovered — always keep a secondary encrypted backup.

---

### Issue 15: Dashboard crashes after ~10 minutes on iOS (iSH)

**Cause:** iOS app backgrounding kills the iSH Node process.  
**Fix:** Keep iSH in the foreground, or use a Bluetooth keyboard to lock the screen without backgrounding the app. Alternatively, run the server on a Pi and access via Safari (no local process required).

---

### Getting Further Help

1. Check the FAQ (`FAQ.md` in this folder) for quick answers
2. Review AARs in the INTEL tab for clues about tool failures
3. Check the GitHub Issues page for known bugs
4. Submit feedback via the in-dashboard thumbs system to log the issue for CLLM tracking

---

*User Guide generated for NATT Tactical Dashboard v1.0 | Classification: OPERATIONAL*
