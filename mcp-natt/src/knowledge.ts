/**
 * NATT MCP Knowledge Server — src/knowledge.ts
 *
 * Knowledge base for the NATT Ghost Agent MCP server:
 *  • ROE templates and guidance
 *  • Password attack techniques and tools
 *  • Auth bypass research patterns
 *  • Secret detection signatures
 *  • Mission methodology checklists
 */

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ROETemplate {
  id: string;
  name: string;
  description: string;
  missionType: string;
  scopeGuidance: string[];
  timeWindowGuidance: string;
  forbiddenTechniques: string[];
  requiredContacts: string[];
  evidenceRequirements: string[];
  classification: string;
}

export interface PasswordAttackTechnique {
  id: string;
  name: string;
  category: "offline" | "online" | "hybrid" | "rainbow" | "wordlist";
  description: string;
  tools: string[];
  commands: string[];
  defensesBypass: string;
  mitigation: string;
  owasp: string;
}

export interface AuthBypassTechnique {
  id: string;
  name: string;
  category: string;
  severity: string;
  description: string;
  prerequisites: string[];
  steps: string[];
  payloads?: string[];
  remediation: string;
  references: string[];
}

export interface SecretSignature {
  id: string;
  name: string;
  provider: string;
  pattern: string;
  description: string;
  severity: string;
  remediation: string;
}

export interface MissionChecklist {
  missionType: string;
  phases: MissionPhase[];
}

export interface MissionPhase {
  phase: string;
  objective: string;
  steps: string[];
  tools: string[];
  outputArtifacts: string[];
}

