# NATT Tactical Dashboard — FAQ

> Frequently Asked Questions | Updated for v1.0

---

## Installation Questions

**Q1: Can I run this on a Raspberry Pi Zero or Pi Zero 2W?**

The Pi Zero (original) is not supported — it runs ARMv6 and Node 18+ requires ARMv7 minimum. The Pi Zero 2W (ARMv8 quad-core) can technically run it, but performance is marginal. Expect 5–10 second tab load times and occasional OOM kills under load. If a Pi Zero 2W is your only option, disable swap and use only the lightweight tools. A Pi 3B+ or Pi 4 is strongly recommended.

---

**Q2: Can I run this on Android via Termux?**

Yes. Termux is a fully supported platform. Steps:

```bash
pkg update && pkg upgrade
pkg install nodejs git
git clone <repo-url>
cd devbot/mcp-natt
npm install && npm run build
npm run dashboard
```

Access the dashboard at `http://localhost:7474` in any Android browser. Tested on Android 10+ with Termux 0.118+. On Android 9, you may see slower cold-start times due to Node startup overhead.

---

**Q3: Can I run this on iOS?**

Yes, via the **iSH** app (Alpine Linux shell for iOS). Install iSH from the App Store, then:

```bash
apk add nodejs npm git
git clone <repo-url>
cd devbot/mcp-natt
npm install && npm run build
npm run dashboard
```

Open Safari and go to `http://localhost:7474`. Limitation: iSH is killed by iOS when backgrounded, so keep the app open or use a dedicated Pi/laptop for the server and access it remotely.

---

**Q4: Does it work on Windows natively (without WSL2)?**

Yes, but with caveats. Some shell scripts in `npm run` tasks use Unix path separators. The dashboard itself runs fine. Use PowerShell or Git Bash to run commands. WSL2 provides a smoother experience overall.

---

**Q5: How long does `npm install` take on a Pi 4?**

Approximately 60–120 seconds on a Pi 4 4GB with a Class 10 SD card. With an A2-rated SD card, this drops to 30–60 seconds. The bottleneck is usually SD card I/O, not CPU or network. Running from a USB 3.0 SSD dramatically improves install time (< 20 seconds).

---

**Q6: Do I need to run `npm run build` every time I start the dashboard?**

No. Only run `npm run build` after pulling new code updates or modifying TypeScript source files. For normal starts, just run `npm run dashboard`.

---

**Q7: Can I install this alongside other Node apps (like DevBot itself)?**

Yes. The project uses isolated `node_modules` under `mcp-natt/`. It does not conflict with other Node projects in the workspace. Just keep the port (7474) available.

---

**Q8: Can I use pnpm instead of npm?**

Yes. pnpm is preferred. All `package.json` scripts work with pnpm. Replace `npm install` with `pnpm install` and `npm run` with `pnpm run` or just `pnpm` throughout. pnpm is significantly faster on disk-constrained hardware like the Pi.

---

## Security Questions

**Q9: Is the vault encrypted?**

Yes. The Node-backed vault (default when running via `npm run dashboard`) stores credentials in a local SQLite database encrypted with AES-256. The encryption key is derived from a passphrase using PBKDF2 (100,000 iterations). The passphrase is set during first launch and is never stored — only the derived key is held in memory during the session.

In browser-only mode (no Node backend), credentials use the Web Crypto API with AES-GCM via `localStorage`. This is session-scoped — data persists through browser refreshes on the same device but is cleared if you clear browser storage.

---

**Q10: What happens if someone finds my Pi?**

Use the PANIC button before the device is physically accessed (if possible). If the Pi is seized without a wipe:

- Vault data is AES-256 encrypted — brute-forcing the passphrase is computationally infeasible with a strong passphrase
- AARs contain redacted inputs (sensitive values are auto-masked before storage)
- Tool knowledge is the same as public security documentation — not incriminating on its own
- Custom Survival notes could contain sensitive field notes — choose your passphrase strength accordingly

For maximum security: use full-disk encryption (LUKS on a Linux Pi install) and configure auto-shutdown after a brief idle period.

---

**Q11: Is any data sent to the internet?**

No telemetry, analytics, or usage data is ever transmitted. The only network activity is:
- Optional: checking for updates (user-initiated, STATUS tab)
- Optional: MCP server communication with Claude (only if the MCP server is connected to an AI client)

