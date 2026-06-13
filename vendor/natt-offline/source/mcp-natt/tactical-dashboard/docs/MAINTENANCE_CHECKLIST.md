# NATT Tactical Dashboard — Maintenance Checklist Journal

**Classification:** SENSITIVE  
**Document Ref:** NATT-MAINT-001  
**Version:** 1.0.0  
**Date:** 2026-02-24  
**Format:** Field-Usable Checklist  
**Instructions:** Print or access on secondary device. Check each item when completed. Record in version tracking table.

---

## How to Use This Checklist

- Run the appropriate checklist for each maintenance event
- Mark `[x]` when an item is completed, `[!]` if an issue was found, `[-]` if skipped with justification
- Record all issue findings in the notes section at the bottom of each checklist
- Log the maintenance event in the **Version Tracking Table** at the end of this document
- For issues marked `[!]`, open a follow-up task before closing the maintenance window

**Operator ID Format:** Use initials + team code (e.g., `TH-RED`, `JD-OPS`)

---

## 1. Daily Operations Checklist

**Recommended Time:** Start of each operational day (5 min)

**Date:** ________________  **Operator:** ________________  **Deployment:** ________________

### 1.1 Server Status

- [ ] **1.1.1** Confirm NATT Dashboard server is running
  - Linux/Pi: `sudo systemctl status natt-dashboard | grep Active`
  - Expected: `Active: active (running)`
- [ ] **1.1.2** Health check responds correctly
  - Command: `curl -s http://localhost:3000/api/health | python3 -m json.tool`
  - Expected: `"status": "ok"` and `toolCount >= 37`
- [ ] **1.1.3** Confirm uptime > 0 seconds (server did not restart unexpectedly)
- [ ] **1.1.4** Check process memory is within normal range
  - `ps -o pid,rss,comm -p $(pgrep -f "node server.js")`
  - Expected: RSS < 256 MB (< 262144 kB)

### 1.2 Memory Files

- [ ] **1.2.1** All four memory files exist and are readable
  - `ls -la ~/.natt-memory/`
  - Expected: `password-vault.json`, `aar-history.json`, `algorithm-weights.json`, `feedback-log.json`
- [ ] **1.2.2** Memory files are valid JSON (no corruption)
  - `node -e "['password-vault','aar-history','algorithm-weights','feedback-log'].forEach(f => JSON.parse(require('fs').readFileSync(\`\${process.env.HOME}/.natt-memory/\${f}.json\`, 'utf8')))"`
  - Expected: No output (no errors)
- [ ] **1.2.3** Memory directory permissions are 700
  - `stat -c "%a" ~/.natt-memory`
  - Expected: `700`

### 1.3 Quick Functional Test

- [ ] **1.3.1** Test one tool call to confirm API is responding
  - `curl -s -X POST http://localhost:3000/api/tool/identify_hash -H 'Content-Type: application/json' -d '{"args":{"hash":"5f4dcc3b5aa765d61d8327deb882cf99"}}' | python3 -m json.tool`
  - Expected: `"success": true` and `"identified": "MD5"`

**Notes/Issues:**

```
_____________________________________________
_____________________________________________
```

---

## 2. Weekly Maintenance Checklist

**Recommended Day:** Sunday (before new operational week) — 15 min

**Date:** ________________  **Operator:** ________________

### 2.1 Backup Verification

- [ ] **2.1.1** Run manual backup of .natt-memory
  - `TIMESTAMP=$(date +%Y%m%d_%H%M%S); tar -czf ~/backups/natt-memory-${TIMESTAMP}.tar.gz ~/.natt-memory/`
- [ ] **2.1.2** Verify backup was created and is non-zero size
  - `ls -lh ~/backups/natt-memory-*.tar.gz | tail -1`
- [ ] **2.1.3** Verify backup is restorable (smoke test)
  - `tar -tzf $(ls -t ~/backups/natt-memory-*.tar.gz | head -1) | head -10`
  - Expected: Lists the memory file names without errors
- [ ] **2.1.4** Prune backups older than 30 days
  - `find ~/backups -name "natt-memory-*.tar.gz" -mtime +30 -delete`
- [ ] **2.1.5** Count remaining backups (should be ≤ 30)
  - `ls ~/backups/natt-memory-*.tar.gz | wc -l`

### 2.2 Log Review

