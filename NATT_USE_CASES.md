# NATT Ghost Agent — Use Cases

> **N**etwork **A**ttack & **T**esting **T**oolkit  
> Ethical research only. All active modes require `authorizationProof`.  
> Ghost Modes: `passive` → read-only recon · `stealth` → low-impact probes · `active` → full test

---

## Table of Contents

1. [Applied Scraping & Fetching](#1-applied-scraping--fetching)
2. [Applied HTML Analysis](#2-applied-html-analysis)
3. [Applied API Recon](#3-applied-api-recon)
4. [Applied Auth & Access Bypass Research](#4-applied-auth--access-bypass-research)
5. [Applied Secrets Detection](#5-applied-secrets-detection)
6. [Applied OSINT & Domain Recon](#6-applied-osint--domain-recon)
7. [Applied Network Recon](#7-applied-network-recon)
8. [Applied Code Analysis](#8-applied-code-analysis)
9. [Applied Media Scaffolding](#9-applied-media-scaffolding)
10. [Applied Reporting & Delivery](#10-applied-reporting--delivery)
11. [Ghost Mode Patterns](#11-ghost-mode-patterns)
12. [Composite Full-Ghost Scenarios](#12-composite-full-ghost-scenarios)

---

## 1. Applied Scraping & Fetching

Mission type: `web-app` · `api-recon` · Ghost mode: `passive` → `stealth`

| Use Case | Target Type | What NATT Does |
|---|---|---|
| **JS framework fingerprint** | URL | Fetches page, extracts `<script>` tags, identifies React / Vue / Angular / Next.js / Nuxt from bundle names and globals |
| **Sitemap enumeration** | Domain | Fetches `/sitemap.xml`, `/sitemap_index.xml`, `/robots.txt`, builds full URL tree |
| **Technology stack detection** | URL | Reads response headers (`X-Powered-By`, `Server`, `Via`), HTML meta tags, cookie names to infer backend, CDN, WAF |
| **Third-party dependency scan** | HTML string | Extracts all `<script src>` and `<link href>` origins, flags known CDN vs self-hosted, identifies SRI mismatches |
| **Social media OG tag harvest** | URL | Pulls `og:title`, `og:image`, `og:description`, `twitter:card` — useful for brand monitoring |
| **Form intelligence gathering** | HTML string | Finds all `<form>` elements, extracts action/method, hidden inputs, CSRF token presence |
| **Cookie surface map** | URL | Documents all `Set-Cookie` headers, flags missing `HttpOnly`, `Secure`, `SameSite` |
| **Error page fingerprinting** | URL | Probes with intentionally malformed requests to map error disclosure (stack traces, version numbers, config paths) |

**Slack invocation examples:**
```
@DevBot natt passive-recon https://example.com
@DevBot natt scrape-headers https://api.example.com/v1/login
@DevBot natt map-sitemap domain:example.com
```

---

## 2. Applied HTML Analysis

Mission type: `html-analysis` · Ghost mode: `passive`

| Use Case | What NATT Checks |
|---|---|
| **CSP policy audit** | Parses `Content-Security-Policy`, flags `unsafe-inline`, `unsafe-eval`, wildcard origins, missing `default-src` |
| **DOM XSS surface** | Identifies `innerHTML`, `document.write`, `eval()`, `setTimeout(string)` sinks in inline scripts |
| **Input vector inventory** | Maps all `<input>`, `<textarea>`, `<select>`, hidden fields — baseline for injection testing |
| **Reflected parameter detection** | Checks if URL query params appear verbatim in HTML response (reflection surface) |
| **HTML injection sink map** | Finds places where server-rendered content could accept injected markup |
| **Form CSRF posture** | Verifies presence of anti-CSRF tokens, checks token placement (visible vs hidden), checks SameSite cookie policy |
| **Inline secret exposure** | Scans inline `<script>` blocks with 80+ secret patterns — API keys, tokens, .env values hardcoded in HTML |
| **Password field posture** | Checks `autocomplete="off"`, `type="password"` correctness, password-reveal button injection risk |
| **iFrame sandboxing** | Flags unscoped `<iframe>` embeds, missing `sandbox` attribute, `allow-scripts` without isolation |
| **Subresource integrity** | Checks all third-party `<script>` and `<link>` for `integrity=` attribute presence |

---

## 3. Applied API Recon

Mission type: `api-recon` · Ghost mode: `passive` → `stealth` → `active`

| Use Case | What NATT Does |
|---|---|
| **Endpoint discovery** | Probes common paths (`/api/v1`, `/swagger`, `/openapi.json`, `/graphql`, `/.well-known/*`) |
| **HTTP method override recon** | Tests `X-HTTP-Method-Override`, `X-Method-Override`, `_method` param for PUT/DELETE escalation |
| **Auth header enumeration** | Identifies accepted auth schemes: Bearer, Basic, API-Key, x-api-key, Cookie |
| **CORS misconfiguration test** | Sends crafted `Origin:` headers, checks `Access-Control-Allow-Origin: *` and `Allow-Credentials: true` combo |
| **Rate limit surface** | Probes identical requests in burst sequence, checks for `Retry-After`, `X-RateLimit-*` headers |
| **Versioning & shadow API** | Probes `/v0`, `/v2`, `/internal`, `/admin`, `/debug` paths — finds deprecated or undocumented versions |
| **GraphQL introspection** | Sends `{__schema{types{name}}}` — maps full schema if introspection is enabled |
| **File upload vector** | Locates multipart upload endpoints, tests MIME type validation, filename sanitization |
| **Mass assignment probe** | Sends extra fields in POST/PUT bodies (e.g., `role`, `admin`, `isActive`) — checks if silently accepted |
| **Error message verbosity** | Sends malformed payloads to extract stack trace, DB error, framework version from response bodies |

---

## 4. Applied Auth & Access Bypass Research

Mission type: `auth-testing` · Ghost mode: `stealth` → `active`

### 4.1 JWT Attacks
| Use Case | Technique |
|---|---|
| **Algorithm confusion** | HS256/RS256 swap — sign with public key as HMAC secret |
| **None algorithm bypass** | Set `alg: "none"`, remove signature, trailing dot trick |
| **Weak secret brute force** | Entropy analysis → flag low-entropy secrets (`HS256` with `secret123`) |
| **Claim tampering** | Modify `sub`, `role`, `exp`, `iat` — check if server re-validates |
| **Kid injection** | Inject SQL or path traversal in `kid` header claim |

### 4.2 OAuth 2.0 Flows
| Use Case | Technique |
|---|---|
| **Redirect URI manipulation** | Test `%2F`, open redirect chains, `@attacker.com`, subdomain matching |
| **PKCE bypass** | Omit `code_challenge` — test if server requires it |
| **State parameter forgery** | Test CSRF via missing or static `state` param |
| **Token leakage in referrer** | Check if `#access_token` appears in implicit flow URL fragments logged to analytics |

### 4.3 Session Management
| Use Case | Technique |
|---|---|
| **Session fixation** | Pre-set session cookie, authenticate, check if token rotated |
| **Session prediction** | Collect 5+ tokens, analyze entropy and sequential patterns |
| **Concurrent session abuse** | Test if multiple sessions allowed without notification |
| **Logout completeness** | Verify session is invalidated server-side, not just cookie-deleted |

### 4.4 Password & MFA
| Use Case | Technique |
|---|---|
| **Password reset token entropy** | Request multiple resets, compare token randomness and expiry |
| **MFA response manipulation** | Intercept, swap failure → success in API response |
| **MFA code reuse** | Test if same OTP is accepted twice |
| **Backup code enumeration** | Check if backup codes are 6-digit numeric (brute-forceable) |
| **Account lockout policy** | Test after N failures — presence of lockout, lockout bypass via IP rotation |

### 4.5 SQL Auth Bypass
```
Classic payloads (WAF testing — authorized targets only):
  ' OR '1'='1
  admin'--
  ' OR 1=1--
  ') OR ('1'='1
```

---

## 5. Applied Secrets Detection

Mission type: `code-analysis` · `web-app` · Ghost mode: `passive`

NATT ships 80+ compiled secret patterns. Applied use cases:

| Use Case | Target | Patterns Used |
|---|---|---|
| **Source code secret scan** | File path / repo | AWS keys, GCP service accounts, GitHub PATs, Stripe keys, Twilio, SendGrid, JWT secrets, .env values |
| **Git history mining** | Repository | Scans all commits for introduced secrets — catches keys deleted from HEAD but alive in history |
| **API response secret leak** | API endpoint | Scans response bodies for accidentally returned secrets in JSON, headers, cookies |
| **Build artifact audit** | HTML/JS bundle | Scans minified bundles for high-entropy strings > 4.0 bits/char (Shannon entropy) |
| **Environment variable exposure** | HTML + response | Detects `REACT_APP_*`, `VUE_APP_*`, `NEXT_PUBLIC_*` leaking into client bundles |
| **Cloud provider key validation** | Text | Validates AWS (`AKIA…`), GCP JSON format, Azure connection strings —format-checks before flagging |
| **Dockerfile/CI secret audit** | File path | Checks `ENV`, `ARG`, and `RUN` commands for hardcoded credentials |
| **Log file credential sweep** | File path | Scans application logs for accidental credential logging (Bearer tokens, Basic auth strings) |

**Detection thresholds:**
- Shannon entropy > 4.0 bits/char + length > 16 chars → flagged as likely secret
- Matched against 80+ compiled regex patterns before entropy fallback

---

## 6. Applied OSINT & Domain Recon

Mission type: `osint` · Ghost mode: `passive`

| Use Case | Technique |
|---|---|
| **Subdomain enumeration** | Certificate transparency logs (crt.sh), DNS brute via wordlist, NSEC zone walking |
| **DNS intelligence** | A, AAAA, MX, TXT, SPF, DKIM, DMARC record analysis — mail spoofing posture |
| **Google dork generation** | Generates targeted `site:`, `filetype:`, `inurl:`, `intitle:` dorks for the target domain |
| **Certificate transparency** | Pulls all issued certs for domain — reveals internal subdomains, wildcard usage |
| **WHOIS footprint** | Registrar, registration date, name server, RDAP data — org footprint mapping |
| **Email header analysis** | SPF/DKIM/DMARC posture — determines if domain is spoofable |
| **ASN & IP range mapping** | Maps IP ranges owned by org — identifies infra not behind CDN |
| **Shodan/Censys profile** | Builds query to find internet-facing assets for target org (manual submission pattern) |
| **Wayback Machine delta** | Identifies pages existing in archive but removed from current site — old admin panels, API docs |
| **LinkedIn org recon** | Generates OSINT questions around tech stack disclosure from job postings |

---

## 7. Applied Network Recon

Mission type: `network-recon` · Ghost mode: `passive` → `stealth`

| Use Case | What NATT Does |
|---|---|
| **Top port analysis** | Analyzes results from nmap/masscan output — identifies service running on each open port |
| **Banner grabbing interpretation** | Parses service banners to extract version numbers, flags EOL software |
| **SSL/TLS posture** | Protocol version support (TLS 1.0/1.1 detection), cipher suite weakness, cert expiry, chain validation |
| **HTTP security headers audit** | HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |
| **CDN/WAF detection** | Identifies Cloudflare, AWS CloudFront, Fastly, Akamai from headers and IP ranges |
| **Service fingerprinting** | Maps `nginx`, `Apache`, `IIS`, `Caddy` version from `Server:` header + error page signatures |
| **Firewall rule inference** | Tests filtered vs closed vs open ports — infers ACL patterns |
| **IPv6 surface** | Checks if IPv6 addresses have weaker posture than IPv4 equivalent |

---

## 8. Applied Code Analysis

Mission type: `code-analysis` · Ghost mode: `passive`

| Use Case | What NATT Does |
|---|---|
| **Dependency vulnerability correlation** | Maps `package.json` / `requirements.txt` deps to known CVE patterns |
| **Insecure deserialization patterns** | Flags `JSON.parse(userInput)`, `eval()`, `pickle.loads()`, `yaml.load()` without SafeLoader |
| **Path traversal surface** | Finds string concatenation into file paths, flags missing `path.resolve` + `startsWith` validation |
| **Command injection surface** | Identifies `exec(string)`, `shell=True`, `execSync(string)` — recommends array-arg variants |
| **Prototype pollution** | Flags `Object.assign({}, user)`, `lodash.merge` with user input, `__proto__` key checks |
| **XXE in XML parsers** | Checks for DTD/external entity disabling in XML parse configurations |
| **Regex DoS (ReDoS)** | Analyzes regex patterns with nested quantifiers + alternation applied to user input |
| **Timing attack exposure** | Flags `===` for secret/token comparison — recommends `crypto.timingSafeEqual()` |
| **Insecure randomness** | Flags `Math.random()` usage for security-sensitive contexts (tokens, session IDs) |
| **SSRF surface** | Finds user-controlled URLs passed to `fetch()`, `axios.get()`, `requests.get()` without validation |

---

## 9. Applied Media Scaffolding

Mission type: `web-app` · `code-analysis` · Ghost mode: `passive`

NATT's media scaffolding capabilities focus on security posture of media handling pipelines and content generation surfaces.

| Use Case | What NATT Does |
|---|---|
| **File upload security audit** | MIME type bypass testing, double extension (`file.php.jpg`), null byte injection in filenames, path traversal in filename |
| **Image metadata extraction** | EXIF/IPTC data exposure — GPS coordinates, camera info, software version in uploaded images |
| **Media CDN configuration** | Hotlinking exposure, signed URL enforcement, CORS on media origin, cache poisoning via `Vary` header |
| **SVG XSS vector** | Analyzes SVG uploads for embedded `<script>`, `<foreignObject>`, `xlink:href` XSS vectors |
| **PDF metadata disclosure** | Identifies author, creation software, internal path exposure in PDF metadata via NATT analysis prompts |
| **Video/audio streaming surface** | HLS/DASH manifest analysis for token-gated vs open stream exposure, segment URL predictability |
| **Content injection via media** | Checks if image/video URLs are reflected in HTML without encoding (polyglot file risks) |
| **Generated content watermarking** | Documents absence of provenance metadata in AI-generated media (deepfake detection surface) |
| **Media processing pipeline** | Identifies insecure eval in server-side image processing (ImageMagick, FFmpeg argument injection) |
| **Report media export** | NATT generates PPTX mission reports with embedded evidence screenshots and finding metadata via `natt-report.ts` |

**PPTX Report Scaffolding** (built-in via `natt-report.ts`):
```
@DevBot natt-report last-30-days          → 10-slide PowerPoint, all missions
@DevBot natt-report --from 2026-01-01     → Custom date range report
@DevBot natt-report --operator U123456    → Filter by operator
@DevBot /natt-report                      → Slash command with modal
```

---

## 10. Applied Reporting & Delivery

| Use Case | Mechanism |
|---|---|
| **On-demand PPTX mission brief** | `/natt-report` → 10-slide deck: cover, exec summary, mission matrix, findings, top vulns, attack chain, lateral map, timeline, remediation, appendix |
| **Scheduled Slack delivery** | `/natt-cron add` → BullMQ-backed cron, auto-posts report to channel on schedule |
| **Finding severity breakdown** | Critical/High/Medium/Low count in each report slide + CVE/CVSS/OWASP mapping |
| **Mermaid attack chain diagram** | `missionToMermaid()` — flowchart of recon → exploit → escalation steps |
| **Markdown finding dump** | `missionToMarkdown()` — paste-ready findings for GitHub issues, Notion, Confluence |
| **Vault mission archive** | All missions stored in `.natt/vault/` — queryable by date range, operator, severity |
| **Cron health monitor** | `CronHealthReport` — fleet-wide view of active/paused/errored jobs + overdue detection |
| **Fleet-wide status** | `createNATTStatus()` — active polecats, mission counts, finding totals, runtime map |

---

## 11. Ghost Mode Patterns

| Mode | Behavior | When to Use |
|---|---|---|
| `passive` | Read-only — fetches, parses, analyzes. Zero writes. No auth probes. | Initial recon, HTML analysis, secret scans, OSINT |
| `stealth` | Low-impact probes — rate-limited requests, no brute force, single-try vectors | API endpoint mapping, header analysis, CORS check |
| `active` | Full test suite — auth bypass probes, fuzzing, multi-payload sends | Authorized penetration tests with proof token |

**Anti-detection defaults in stealth/passive:**
- Random 800–2400ms delay between requests
- Rotate User-Agent strings (no Googlebot or known scanner strings)
- Respect `robots.txt` directives
- Max 1 concurrent request per host
- Cool-off if 429 received (exponential backoff)

---

## 12. Composite Full-Ghost Scenarios

### Scenario A: New SaaS App Assessment
```
Mission: full-ghost
Target: https://app.target.com
Mode: stealth → active (with authProof)

Phase 1 (passive):   HTML fingerprint → tech stack → form map → CSP audit
Phase 2 (passive):   Sitemap recon → endpoint discovery → API schema probe
Phase 3 (stealth):   CORS test → auth header enum → rate limit surface
Phase 4 (active):    JWT audit → session fixation test → SQL auth bypass probe
Phase 5 (passive):   Secret scan on response bodies → credential exposure analysis
Output:              PPTX report + Markdown dump + vault archive
```

### Scenario B: API Security Baseline
```
Mission: api-recon + auth-testing
Target: https://api.target.com/v1
Mode: stealth

Steps: openapi discovery → endpoint tree → auth scheme enum →
       CORS misconfiguration → method override → GraphQL introspection →
       mass assignment probe → JWT weakness scan → rate limit test
Output: Finding list sorted by severity, OWASP mapping, remediation table
```

### Scenario C: Pre-Launch Secrets Audit
```
Mission: code-analysis
Target: file-path /repo
Mode: passive

Steps: git history scan → .env pattern sweep → inline JS secret scan →
       dependency CVE correlation → hardcoded credential detection →
       Shannon entropy flagging on all string literals > 20 chars
Output: Secret inventory with severity, location, recommended rotation actions
```

### Scenario D: Scheduled Weekly Intelligence Report
```
/natt-cron add
  Cadence: weekly (Monday 08:00 ET)
  Window:  last-7-days
  Channel: #security-ops
  Title:   Weekly Ghost Intel Brief

Auto-delivers: 10-slide PPTX every Monday with all missions from prior week
```

---

## Quick Reference: Mission Type × Skill Matrix

| Skill Area | `web-app` | `html-analysis` | `api-recon` | `auth-testing` | `osint` | `network-recon` | `code-analysis` | `full-ghost` |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Scraping / fetching | ✓ | ✓ | ✓ | | ✓ | ✓ | | ✓ |
| HTML analysis | ✓ | ✓ | | | | | ✓ | ✓ |
| API recon | ✓ | | ✓ | ✓ | | | | ✓ |
| Auth bypass research | | | ✓ | ✓ | | | | ✓ |
| Secrets detection | ✓ | ✓ | ✓ | | | | ✓ | ✓ |
| OSINT / domain recon | | | | | ✓ | ✓ | | ✓ |
| Network recon | | | | | | ✓ | | ✓ |
| Code analysis | | | | | | | ✓ | ✓ |
| Media scaffolding | ✓ | ✓ | | | | | ✓ | ✓ |
| Report generation | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