The dashboard itself never makes outbound HTTP requests during normal operation.

---

**Q12: Can other people on my network access my vault?**

Anyone who can reach port 7474 on your device/Pi can load the dashboard and interact with the vault. By default there is no authentication on the dashboard UI. If operating on a shared or untrusted network:

1. Bind the server to localhost only: set `HOST=127.0.0.1` in your environment before starting
2. Or, configure a reverse proxy (nginx/caddy) with HTTP Basic Auth in front of port 7474
3. Or, use firewall rules to whitelist only specific IPs

---

**Q13: Should I run this as root on my Pi?**

No. Run as a non-root user. The dashboard does not require root privileges. Running Node servers as root is a security risk. Create a dedicated user:

```bash
sudo useradd -m natt
sudo su - natt
# then install and run the dashboard as this user
```

---

## Usage Questions

**Q14: Why does a tool say "not found" or return an empty result?**

Most NATT tools are **knowledge tools** — they do not make live network connections. "Not found" usually means:

1. The MCP server build is stale → run `npm run build`
2. The tool name was mistyped → check the OPS sidebar for the exact tool name
3. The input format is wrong → check that required fields (marked `*`) are filled in correctly

If you're connected to Claude via MCP and Claude says "tool not found," the MCP server process may have died — restart it and reconnect.

---

**Q15: How do I rebuild after changing a tool's TypeScript source?**

```bash
npm run build
```

Then restart the dashboard. The build output goes to `dist/`. No hot reload is available — a full restart is required after source changes.

---

**Q16: Can I add my own tools to the MCP server?**

Yes. Tools are defined in `src/knowledge.ts` (knowledge data) and registered in `src/index.ts`. Copy an existing tool registration block, change the name and handler, add your knowledge data, rebuild. See `CONTRIBUTING_AGENTS.md` in the DevBot root for contribution patterns.

---

**Q17: I deleted a vault entry by accident. Can I recover it?**

No. Vault deletions are permanent and immediate. There is no undo or trash bin. Best practice: export the vault to an encrypted JSON file before making bulk deletions. Treat the vault like a password manager — back it up.

---

**Q18: How do I export and back up my vault?**

In the VAULT tab, click **Export** (top right). Enter a strong passphrase for the export encryption. Save the resulting `.vault.json` file to an encrypted external drive or secure cloud storage. Never store it unencrypted.

---

**Q19: Can I run the dashboard and the MCP server at the same time?**

Yes, and this is the intended mode of operation. They are separate processes:

```bash
# Terminal 1 — MCP server for Claude
npm run mcp

# Terminal 2 — Tactical dashboard
npm run dashboard
```

Or use a process manager:
```bash
npm run start:all   # If this script exists in your package.json
```

---

## Network Questions

**Q20: Can multiple devices connect to the dashboard simultaneously?**

Yes. The Express server handles concurrent connections. Multiple team members on the same LAN can open `http://<pi-ip>:7474` simultaneously. However, vault and AAR state is shared — all connected users see and modify the same data. There is no per-user isolation in v1.0.

---

**Q21: What port does the dashboard use? Can I change it?**

Default port: **7474**. To change it:

```bash
PORT=8080 npm run dashboard
```

Or set `PORT` in a `.env` file at the project root. The survival guide chose 7474 as it's not commonly used by other tools and is easy to remember (tactical: 74-74).

---

**Q22: How do I find my Raspberry Pi's IP address?**

```bash
hostname -I | awk '{print $1}'
```

Or check your router's DHCP lease table. For a stable address, configure a static IP or a DHCP reservation based on the Pi's MAC address.

---

**Q23: Can I access the dashboard over the internet (not just LAN)?**

Technically yes, but it is strongly discouraged. The dashboard has no authentication by default and exposing it to the public internet would expose your vault and AAR data. If remote access is needed:

- Use a VPN (WireGuard or Tailscale) and access via the VPN IP
- Never expose port 7474 directly via port forwarding

---

## CLLM Questions

**Q24: How does the learning loop actually work?**

The CLLM is a local weighted feedback system. Each tool has a score calculated as:

```
score = (positive_feedback + 1) / (positive_feedback + negative_feedback + 2)
```