- [ ] **2.2.1** Review last 7 days of server logs for errors or warnings
  - `journalctl -u natt-dashboard --since "7 days ago" --no-pager | grep -iE "error|warn|fail" | head -50`
- [ ] **2.2.2** Check for unexpected panic wipe events
  - `journalctl -u natt-dashboard --since "7 days ago" | grep -i "panic\|wipe" | head -20`
- [ ] **2.2.3** Review feedback log for anomalous entries (ratings of 1)
  - `node -e "const d=JSON.parse(require('fs').readFileSync(process.env.HOME+'/.natt-memory/feedback-log.json','utf8')); d.entries.filter(e=>e.rating<=2).forEach(e=>console.log(e))"`

### 2.3 AAR Review

- [ ] **2.3.1** Review new AAR entries added this week
  - Check `aar-history.json` for entries with date in last 7 days
- [ ] **2.3.2** Verify algorithm weights have updated (if ≥1 AAR submitted)
  - `node -e "const w=JSON.parse(require('fs').readFileSync(process.env.HOME+'/.natt-memory/algorithm-weights.json','utf8')); console.log('Samples:',w.sampleCount,'Last updated:',w.lastUpdated)"`
- [ ] **2.3.3** Identify any tools consistently rated ≤ 3 for knowledge base improvement

### 2.4 System Health

- [ ] **2.4.1** Check SD card / disk remaining space (Pi deployments)
  - `df -h /` — Expected: > 20% free
- [ ] **2.4.2** Check system memory (RAM)
  - `free -m` — Expected: > 100 MB free
- [ ] **2.4.3** Verify Node.js process is still the expected version
  - `node --version` — Expected: v22.x.x (or configured version)
- [ ] **2.4.4** Confirm no zombie processes
  - `ps aux | grep "node" | grep -v grep`

**Notes/Issues:**

```
_____________________________________________
_____________________________________________
_____________________________________________
```

---

## 3. Monthly Maintenance Checklist

**Recommended Day:** First Sunday of month — 30 min

**Date:** ________________  **Operator:** ________________

### 3.1 Dependency Security Audit

- [ ] **3.1.1** Run npm audit on mcp-natt package
  - `cd ~/devbot/mcp-natt && npm audit`
  - Expected: 0 high/critical vulnerabilities
- [ ] **3.1.2** Run npm audit on tactical-dashboard package
  - `cd ~/devbot/mcp-natt/tactical-dashboard && npm audit`
  - Expected: 0 high/critical vulnerabilities
- [ ] **3.1.3** Document any vulnerabilities found and check if patches exist
- [ ] **3.1.4** Apply security patches if available (after testing in non-prod first)
  - `npm audit fix` (non-breaking) — test before applying `--force`

### 3.2 Dependency Updates

- [ ] **3.2.1** Check for outdated packages
  - `npm outdated` in both directories
- [ ] **3.2.2** Review changelog for packages with major updates
- [ ] **3.2.3** Test updates in development environment before applying to field deployment
- [ ] **3.2.4** Rebuild TypeScript after any updates
  - `cd ~/devbot/mcp-natt && npm run build`

### 3.3 Knowledge Base Review

- [ ] **3.3.1** Review AAR entries from the past month for knowledge gaps
- [ ] **3.3.2** Identify tools with < 10 sample rates that might have stale knowledge
- [ ] **3.3.3** Check if any referenced CVEs are now patched and notes still accurate
- [ ] **3.3.4** Review default credentials list for vendor product updates
- [ ] **3.3.5** Check OWASP/PTES for methodology updates that should be incorporated

### 3.4 Password Vault Hygiene

- [ ] **3.4.1** Review vault entries older than 90 days
  - `node -e "const v=JSON.parse(require('fs').readFileSync(process.env.HOME+'/.natt-memory/password-vault.json','utf8')); const cutoff=new Date(Date.now()-90*86400000); v.entries.filter(e=>new Date(e.createdAt)<cutoff).forEach(e=>console.log(e.label,e.createdAt))"`
- [ ] **3.4.2** Remove or rotate vault entries that are no longer needed
- [ ] **3.4.3** Verify all vault entries have appropriate labels and tags
- [ ] **3.4.4** Confirm vault entries are not exceeding RESTRICTED classification unnecessarily

### 3.5 Security Audit