export interface ReverseEngineeringKnowledge {
  id: string;
  category: "basic" | "advanced" | "tools" | "resources" | "practice";
  name: string;
  description: string;
  techniques?: string[];
  tools?: string[];
  links?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
//  ROE Templates
// ─────────────────────────────────────────────────────────────────────────────

export const ROE_TEMPLATES: ROETemplate[] = [
  {
    id: "roe-webapp",
    name: "Web Application Assessment ROE",
    description: "Standard ROE for web application penetration testing engagements.",
    missionType: "web-app",
    scopeGuidance: [
      "Define target hostnames/IP ranges explicitly in-scope",
      "List all domains including staging/dev environments",
      "Specify which authenticated user roles are in-scope",
      "Exclude third-party services (CDN, payment processors) unless explicitly approved",
      "Define test account credentials to be provisioned by client",
    ],
    timeWindowGuidance:
      "Web app testing: prefer business hours (09:00–17:00 Mon–Fri local time) unless client approves 24/7. Active scanning should avoid peak traffic hours.",
    forbiddenTechniques: [
      "Denial-of-Service (flooding, resource exhaustion)",
      "Destructive SQL operations (DROP, TRUNCATE, DELETE on real data)",
      "Access to non-test-account user data",
      "Social engineering of client staff",
      "Physical access testing",
      "Sending emails or notifications to real users",
    ],
    requiredContacts: ["Primary technical contact", "Emergency escalation contact"],
    evidenceRequirements: [
      "Screenshot with timestamp for each finding",
      "HTTP request/response pair (redact auth tokens)",
      "Reproduction steps using test account only",
      "CVSS score with justification",
    ],
    classification: "confidential",
  },
  {
    id: "roe-network",
    name: "Network Infrastructure Assessment ROE",
    description: "ROE for network scanning and infrastructure assessments.",
    missionType: "network-recon",
    scopeGuidance: [
      "Define IP ranges and CIDR blocks in-scope",
      "List excluded critical infrastructure (hospitals, ICS, production databases)",
      "Specify nmap intensity limits (max -T3 for production)",
      "Confirm cloud assets (AWS/Azure) are in scope with written consent",
    ],
    timeWindowGuidance:
      "Network scanning: run outside business hours (22:00–06:00) to avoid impacting operations. Coordinate with network team.",
    forbiddenTechniques: [
      "UDP flood or SYN flood",
      "Exploit any discovered vulnerabilities without separate escalation approval",
      "Scan industrial control systems (ICS/SCADA)",
      "Interference with production backups",
    ],
    requiredContacts: ["Network operations center (NOC)", "Primary technical contact", "Emergency"],
    evidenceRequirements: [
      "Full nmap scan XML output",
      "SSL/TLS scan results",
      "Service version enumeration results",
    ],
    classification: "confidential",
  },
  {
    id: "roe-osint",
    name: "OSINT / Passive Reconnaissance ROE",
    description: "ROE for passive intelligence gathering from public sources.",
    missionType: "osint",
    scopeGuidance: [
      "Public sources only — no authenticated access to non-client systems",
      "No direct interaction with individuals discovered in OSINT",
      "No creation of fake identities or phishing simulations",
      "Record all sources for evidence chain",
    ],
    timeWindowGuidance:
      "OSINT is passive — no time window restrictions. However, notify client if active threat indicators discovered.",
    forbiddenTechniques: [
      "Contacting discovered individuals",
      "Accessing private repositories or private social profiles",
      "Creating fake social media accounts",
      "Scraping personal contact data beyond organizational level",
    ],
    requiredContacts: ["Primary contact for active threat escalation"],
    evidenceRequirements: [
      "URL and timestamp for each OSINT finding",
      "Screenshot from public source",
      "Data classification tag for each item",
    ],
    classification: "confidential",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  Password Attack Techniques
// ─────────────────────────────────────────────────────────────────────────────

export const PASSWORD_ATTACK_TECHNIQUES: PasswordAttackTechnique[] = [
  {
    id: "pa-01",
    name: "Dictionary Attack",
    category: "wordlist",
    description:
      "Attempt authentication using a list of common passwords. Most effective against accounts without lockout policies.",
    tools: ["hashcat", "john", "hydra", "medusa"],
    commands: [
      "hashcat -m 0 -a 0 hashes.txt /usr/share/wordlists/rockyou.txt",
      "john --wordlist=/usr/share/wordlists/rockyou.txt hashes.txt",
      "hydra -L users.txt -P passwords.txt ssh://target",
    ],
    defensesBypass: "Account lockout, CAPTCHA, IP blocking",
    mitigation:
      "Require strong passwords (≥12 chars, complex). Implement account lockout after 5–10 failures. Enable MFA.",
    owasp: "A07:2021 – Identification and Authentication Failures",
  },
  {
    id: "pa-02",
    name: "Password Spray",
    category: "online",
    description:
      "Try a common password across many accounts to avoid per-account lockout. Evades traditional lockout by staying under per-account threshold.",
    tools: ["spray", "ruler", "o365spray"],
    commands: [
      "spray -s https://login.microsoftonline.com -u users.txt -p 'Password123' -t 10",
      "python3 o365spray.py --spray -U users.txt -p 'Summer2024!' --count 1",
    ],
    defensesBypass: "Per-account lockout with low threshold",
    mitigation:
      "Detect spray attacks by monitoring failed logins across many accounts. Use SIEM correlation. Require MFA.",
    owasp: "A07:2021 – Identification and Authentication Failures",
  },
  {
    id: "pa-03",
    name: "Credential Stuffing",
    category: "online",
    description:
      "Use breached username/password pairs to authenticate against target systems. Exploits password reuse.",
    tools: ["snipr", "storm", "openbullet"],
    commands: ["# Use breached credential lists (HIBP) to test account validity"],
    defensesBypass: "Static rate limiting without intelligent detection",
    mitigation:
      "Check passwords against known breach databases (HIBP API). Implement bot detection (CAPTCHA, device fingerprint). Mandatory MFA.",
    owasp: "A07:2021 – Identification and Authentication Failures",
  },
  {
    id: "pa-04",
    name: "Offline Hash Cracking",
    category: "offline",
    description:
      "Crack password hashes extracted from databases. Requires obtaining the hash file first.",
    tools: ["hashcat", "john the ripper"],
    commands: [
      "hashcat -m 1000 -a 0 ntlm_hashes.txt rockyou.txt",
      "hashcat -m 3200 -a 0 bcrypt_hashes.txt wordlist.txt",
      "hashcat -m 1800 -a 3 sha512_hashes.txt '?l?l?l?l?d?d' -i",
    ],
    defensesBypass: "Offline — no lockout mechanisms apply",
    mitigation:
      "Use bcrypt/argon2id with adequate work factor. Salt all hashes. Rotate passwords if breach suspected.",
    owasp: "A02:2021 – Cryptographic Failures",
  },
  {
    id: "pa-05",
    name: "Rainbow Table Attack",
    category: "rainbow",
    description:
      "Pre-computed hash tables to reverse common passwords. Only effective against unsalted hashes.",
    tools: ["rcracki_mt", "ophcrack"],
    commands: ["rcracki_mt -h <hash> -o result.txt rainbow_tables/"],
    defensesBypass: "Unsalted passwords (MD5, SHA without salt, LM)",
    mitigation: "Always use a unique salt per password. Use KDFs (bcrypt/argon2) which salt by design.",
    owasp: "A02:2021 – Cryptographic Failures",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  Auth Bypass Techniques
// ─────────────────────────────────────────────────────────────────────────────

export const AUTH_BYPASS_TECHNIQUES: AuthBypassTechnique[] = [
  {
    id: "ab-jwt-01",
    name: "JWT Algorithm Confusion (RS256→HS256)",
    category: "jwt",
    severity: "critical",
    description:
      "Forge a JWT by changing the algorithm from RS256 to HS256 and signing with the server's public key as the HMAC secret.",
    prerequisites: [
      "Obtain a valid JWT",
      "Obtain the server's public key (jwks.json or config)",
    ],
    steps: [
      "1. Decode JWT header and payload",
      "2. Change 'alg' field to 'HS256'",
      "3. Modify payload (e.g., elevate role)",
      "4. Re-sign with server public key as HMAC secret using HS256",
      "5. Send forged token and observe if accepted",
    ],
    remediation: "Pin allowed algorithms. Separate key handling for asymmetric/symmetric algorithms.",
    references: ["https://portswigger.net/web-security/jwt/algorithm-confusion"],
  },
  {
    id: "ab-jwt-02",
    name: "JWT kid Header Path Injection",
    category: "jwt",
    severity: "critical",
    description:
      "If the 'kid' header is unsanitized and used to read a key from disk, an attacker can point it to a predictable file (e.g., /dev/null) to produce a verifiable empty-secret token.",
    prerequisites: ["JWT uses 'kid' parameter", "Server reads signing key from filesystem based on kid"],
    steps: [
      "1. Change 'kid' to '/dev/null' or '../../../dev/null'",
      "2. Sign JWT with empty string as secret",
      "3. Send token — if server reads /dev/null as key, empty string verifies",
    ],
    payloads: ["/dev/null", "../../../dev/null", "../../../../etc/passwd"],
    remediation: "Sanitize and allowlist 'kid' values. Never use filesystem paths from JWT headers.",
    references: ["https://portswigger.net/web-security/jwt#injecting-self-signed-jwts-using-the-kid-parameter"],
  },
  {
    id: "ab-oauth-01",
    name: "OAuth State Parameter CSRF",
    category: "oauth",
    severity: "high",
    description: "Absence of state parameter in OAuth flow allows CSRF to link victim's account to attacker.",
    prerequisites: ["OAuth flow without state param", "Victim interaction"],
    steps: [
      "1. Start OAuth flow, capture authorization URL",
      "2. Remove or ignore the state parameter",
      "3. Send authorization URL to victim",
      "4. Victim completes auth, codes attacker's state into their session",
    ],
    remediation: "Always use unguessable random state param. Verify state server-side before exchanging code.",
    references: ["https://datatracker.ietf.org/doc/html/rfc6749#section-10.12"],
  },
  {
    id: "ab-session-01",
    name: "Insecure Direct Object Reference via Session",
    category: "session",
    severity: "high",
    description:
      "If session tokens or user IDs are predictable (sequential integer, timestamp), an attacker can enumerate other users' sessions.",
    prerequisites: ["Observable session ID pattern"],
    steps: [
      "1. Capture your session ID",
      "2. Analyze format — is it sequential? Timestamp-based?",
      "3. Enumerate nearby values to access other sessions",
    ],
    remediation: "Use cryptographically random session IDs (≥128 bits). Never use sequential IDs.",
    references: ["https://owasp.org/www-community/attacks/Session_hijacking_attack"],
  },
  {
    id: "ab-mfa-01",
    name: "MFA Bypass via Race Condition",
    category: "mfa",
    severity: "critical",
    description:
      "Submit the same OTP code simultaneously in parallel. If the server has a race condition in the one-time-use check, multiple requests can succeed with the same OTP.",
    prerequisites: ["TOTP or SMS OTP in use"],
    steps: [
      "1. Capture the OTP verification request",
      "2. Send 20–50 parallel requests with the same OTP",
      "3. If any succeed after the first, race condition confirmed",
    ],
    remediation: "Mark OTPs as used atomically (database transaction). Implement strict one-time semantics.",
    references: ["https://portswigger.net/web-security/race-conditions"],
  },
  {
    id: "ab-reset-01",
    name: "Password Reset Poisoning",
    category: "password-reset",
    severity: "high",
    description:
      "Inject a malicious Host header so the password reset link points to an attacker-controlled server.",
    prerequisites: ["Password reset feature exists", "Server uses Host header for reset link URL"],
    steps: [
      "1. Send password reset for victim's email",
      "2. Set Host header to attacker.com",
      "3. If victim clicks the link, reset token leaks to attacker",
    ],
    payloads: ["Host: attacker.com", "X-Forwarded-Host: attacker.com"],
    remediation: "Hardcode the application's domain in reset URL generation. Never use Host header directly.",
    references: ["https://portswigger.net/web-security/host-header/exploiting/password-reset-poisoning"],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  Mission Checklists
// ─────────────────────────────────────────────────────────────────────────────

export const MISSION_CHECKLISTS: MissionChecklist[] = [
  {
    missionType: "web-app",
    phases: [
      {
        phase: "Reconnaissance",
        objective: "Map target's attack surface without triggering alerts",
        steps: [
          "Crawl target with Burp Suite spider / OWASP ZAP passive scan",
          "Enumerate hidden directories (ffuf, gobuster)",
          "Identify technologies (Wappalyzer, headers, cookies)",
          "Map all forms, parameters, API endpoints",
          "Review robots.txt, sitemap.xml, .well-known",
          "Check for JavaScript source maps",
        ],
        tools: ["Burp Suite", "ffuf", "gobuster", "Wappalyzer", "hakrawler"],
        outputArtifacts: ["sitemap", "technology fingerprint", "parameter list"],
      },
      {
        phase: "Authentication Testing",
        objective: "Break down auth mechanisms",
        steps: [
          "Test for username enumeration via response timing and messages",
          "Check lockout policy (count failures before lockout)",
          "Test MFA bypass techniques",
          "Analyze session tokens for predictability",
          "Test password reset flow for token predictability",
          "Check for JWT vulnerabilities if token-based",
        ],
        tools: ["Burp Suite Intruder", "jwt_tool", "crunch"],
        outputArtifacts: ["auth security assessment", "JWT analysis if applicable"],
      },
      {
        phase: "Input Validation",
        objective: "Find injection and manipulation vulnerabilities",
        steps: [
          "Test all inputs for XSS (reflected, stored, DOM)",
          "Test for SQL injection (manual + sqlmap)",
          "Check for IDOR in IDs and GUIDs",
          "Test for SSRF in URL parameters",
          "Check file upload for unrestricted types",
          "Test for path traversal in file parameters",
        ],
        tools: ["Burp Suite Active Scan", "sqlmap", "dalfox", "nuclei"],
        outputArtifacts: ["injection vulnerability findings", "IDOR analysis"],
      },
      {
        phase: "Security Header Review",
        objective: "Identify missing/misconfigured security controls",
        steps: [
          "Check Content-Security-Policy",
          "Verify HSTS presence and max-age",
          "Confirm X-Frame-Options or CSP frame-ancestors",
          "Check cookie flags (Secure, HttpOnly, SameSite)",
          "Review CORS configuration",
        ],
        tools: ["securityheaders.com", "Burp Suite", "curl"],
        outputArtifacts: ["header analysis report"],
      },
    ],
  },
  {
    missionType: "auth-testing",
    phases: [
      {
        phase: "Credential Analysis",
        objective: "Assess password and credential security posture",
        steps: [
          "Observe minimum password requirements from the UI",
          "Test password policy enforcement (try weak passwords)",
          "Check for common password rejection",
          "Assess max password length",
          "Test username enumeration via error messages and timing",
        ],
        tools: ["Burp Suite", "crunch", "python requests"],
        outputArtifacts: ["password policy assessment"],
      },
      {
        phase: "JWT Analysis",
        objective: "Analyze JWT implementations",
        steps: [
          "Decode JWT header and identify algorithm",
          "Test for none algorithm",
          "Test algorithm confusion if RS256 in use",
          "Check expiry (exp) claim",
          "Look for sensitive data in payload",
          "Test kid header injection",
        ],
        tools: ["jwt_tool", "Burp Suite JWT editor", "python pyjwt"],
        outputArtifacts: ["JWT security assessment"],
      },
      {
        phase: "Session Management",
        objective: "Test session lifecycle security",
        steps: [
          "Verify session rotation after login",
          "Test session invalidation on logout",
          "Check session fixation possibility",
          "Analyze session token entropy",
          "Verify session timeout",
        ],
        tools: ["Burp Suite Sequencer", "python entropy analysis"],
        outputArtifacts: ["session security assessment"],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  Reverse Engineering Knowledge (SANReN CSC)
// ─────────────────────────────────────────────────────────────────────────────

export const REVERSE_ENGINEERING_KNOWLEDGE: ReverseEngineeringKnowledge[] = [
  {
    id: "re-basic-activities",
    category: "basic",
    name: "Basic RE Activities",
    description: "Initial steps to analyze a compiled application or binary.",
    techniques: [
      "Check the File Type: determine the file type by executing the `file [filename]` command in a terminal.",
      "Execute the Binary: interact with the binary in a controlled, sandbox environment. Check for inputs requested.",
      "Print Strings: print all the strings present in the binary using `strings -a [filename]` command."
    ],
    tools: ["file", "strings", "sandbox"]
  },
  {
    id: "re-fuzzing",
    category: "advanced",
    name: "Fuzzing",
    description: "Test the input response of the application. Test how the application responds when presented with unexpected inputs (submitting an Integer in a String field or visa versa). Determine what controls are in place to prevent unexpected user behaviour. Map out these controls to start identifying control flows within the application. Fuzzing could be a viable technique to identify insecure input validation and possible injection paths.",
    techniques: ["Input validation testing", "Unexpected input injection", "Control flow mapping"]
  },
  {
    id: "re-decompilation",
    category: "advanced",
    name: "Decompilation",
    description: "Decompiling an application attempts to convert the binary code into the higher order language it was written in. Higher order languages tend to be more human readable but depending on how the source code was obfuscated, the decompiled code might still be difficult to decipher. It is recommended you step through the code blocks to determine the logical flow of the program.",
    tools: ["Hex Rays", "APKTool", "Dex2Jar", "Java-Decompiler", "Hex Editor (hexed.it)"]
  },
  {
    id: "re-disassemble",
    category: "advanced",
    name: "Disassemble",
    description: "A disassembler tool breaks down a compiled program into machine code.",
    tools: ["Binary Ninja", "Ghidra", "Radare2", "IDA Pro"]
  },
  {
    id: "re-debugging",
    category: "advanced",
    name: "Debugging",
    description: "A debugging application allows you to perform dynamic analysis and set break points to step through the execution of a program. Another option would be to perform active analysis and step through the code with a debugger.",
    tools: ["OllyDbg", "GDB", "x64dbg"]
  },
  {
    id: "re-resources",
    category: "resources",
    name: "Additional Resources & Practice",
    description: "Platforms and challenges to practice Reverse Engineering skills.",
    links: [
      "Microcorruption (https://microcorruption.com/): RE exercises and challenges.",
      "Challenges.re (https://challenges.re/): RE exercises.",
      "Beginners.re (https://beginners.re/): beginner’s guide to RE.",
      "Reversing.Kr (http://reversing.kr/): crack and RE challenges.",
      "TryHackMe Reversing ELF (https://tryhackme.com/r/room/reverselfiles)"
    ]
  }
];