When you submit thumbs up or thumbs down, the count updates and the score recalculates immediately. Scores influence:
- Tool ranking order in the OPS sidebar
- Visual confidence indicators (green border vs yellow caution)

The algorithm weights are stored in `tactical-dashboard/data/cllm-weights.json`.

---

**Q25: How many AARs does it take before the CLLM score is meaningful?**

| AARs | Reliability |
|------|-------------|
| 0–4 | Unreliable — neutral prior dominates |
| 5–19 | Rough trend visible |
| 20–49 | Meaningful signal |
| 50+ | Highly calibrated |

Across a typical engagement (2–4 hours of active tool use), you'd naturally accumulate 30–60 AARs.

---

**Q26: Can I reset the CLLM scores without doing a full PANIC?**

Yes. In the INTEL tab, click **Reset Weights** (bottom of the Weights Panel). This resets all tool scores to the neutral 0.5 prior but does NOT wipe AARs or vault data.

---

**Q27: Can I share my CLLM weights with teammates?**

Yes. Export the weights file from INTEL tab → **Export Weights**. On the teammate's device: INTEL tab → **Import Weights** → select the file. Weights are merged (averaged) when imported into a device that already has its own weights.

---

## Survival Guide Questions

**Q28: Can I add my own tips and procedures to the Survival Guide?**

Yes. In the SURVIVAL tab, click **+ Add Note**, give it a title and category, write in Markdown, and save. Custom entries are stored locally, are searchable, and are marked `[CUSTOM]`. They survive regular session resets but can optionally be wiped with PANIC (checkbox during PANIC confirmation).

---

**Q29: Is the survival guide data stored online anywhere?**

No. The survival guide is entirely local. The built-in content is bundled with the application at build time. Custom notes are stored in `tactical-dashboard/data/survival-notes.json`. Nothing is fetched from any server.

---

**Q30: Can I export or print the Survival Guide for offline paper use?**

Yes. In the SURVIVAL tab, click **Export Guide** to download a single HTML file containing all built-in and custom entries, formatted for printing. Use browser print (`Ctrl+P`) with "Print to PDF" for a portable copy.

---

## Legal & Ethics Questions

**Q31: What can I legally do with this toolkit?**

NATT is a knowledge and reference tool. The information it provides is equivalent to what you'd find in security textbooks, OWASP guides, and certification coursework. Legal use requires:

- Written authorization from the system owner before testing any real system
- Adherence to your engagement's defined scope and Rules of Engagement
- Compliance with applicable laws (CFAA in the US, Computer Misuse Act in the UK, etc.)
- Use of Simulation mode for training and demos without a live authorized target

Always use `validate_roe` before any active test action. When in doubt, don't proceed without explicit written authorization.

---

**Q32: Is possessing or using this toolkit illegal?**

No. Security research tools and knowledge are legal to possess in virtually all jurisdictions. Using them against systems you do not own or have explicit written permission to test is illegal. The toolkit itself is neutral — like owning a lockpick set, legality depends on intent and authorization.

---

## Hardware Questions

**Q33: What SD card class is recommended for the Pi?**

Minimum: **Class 10** (10 MB/s sequential write). Recommended: **A2-rated** cards (e.g., SanDisk Extreme Pro, Samsung PRO Endurance). A2-rated cards are optimized for random I/O (4K reads/writes), which dramatically improves npm install times and SQLite vault performance.

**Tip:** Avoid no-name or bulk-pack SD cards. Fake cards misreport their speed class and fail under sustained write load, which can corrupt the SQLite vault database.

---

**Q34: What battery/UPS capacity do I need for Pi field deployment?**

For a Pi 4 (typically 3–5W under load), a 10,000 mAh USB power bank provides approximately 8–14 hours of operation. For extended field work (24h+), use a 20,000+ mAh or a dedicated Pi UPS HAT (e.g., PiJuice, UPS-Lite) with a 18650 cell.

---

**Q35: Does the NATT dashboard use any GPIO pins on the Pi?**

No. The dashboard is a pure software application and does not interact with Pi GPIO. The MCP server has a hardware detection module that can read GPIO status (for implant detection workflows), but it is read-only and does not actuate any pins. GPIO usage is completely optional and disabled by default.

---

*FAQ v1.0 | NATT Tactical Dashboard | All data local, no cloud required*