- [ ] **3.5.1** Verify firewall rules still restrict port 3000 to local network only
  - Pi: `sudo ufw status verbose`
- [ ] **3.5.2** Confirm server is running as unprivileged user (not root)
  - `ps aux | grep "node server.js" | awk '{print $1}'` — Expected: `pi`, `node`, or your username (NOT `root`)
- [ ] **3.5.3** Review rate limiting settings in server.js — still appropriate?
- [ ] **3.5.4** Confirm `.natt-memory` is not accessible via web server (no path traversal)
  - `curl http://localhost:3000/../.natt-memory/password-vault.json` — Expected: 404
- [ ] **3.5.5** Check that no credentials are in application logs
  - `journalctl -u natt-dashboard --since "30 days ago" | grep -iE "password|secret|token|key" | head -20`

### 3.6 Documentation Review

- [ ] **3.6.1** Review this checklist — any new items needed?
- [ ] **3.6.2** Update version tracking table
- [ ] **3.6.3** Review User Guide for accuracy against current system state
- [ ] **3.6.4** Archive any outdated documentation to `docs/archive/`

**Notes/Issues:**

```
_____________________________________________
_____________________________________________
_____________________________________________
_____________________________________________
```

---

## 4. Pre-Mission Checklist

**Run this before every authorized engagement.** (10 min)

**Mission ID:** ________________  **Date:** ________________  **Operator:** ________________

### 4.1 Authorization Verification

- [ ] **4.1.1** Written authorization / SOW is signed and dated
- [ ] **4.1.2** Scope is clearly documented (IPs, domains, assets)
- [ ] **4.1.3** Testing time window is confirmed with client
- [ ] **4.1.4** Emergency contact information is available
- [ ] **4.1.5** Out-of-scope systems are explicitly listed
- [ ] **4.1.6** Data handling agreement confirmed

### 4.2 ROE Validation Tool

- [ ] **4.2.1** Run `validate_roe_checklist` with actual mission parameters
  - Expected: All items PASS or WARN with documented mitigations
  - **BLOCKER: DO NOT PROCEED IF ANY ITEM IS BLOCKER**
- [ ] **4.2.2** Save ROE validation output to secure notes

### 4.3 System Readiness

- [ ] **4.3.1** NATT dashboard is running and returning health: ok
- [ ] **4.3.2** All memory files present and valid
- [ ] **4.3.3** Create a backup of current memory state (pre-mission baseline)
  - `tar -czf ~/backups/premission-${MISSION_ID}-$(date +%Y%m%d).tar.gz ~/.natt-memory/`
- [ ] **4.3.4** Test one representative tool from the planned tool set
- [ ] **4.3.5** Confirm panic wipe path is accessible (emergency preparedness)
  - Know: `curl -X POST http://localhost:3000/api/panic -H 'Content-Type: application/json' -d '{"confirm":"WIPE-ALL-MEMORY","reason":"field-sanitize"}'`

### 4.4 Operational Security

- [ ] **4.4.1** Confirm NATT is not accessible from untrusted networks
- [ ] **4.4.2** Personal identification not present in AAR operator fields (use codename)
- [ ] **4.4.3** Classification level for this mission's data is determined: ________________
- [ ] **4.4.4** Device full-disk encryption confirmed (if storing RESTRICTED+ data)

**Pre-Mission Sign-Off:**

```
Operator: ________________________  Date/Time: ________________________
Mission ID: ______________________  Go / No-Go: ______________________
```

---

## 5. Post-Mission Checklist

**Run this after every engagement completes.** (15 min)

**Mission ID:** ________________  **Date:** ________________  **Operator:** ________________

### 5.1 After-Action Review Submission

- [ ] **5.1.1** Document all tools used during the mission
- [ ] **5.1.2** Rate each tool used (1–5) based on effectiveness
- [ ] **5.1.3** Document key lessons learned (minimum 2 sentences)
- [ ] **5.1.4** Document recommendations for future similar missions
- [ ] **5.1.5** Submit AAR via `submit_aar` tool or dashboard
  - Confirm: `"saved": true` and `"weightsUpdated": true`
- [ ] **5.1.6** Verify AAR entry appears in `aar-history.json`

### 5.2 Data Classification and Handling

