# NATT Tactical Dashboard — Quick Start

> Port: **7474** | Runtime: Node 18+ | Zero cloud required

---

## Prerequisites

- Node.js 18+ installed (`node --version` to verify)
- Git installed (`git --version` to verify)
- 500MB free storage
- Network access during install (offline after that)
- Pi 4 2GB+ / Android Termux / any Linux-capable device

---

## Install (4 commands)

```bash
git clone https://github.com/your-org/devbot.git
cd devbot/mcp-natt
npm install
npm run build
```

---

## Start (1 command)

```bash
npm run dashboard
```

Expected output:
```
[NATT] Tactical Dashboard running at http://localhost:7474
[NATT] MCP server tools loaded: 35
[NATT] Vault initialized
[NATT] Survival guide: indexed
```

---

## Access

**Local device:**
```
http://localhost:7474
```

**From another device on LAN (e.g., connecting to your Pi):**
```
http://<device-ip>:7474
```

Find your IP:
```bash
hostname -I | awk '{print $1}'
```

---

## First 5 Things to Do

1. **STATUS tab** — verify all cards show green; confirm tool count ≥ 35
2. **OPS tab → `validate_roe`** — test with `action: run nmap scan`, `roe_type: pentest`
3. **VAULT tab → + New Entry** — store one credential to confirm vault is working
4. **INTEL tab** — confirm AARs appear after the tool run in step 2
5. **SURVIVAL tab** — search `"privilege escalation"` to confirm search is live

---

## Emergency: PANIC & Wipe

1. Click the red **PANIC** button (top-right, always visible)
2. Read the wipe summary — check `Also wipe custom notes` if needed
3. Type `WIPE` in the confirmation field (exact, case-sensitive)
4. Click **CONFIRM WIPE**

**Wipes:** vault entries, AARs, CLLM scores, session cache  
**Does NOT wipe:** app code, built-in survival guide, npm packages

**Time to wipe: < 5 seconds**

---

## Common Commands

```bash
npm run build        # Recompile after code changes
npm run dashboard    # Start the dashboard
npm run mcp          # Start the MCP server for Claude integration
PKG_VER npm run dashboard  # (pnpm users: replace npm run with pnpm)
PORT=8080 npm run dashboard  # Run on a different port
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Cannot find module './dist/index.js'` | Run `npm run build` first |
| Port 7474 in use | `lsof -i :7474` then `kill -9 <PID>` |
| npm install OOM on Pi | Add 1GB swap: `sudo dphys-swapfile` |
| Vault data missing after restart | Check `tactical-dashboard/data/vault.db` permissions |
| Survival search returns nothing | Restart dashboard to rebuild index |

Full troubleshooting: see [USER_GUIDE.md](./USER_GUIDE.md#14-troubleshooting) (15+ issues covered)  
Questions: see [FAQ.md](./FAQ.md)

---

*NATT Tactical Dashboard v1.0 | Classification: OPERATIONAL*
