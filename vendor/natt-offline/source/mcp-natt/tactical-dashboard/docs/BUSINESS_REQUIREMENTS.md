# NATT Tactical Dashboard — Business Requirements Document

**Classification:** SENSITIVE  
**Document Ref:** NATT-BRD-001  
**Version:** 1.0.0  
**Date:** 2026-02-24  
**Owner:** Tolani Labs  
**Status:** Approved

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Problem](#2-business-problem)
3. [Target Users](#3-target-users)
4. [Use Cases](#4-use-cases)
5. [Functional Requirements](#5-functional-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Out of Scope](#7-out-of-scope)
8. [Acceptance Criteria — Open Day Launch](#8-acceptance-criteria--open-day-launch)
9. [Risk Register](#9-risk-register)
10. [Success Metrics](#10-success-metrics)

---

## 1. Executive Summary

NATT (Network Attack & Tactics Toolkit) Tactical Dashboard is a self-hosted, offline-capable security knowledge and operations platform designed for security professionals working in constrained field environments. It combines a Model Context Protocol (MCP) server exposing 37+ security tools with a browser-based tactical dashboard and a persistent local memory system for operational continuity.

The Tactical Dashboard extends NATT's AI-agent integration (via Claude and other LLMs) with a direct human-accessible interface, enabling security researchers, red teamers, and incident responders to query the knowledge base, manage operational artifacts, and conduct after-action reviews without cloud dependency.

**Strategic Value:**
- Eliminates reliance on cloud-based security tools in hostile or disconnected environments
- Provides structured, auditable knowledge access with machine-learning improvement over time
- Supports both AI-assisted and manual operator workflows from a single system
- Deployable on hardware costing under $100 (Raspberry Pi 4) and operable from an Android device

**Business Objective:** Deliver a production-ready Tactical Dashboard before Open Day 2026 that demonstrates NATT's capabilities to prospective clients, partners, and research collaborators.

---

## 2. Business Problem

### 2.1 The Field Security Tool Gap

Existing security tools and knowledge bases fail in field, edge, and survival contexts due to a common set of structural problems:

| Problem | Current State | Impact |
|---------|--------------|--------|
| Cloud dependency | Most tools (Shodan, OnlineHashCrack, HaveIBeenPwned) require internet access | Non-functional in air-gapped, hostile, or remote environments |
| Heavy footprint | Kali Linux, Burp Suite Pro require large installation, licensing | Not deployable on Pi or Android without significant effort |
| No memory | Tools provide answers but don't learn from operator feedback | Same mistakes repeated across missions |
| No ROE enforcement | Tools execute without checking authorization boundaries | Legal and operational risk |
| Fragmented knowledge | Information split across CVE databases, OWASP, PTES, vendor docs | High cognitive load; slow reference during time-critical operations |
| No offline AI | AI coding/security assistants (Claude, GPT) require internet | Unusable in SCIFs, field ops, or network-isolated deployments |

### 2.2 Specific Gaps This Product Fills

1. **Offline AI-powered security assistance** — All 37+ security tools function with zero network connectivity.
2. **Persistent operational memory** — AAR history, vault, and algorithm weights survive reboots and evolve with usage.
3. **ROE-first design** — `validate_roe_checklist` is the recommended first tool on any engagement.
4. **Sub-$100 full deployment** — Entire stack runs on a Raspberry Pi 4 (2GB).
5. **E2E simulation** — Chained tool scenarios allow rehearsal without live targets.
6. **Machine learning adaptation** — Tool effectiveness weights improve with feedback, customizing the experience to each operator's context.

---

## 3. Target Users

### 3.1 Primary Users

| User Role | Description | Primary Use Cases |
|-----------|-------------|-------------------|
| Security Researcher | Academic or independent researcher studying offensive/defensive techniques | Tool reference, JWT/VPN analysis, CVE lookup |
| Red Team Operator | Professional pentester conducting authorized engagements | ROE validation, methodology guidance, credential tools, AAR |
| Incident Responder | First responder analyzing a security incident in real-time | Hash identification, secret scanning, defense playbooks |
| Field Ops Specialist | Operator working in disconnected or physically dangerous environments | All tools offline; panic wipe; minimal footprint |
| CTF Competitor | Cybersecurity competition participant | Hash cracking guidance, JWT attacks, RE guidance |

### 3.2 Secondary Users

| User Role | Description |
|-----------|-------------|
| AI Agent (Claude/LLM) | Automated tool-use via MCP protocol; NATT as a tool-calling backend |
| DevSecOps Engineer | Pipeline integration guidance, compliance mapping |
| Security Trainer | Using NATT to demonstrate techniques in training environments |
| Bug Bounty Hunter | Using program guidance and DAST profiles for structured bug hunting |

### 3.3 User Technical Assumptions

- Users have basic command-line proficiency (can SSH into a Pi, run npm commands)
- Users understand security terminology (not designed for non-technical users)
- Users are authorized to conduct the activities they use NATT to assist with
- Users are responsible for ROE compliance; NATT assists but does not enforce

---

## 4. Use Cases

### UC-001: Pre-Engagement ROE Validation

**Actor:** Red Team Operator  
**Trigger:** Operator prepares to begin a penetration test engagement  
**Description:** The operator submits their planned scope, authorization documentation reference, and time window to `validate_roe_checklist`. NATT evaluates the inputs against a structured Rules of Engagement checklist and returns pass/fail status with specific warnings.  
**Success Criteria:** All checklist items return PASS or operator has documented mitigations for WARN items. No BLOCKER items present.

---

### UC-002: Hash Identification During Credential Audit

**Actor:** Security Researcher  
**Trigger:** Researcher discovers a hash string in a database dump or configuration file  
**Description:** Researcher inputs the hash string into `identify_hash`. NATT detects the algorithm, returns confidence level, crack difficulty index, and recommended toolchain commands.  
**Success Criteria:** Algorithm correctly identified with ≥ high confidence for all common hash types within 100ms.

---

### UC-003: JWT Vulnerability Assessment

**Actor:** Bug Bounty Hunter  
**Trigger:** Hunter identifies a JWT in a web application's authentication flow  
**Description:** Hunter uses `decode_jwt` to inspect the token structure, then `get_jwt_attack` to enumerate applicable attacks, then `analyze_jwt_config` to assess the configuration for misconfigurations.  
**Success Criteria:** Complete attack surface for the JWT is documented with no external tool required.

---

### UC-004: Offline VPN Security Review

**Actor:** Field Ops Specialist  
**Trigger:** Operator needs to verify a VPN configuration before use in hostile environment  
**Description:** Operator pastes VPN config into `analyze_vpn_config`. NATT identifies cipher weaknesses, protocol issues, and leak risks. Operator uses `get_vpn_leak` to learn detection/mitigation techniques.  
**Success Criteria:** Configuration issues identified and remediation steps provided without internet access.

---

### UC-005: Password Generation and Vault Storage

**Actor:** Red Team Operator  
**Trigger:** Operator needs a strong password for a test account or staging credential  
**Description:** Operator uses `generate_password` with specified complexity requirements. Password is displayed with entropy calculation. Operator stores it via `store_generated_password` with a contextual label.  
**Success Criteria:** Password meets complexity requirements, entropy ≥ 128 bits, stored to vault with correct label.

---

### UC-006: After-Action Review Submission

**Actor:** Red Team Operator  
**Trigger:** Operator completes an engagement or mission phase  
**Description:** Operator submits AAR via `submit_aar` with mission ID, outcome, tools used, lessons learned, and recommendations. NATT stores the entry and updates algorithm weights based on tool effectiveness ratings.  
**Success Criteria:** AAR persists to `aar-history.json`, weights update correctly, mission ID is unique and retrievable.

---

### UC-007: AI Agent Tool-Use Session

**Actor:** Claude AI Agent  
**Trigger:** AI agent receives a security analysis task from user  
**Description:** Claude connects to NATT via MCP stdio protocol. It queries `tools/list` to discover available tools, then calls relevant tools (e.g., `identify_hash`, `get_dast_profile`) as part of its reasoning chain.  
**Success Criteria:** All 37+ tools appear in the manifest with correct schemas. Tool invocations return valid JSON responses within timeout.

---

### UC-008: End-to-End Simulation Rehearsal

**Actor:** Security Trainer / CTF Competitor  
**Trigger:** User wants to rehearse or study a complete attack scenario  
**Description:** User runs `run_e2e_simulation` with scenario "web-app" and depth "standard". NATT chains reconnaissance, authentication testing, vulnerability assessment, and JWT analysis tools, producing a consolidated findings report.  
**Success Criteria:** Simulation completes successfully, all phases execute, report generated in requested format.

---

### UC-009: Emergency Memory Sanitization

**Actor:** Field Ops Specialist  
**Trigger:** Device is at risk of physical seizure or compromise  
**Description:** Operator executes the panic wipe via dashboard panic button or pre-configured terminal alias. All four memory files are immediately deleted. System logs the wipe event (to stdout only, not disk).  
**Success Criteria:** All memory files wiped within 2 seconds of confirmation. Server continues running (no crash). Subsequent vault/AAR reads return empty results.

---

### UC-010: Compliance Mapping for DevSecOps Pipeline

**Actor:** DevSecOps Engineer  
**Trigger:** Engineer needs to map a new security control to compliance frameworks  
**Description:** Engineer uses `get_compliance_mapping` to see how a control maps to OWASP, NIST, PCI-DSS, and ISO 27001. Uses `get_devsecops_guidance` to identify integration points in their CI/CD pipeline (GitHub Actions, GitLab CI).  
**Success Criteria:** Control mapped to ≥ 3 frameworks. Pipeline integration steps provided for the engineer's declared platform.

---

## 5. Functional Requirements

### FR-001: MCP Server
The system SHALL implement a compliant MCP server supporting `tools/list` and `tools/call` endpoints via stdio transport.

### FR-002: REST API
The system SHALL expose a REST API on a configurable port (default 3000) providing access to all tool handlers.

### FR-003: Tool Registry
The system SHALL maintain a registry of ≥ 35 named tools accessible via both MCP and REST API.

### FR-004: Input Validation
The system SHALL validate all tool inputs using schema validation (Zod) before handler execution and return 400/422 errors on invalid input.

### FR-005: Password Vault
The system SHALL persist password vault entries to `.natt-memory/password-vault.json` and support store, retrieve, and list operations.

### FR-006: AAR Memory
The system SHALL persist after-action review entries to `.natt-memory/aar-history.json` with full AAR schema including mission ID, outcome, tools used, and lessons learned.

### FR-007: Algorithm Weights
The system SHALL maintain and automatically update algorithm effectiveness weights in `.natt-memory/algorithm-weights.json` after each AAR submission using an exponential moving average.

### FR-008: Feedback Collection
The system SHALL accept tool feedback (1–5 rating, optional comment) via `/api/feedback` and persist to `feedback-log.json`.

### FR-009: Health Monitoring
The system SHALL provide a `/api/health` endpoint returning system status, memory file availability, uptime, and tool count.

### FR-010: Panic Wipe
The system SHALL provide a `/api/panic` endpoint that, upon correct confirmation string, immediately deletes all four memory files and returns a confirmation response.

### FR-011: Static Dashboard UI
The system SHALL serve a browser-based dashboard at `/` that provides a graphical interface for all API endpoints without requiring command-line usage.

### FR-012: E2E Simulation
The system SHALL support end-to-end scenario simulations that chain ≥ 4 tool calls and produce a consolidated report.

### FR-013: JWT Analysis
The system SHALL decode, analyze, and identify attack vectors for JWT tokens without requiring a signature key.

### FR-014: Hash Identification
The system SHALL identify hash algorithms from hash strings for ≥ 20 common hash types with confidence rating.

### FR-015: VPN Analysis
The system SHALL analyze VPN configuration files and identify security issues for OpenVPN, WireGuard, and IPSec configurations.

### FR-016: Offline Operation
The system SHALL function with zero outbound network connections during normal operation. All knowledge SHALL be embedded in the application bundle.

### FR-017: ROE Validation
The system SHALL evaluate engagement parameters against a structured Rules of Engagement checklist and return itemized pass/warn/fail results.

### FR-018: Secret Scanning
The system SHALL scan provided text content for embedded secrets using pattern matching for ≥ 15 secret types (API keys, passwords, tokens, etc.).

### FR-019: Default Credentials
The system SHALL return known default credentials for common vendors and products, sourced from the embedded knowledge base.

### FR-020: Portable Deployment
The system SHALL support deployment on Raspberry Pi 4 (ARM64), Android via Termux, Windows, macOS, and Linux without code modification.

---

## 6. Non-Functional Requirements

### NFR-001: Performance
All static tool responses SHALL complete within 200ms at p99 under single-operator load on a Raspberry Pi 4. E2E simulations (standard depth) SHALL complete within 5000ms.

### NFR-002: Reliability
The server SHALL achieve 99.5% uptime during active field operation. The systemd service SHALL automatically restart on unexpected exit within 10 seconds.

### NFR-003: Offline Capability
The system SHALL operate without any internet connectivity. Zero external API calls SHALL be made during tool execution. All knowledge SHALL be embedded at build time.

### NFR-004: Security — Input Sanitization
All tool name parameters SHALL be sanitized to prevent path traversal, command injection, and null byte attacks. Tool args SHALL be validated with strict Zod schemas before execution.

### NFR-005: Security — Memory Protection
The `.natt-memory/` directory SHALL be created with 700 permissions (owner read/write/execute only). Password vault entries SHALL carry appropriate classification warnings when RESTRICTED data is detected.

### NFR-006: Data Integrity
Memory files SHALL be validated as parseable JSON on read. Corrupted files SHALL trigger a health warning via `/api/health` rather than crashing the server.

### NFR-007: Footprint
The full application (excluding Node.js runtime) SHALL occupy ≤ 100 MB on disk. The process SHALL consume ≤ 256 MB RAM under normal operation on a Pi 4.

### NFR-008: Usability
The dashboard UI SHALL be usable in a browser with no internet access (all assets served locally). Tool results SHALL be human-readable without requiring API documentation.

### NFR-009: Maintainability
TypeScript source files SHALL maintain strict mode compilation with zero type errors. All new tools SHALL follow the existing handler pattern with full input schema definition.

### NFR-010: Audit Trail
All panic wipe operations SHALL be logged to stdout with timestamp, operator (if provided), and reason. Memory write operations SHALL log to stdout in development mode.

---

## 7. Out of Scope

The following capabilities are explicitly excluded from NATT Tactical Dashboard v1.0:

| Excluded Feature | Rationale |
|-----------------|-----------|
| Live network scanning | Requires OS-level packet capabilities; out of scope for knowledge tool |
| Exploit payload generation | Legal/ethical risk; NATT provides guidance only |
| Automated vulnerability exploitation | Same as above |
| Real-time CVE feed integration | Requires internet; conflicts with offline-first design |
| User authentication / multi-user | Designed for single-operator use; auth adds complexity |
| Cloud backup / sync | Conflict with offline-first and operational security requirements |
| Mobile native app (iOS/Android APK) | Termux covers Android; iOS restrictions prevent self-hosting |
| Crypto mining or coin operations | Out of scope for security tool |
| AI model hosting (LLM inference) | Requires significant compute; NATT tools via MCP for that |
| SCADA/ICS/OT-specific tooling | Specialized domain; planned for future NATT-ICS module |
| Wireless (Wi-Fi/BT) attack tools | OS-level driver dependency; out of scope |
| Legal advice | NATT provides ROE assistance, not legal counsel |

---

## 8. Acceptance Criteria — Open Day Launch

The following criteria must ALL be met before NATT Tactical Dashboard is presented at Open Day 2026:

| # | Criterion | Verification Method |
|---|-----------|---------------------|
| AC-1 | All 37 tools return valid JSON responses via REST API | Automated test suite — all pass |
| AC-2 | Dashboard UI loads in browser and submits tool calls successfully | Manual walkthrough on demo hardware |
| AC-3 | System operates fully offline (no internet required) | Tested with interface disconnected |
| AC-4 | Raspberry Pi 4 deployment achieves < 2s cold start | Timed measurement |
| AC-5 | Password vault stores and retrieves 10 test entries correctly | Functional test |
| AC-6 | AAR submission updates algorithm weights | Before/after weight comparison |
| AC-7 | Panic wipe deletes all 4 memory files and returns HTTP 200 | Manual test |
| AC-8 | MCP server responds to tools/list request from Claude | Live Claude API test |
| AC-9 | E2E simulation (web-app, standard) completes in < 5s | Timing test × 3 runs |
| AC-10 | User Guide, FAQ, Quick Start, Technical Manual, Spec Annex, BRD, and Maintenance Checklist all exist and are readable | File existence + review |
| AC-11 | identify_hash correctly identifies MD5, SHA-256, and bcrypt | Unit tests |
| AC-12 | validate_roe_checklist returns WARN for incomplete authorization | Unit test with incomplete input |
| AC-13 | Server survives 60 consecutive tool calls without error | Load test |
| AC-14 | Memory files survive server restart | Stop/start + read verification |

---

## 9. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R-01 | Operator uses NATT without proper authorization | Medium | Critical | Prominent ROE validation tool; legal disclaimer in UI |
| R-02 | Memory files accessed by unauthorized party on shared device | Medium | High | Document file system encryption requirement; 700 permissions default |
| R-03 | Dependency vulnerability in Express/Node.js | Low | Medium | `npm audit` in CI; dependency pinning; regular updates procedure |
| R-04 | MicoSD card failure on Pi deployment | Medium | Medium | Documented backup procedure; recommend high-endurance card |
| R-05 | Tool knowledge base becomes outdated (CVEs, techniques) | High | Medium | Knowledge base version-stamped; update process documented; AAR feedback system |
| R-06 | Panic wipe fails under disk pressure | Low | Critical | Handle ENOSPC in panic handler; verify wipe with exists-check in response |
| R-07 | Open Day demo hardware fails | Low | High | Maintain backup Pi; test all AC criteria morning of event |
| R-08 | Regulatory / legal challenge to distributing security tool | Low | High | Clear legitimate use documentation; no payload generation; ROE-first design |

---

## 10. Success Metrics

### 10.1 Technical KPIs

| KPI | Target | Measurement |
|-----|--------|-------------|
| Tool coverage | 37 tools available | Tool registry count |
| API response time (p95) | < 150ms | Server timing logs |
| AAR submission success rate | > 99% | Error rate in feedback log |
| Weight improvement over 10 AARs | ≥ 5% increase in avg tool effectiveness | Before/after weight comparison |
| System uptime (field deployment) | ≥ 99.5% per week | systemd restart counter |
| Memory file corruption rate | 0 incidents | Health check monitoring |

### 10.2 Operational KPIs

| KPI | Target | Measurement |
|-----|--------|-------------|
| Time from power-on to first tool result | < 30 seconds (including Pi boot) | Timed demo walkthrough |
| Tools used per session (avg) | ≥ 5 tools | Session logging |
| AAR submissions per engagement | ≥ 1 per completed engagement | aar-history.json entry count |
| Panic wipe execution time | < 2 seconds | Timing test |
| Open Day demo success | Zero critical failures during demonstration | Post-event review |

### 10.3 User Adoption KPIs (Post-Launch)

| KPI | 30-Day Target | 90-Day Target |
|-----|--------------|---------------|
| Active deployments | 5 | 20 |
| Total AAR entries across all deployments | 25 | 150 |
| Average tool rating (from feedback) | ≥ 4.0/5.0 | ≥ 4.2/5.0 |
| GitHub stars / forks | 10 | 50 |
| Feature requests submitted | ≥ 5 | ≥ 15 |
| Documented use cases from users | 3 | 10 |

---

*End of Business Requirements Document — NATT-BRD-001 v1.0.0*