- [ ] **5.2.1** Review vault entries created during mission — are they still needed?
- [ ] **5.2.2** Remove any RESTRICTED vault entries that are no longer operationally required
- [ ] **5.2.3** Classify all AAR data at the appropriate level (ROUTINE / SENSITIVE / RESTRICTED)
- [ ] **5.2.4** Confirm no `SECRET` classification data was written to disk

### 5.3 Post-Mission Backup

- [ ] **5.3.1** Create a post-mission backup
  - `tar -czf ~/backups/postmission-${MISSION_ID}-$(date +%Y%m%d).tar.gz ~/.natt-memory/`
- [ ] **5.3.2** Archive the post-mission backup to secure off-device storage if required

### 5.4 Debriefing Notes

- [ ] **5.4.1** Any tools that returned incorrect or outdated information — note for knowledge base update
- [ ] **5.4.2** Any new tool types needed for this type of engagement — submit feature request
- [ ] **5.4.3** Review whether panic wipe is needed (data sanitization for device return/disposal)

**Post-Mission Sign-Off:**

```
Operator: ________________________  Date/Time: ________________________
Mission ID: ______________________  Status: CLOSED / FOLLOW-UP REQUIRED
```

---

## 6. Emergency Procedures

### 6.1 Immediate Device Sanitization (Panic)

**Situation:** Device is at risk of unauthorized access, seizure, or compromise.

```bash
# METHOD 1: API panic wipe (server must be running)
curl -s -X POST http://localhost:3000/api/panic \
  -H "Content-Type: application/json" \
  -d '{"confirm":"WIPE-ALL-MEMORY","reason":"emergency"}'

# METHOD 2: Direct file deletion (if server is not running)
rm -rf ~/.natt-memory/
# Verify deletion:
ls ~/.natt-memory/  # Should return: No such file or directory

# METHOD 3: Overwrite then delete (more thorough)
find ~/.natt-memory -type f -exec shred -uz {} \;
rmdir ~/.natt-memory/
```

**After panic wipe:**
- [ ] Confirm all 4 files are gone: `ls ~/.natt-memory/`
- [ ] Confirm server still responds: `curl http://localhost:3000/api/health`
- [ ] Note the wipe event in physical log if possible

### 6.2 Server Crash Recovery

**Situation:** Dashboard server has stopped unexpectedly.

```bash
# Check why it stopped
journalctl -u natt-dashboard -n 50 --no-pager

# Restart
sudo systemctl restart natt-dashboard

# If systemd is not available:
cd ~/devbot/mcp-natt/tactical-dashboard
PORT=3000 node server.js &

# Verify
curl http://localhost:3000/api/health
```

### 6.3 Memory File Corruption

**Situation:** Memory file shows as invalid JSON or becomes unreadable.

```bash
# Stop server first
sudo systemctl stop natt-dashboard

# Identify corrupted file
for f in password-vault aar-history algorithm-weights feedback-log; do
  node -e "JSON.parse(require('fs').readFileSync(process.env.HOME+'/.natt-memory/${f}.json','utf8'))" 2>&1 && echo "$f: OK" || echo "$f: CORRUPTED"
done

# Restore from latest backup
LATEST=$(ls -t ~/backups/natt-memory-*.tar.gz | head -1)
echo "Restoring from: $LATEST"
tar -xzf "$LATEST" -C /

# Restart
sudo systemctl start natt-dashboard

# Verify
curl http://localhost:3000/api/health | python3 -m json.tool
```

### 6.4 Port Conflict / Server Won't Start

```bash
# Find what's using port 3000
sudo ss -tlnp | grep 3000
# OR
sudo lsof -i :3000

# Kill the conflicting process (if safe)
kill <PID>

# Or start NATT on alternate port
PORT=3001 node server.js &
```

### 6.5 MCP Connection Failure (Claude Agent)

**Situation:** Claude cannot connect to NATT via MCP.

```bash
# Rebuild TypeScript source
cd ~/devbot/mcp-natt
npm run build

# Test MCP standalone
node dist/index.js  # Should start without output; send Ctrl+C

# Check for TypeScript errors
npx tsc --noEmit

# Verify dist/index.js exists
ls -la dist/index.js
```

---

## 7. Recovery Procedures

### 7.1 Full System Restore (From Backup)

**Scenario:** Device replaced or full reinstall required.

