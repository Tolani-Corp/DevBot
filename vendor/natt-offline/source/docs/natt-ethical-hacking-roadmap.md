# NATT Ethical Hacking Roadmap

This is the human-readable companion to the canonical roadmap at `.natt/resources/ethical-hacking-roadmap.json`.
NATT, DevBot/DEBO agents, and MCP clients should treat the JSON file as source of truth and this document as the operator manual.

## Safety Boundary

- Work only in owned labs or on assets with explicit written authorization and defined Rules of Engagement.
- Prefer passive, non-destructive learning and validation before any active testing.
- Keep evidence sanitized, avoid storing credentials, and never commit secrets or backup codes.
- Practice platforms are limited to their published scopes and challenge environments.

## Roadmap Instances

| Phase | Roadmap instances | Canonical skill IDs |
|---|---|---|
| Understand Basics | TCP/IP, DNS, HTTP, HTTPS | `tcp-ip-dns`, `http-https-basics` |
| Operating Systems | Linux, Windows, macOS | `linux-fundamentals`, `windows-fundamentals`, `macos-fundamentals` |
| Networking | IP, MAC, DNS, DHCP, ports, protocols, OSI model | `ip-mac-dhcp`, `ports-protocols`, `osi-model` |
| Programming | Python, Bash, JavaScript, PHP, SQL | `python-scripting`, `bash-automation`, `web-backend-scripting` |
| Tools | Nmap, Burp Suite, Metasploit, John the Ripper, Wireshark | `nmap-basics`, `burp-suite-basics`, `metasploit-awareness`, `john-ripper-basics`, `wireshark-analysis` |
| Set Up Lab | VirtualBox, VMware, Kali Linux, Parrot OS | `virtualization-lab-setup`, `kali-parrot-lab-setup` |
| Start Practicing | TryHackMe, Hack The Box, OverTheWire | `tryhackme-paths`, `hack-the-box-labs`, `overthewire-wargames` |

## MCP Access

Use these MCP tools for agent planning and context retrieval:

- `get_ethical_roadmap`: returns the roadmap summary or full catalog.
- `get_roadmap_stage`: returns one phase with skills, tools, resources, manuals, and next phases.
- `recommend_roadmap_path`: recommends next skills, tools, resources, and manuals by mission type.

Use these MCP resources for direct context:

- `natt://ethical-roadmap`: full roadmap, safety policy, manuals, and agent context.
- `natt://ethical-roadmap-catalog`: skills, tools, resources, manuals, and context without the phase wrapper.

## Agent Context

Agents should load roadmap context in this order:

1. Read `.natt/resources/ethical-hacking-roadmap.json`.
2. Use `natt-skills-catalog.json` to align roadmap IDs with NATT capabilities.
3. Use `src/agents/skills/roadmap.ts` for in-process stage bundles and search.
4. Use `src/agents/natt-dynamic-roadmap.ts` or `scripts/natt-roadmap.ts` for mission-specific recommendations.
5. Validate ROE before any scan, active test, credential audit, or lab-to-real-target transition.

## Manuals Index

| Manual | Purpose |
|---|---|
| `DEVBOT_PENTEST_GUIDE.md` | Authorized security assessment workflows, scan types, reporting, and guardrails. |
| `PENTEST_QUICK_REFERENCE.md` | Short command reference for NATT security operations. |
| `DEBO_SETUP_GUIDE.md` | Slack, Discord, environment, and command setup for DEBO/DevBot/NATT. |
| `DEVBOT_MCP_ARCHITECTURE.md` | MCP architecture and tool/resource exposure reference. |
| `src/safety/README.md` | Repository safety rules and bounded workflow context. |
| `mcp-natt/tactical-dashboard/docs/USER_GUIDE.md` | Tactical dashboard operator guide. |
| `mcp-natt/tactical-dashboard/docs/TECHNICAL_MANUAL.md` | Tactical dashboard deployment and maintenance manual. |