- [ ] **7.1.1** Install Node.js 22 on new device (see Technical Manual §7)
- [ ] **7.1.2** Clone repository: `git clone https://github.com/tolani-corp/devbot.git`
- [ ] **7.1.3** Install dependencies and build:
  ```bash
  cd devbot/mcp-natt && npm install && npm run build
  cd tactical-dashboard && npm install
  ```
- [ ] **7.1.4** Create memory directory: `mkdir -p ~/.natt-memory && chmod 700 ~/.natt-memory`
- [ ] **7.1.5** Transfer backup to new device (encrypted if SENSITIVE+)
- [ ] **7.1.6** Restore memory files:
  ```bash
  tar -xzf natt-memory-BACKUP.tar.gz -C /
  ```
- [ ] **7.1.7** Start server and verify health check
- [ ] **7.1.8** Test 3 representative tools
- [ ] **7.1.9** Reinstall systemd service if needed (copy from Technical Manual §7.1)
- [ ] **7.1.10** Log the restoration in the version tracking table below

### 7.2 Weight Reset (Learning Model Reset)

**Scenario:** Algorithm weights have become skewed from bad data and need resetting.

- [ ] **7.2.1** Backup current weights: `cp ~/.natt-memory/algorithm-weights.json ~/backups/weights-$(date +%Y%m%d)-backup.json`
- [ ] **7.2.2** Replace with clean default weights:
  ```bash
  cat > ~/.natt-memory/algorithm-weights.json << 'EOF'
  {"version":"1.0","lastUpdated":"2026-02-24T00:00:00.000Z","sampleCount":0,"toolWeights":{},"categoryWeights":{},"contextModifiers":{}}
  EOF
  ```
- [ ] **7.2.3** Restart server
- [ ] **7.2.4** Submit at least 3 AARs to re-seed the weights
- [ ] **7.2.5** Document the reset in version tracking table

### 7.3 Vault Emergency Migration

**Scenario:** Migrating vault to new device securely.

- [ ] **7.3.1** On source device: Encrypt the vault file
  ```bash
  gpg --symmetric --cipher-algo AES256 ~/.natt-memory/password-vault.json
  ```
- [ ] **7.3.2** Transfer encrypted file to new device via secure channel
- [ ] **7.3.3** On destination device: Decrypt
  ```bash
  gpg --decrypt password-vault.json.gpg > ~/.natt-memory/password-vault.json
  chmod 600 ~/.natt-memory/password-vault.json
  ```
- [ ] **7.3.4** Verify vault accessible via dashboard
- [ ] **7.3.5** Set correct directory permissions: `chmod 700 ~/.natt-memory`
- [ ] **7.3.6** Securely delete plaintext copy on source device

---

## 8. Version Tracking Table

Record all significant maintenance events, updates, and deployments.

| Date | Version | Changes / Event | Operator | Status |
|------|---------|-----------------|----------|--------|
| 2026-02-24 | 1.0.0 | Initial deployment — NATT Tactical Dashboard | TH-RED | Complete |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |

**Version Format:** MAJOR.MINOR.PATCH  
- MAJOR: Breaking change to API or data schema  
- MINOR: New tool or significant feature addition  
- PATCH: Bug fix, documentation update, or minor enhancement  

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────┐
│              NATT QUICK REFERENCE                       │
│                                                         │
│  Health check:                                          │
│  curl http://localhost:3000/api/health                  │
│                                                         │
│  Test a tool:                                           │
│  curl -X POST http://localhost:3000/api/tool/TOOLNAME   │
│    -H 'Content-Type: application/json'                  │
│    -d '{"args": {...}}'                                 │
│                                                         │
│  PANIC WIPE:                                            │
│  curl -X POST http://localhost:3000/api/panic           │
│    -d '{"confirm":"WIPE-ALL-MEMORY","reason":"..."}'    │
│                                                         │
│  Service commands:                                      │
│  sudo systemctl start|stop|restart|status natt-dashboard│
│                                                         │
│  View logs:                                             │
│  journalctl -u natt-dashboard -f                        │
│                                                         │
│  Backup memory:                                         │
│  tar -czf backup.tar.gz ~/.natt-memory/                 │
└─────────────────────────────────────────────────────────┘
```

---

*End of Maintenance Checklist Journal — NATT-MAINT-001 v1.0.0*  
*Print at A4 or Letter. Update version tracking table on every maintenance event.*
