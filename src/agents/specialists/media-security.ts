/**
 * media-security.ts — JDownloader-inspired knowledge base for media platform
 * security testing and defense. Provides scrapers/downloaders behavioral
 * models so the media agent can test protections and harden the platform.
 *
 * Domains covered:
 *   1. Link Crawler / Scraper patterns (how tools like JDownloader discover content)
 *   2. Download protection & anti-scraping defenses
 *   3. Content integrity verification (hash, watermark, DRM)
 *   4. Anti-bot & rate limiting strategies
 *   5. Token-based access control & signed URLs
 *   6. Plugin/extension detection & fingerprinting
 *   7. Platform-specific defense playbooks
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScraperTechnique =
  | "link-crawl"
  | "deep-decrypt"
  | "direct-http"
  | "follow-redirect"
  | "form-submit"
  | "api-abuse"
  | "cookie-replay"
  | "header-spoof"
  | "browser-emulation"
  | "stream-capture"
  | "m3u8-harvest"
  | "mpd-harvest"
  | "thumbnail-enum"
  | "sitemap-parse"
  | "rss-scrape";

export type DefenseCategory =
  | "url-signing"
  | "token-auth"
  | "rate-limiting"
  | "fingerprinting"
  | "captcha"
  | "drm"
  | "watermarking"
  | "hotlink-protection"
  | "geo-restriction"
  | "obfuscation"
  | "anti-debug"
  | "content-encryption"
  | "access-control";

export type ThreatSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface ScraperPattern {
  id: string;
  technique: ScraperTechnique;
  name: string;
  description: string;
  /** How JDownloader (or similar tools) implement this */
  attackVector: string;
  /** Regex patterns the scraper typically uses */
  indicatorPatterns: string[];
  /** Typical HTTP signatures left by these tools */
  httpSignatures: {
    userAgents?: string[];
    headers?: Record<string, string>;
    requestPatterns?: string[];
  };
  /** Detection methods for the platform */
  detectionMethods: string[];
  /** Recommended defenses */
  defenses: string[];
  severity: ThreatSeverity;
  /** Reference to JDownloader KB article or concept */
  reference: string;
}

export interface DefensePlaybook {
  id: string;
  category: DefenseCategory;
  name: string;
  description: string;
  /** Implementation guidance */
  implementation: {
    serverSide: string[];
    clientSide: string[];
    cdnConfig?: string[];
  };
  /** Test cases to verify the defense works */
  testCases: DefenseTestCase[];
  /** Which scraper techniques this defeats */
  mitigates: ScraperTechnique[];
  /** Bypass difficulty 1-10 (how hard it is for scrapers to bypass) */
  bypassDifficulty: number;
}

export interface DefenseTestCase {
  name: string;
  description: string;
  /** Steps to reproduce */
  steps: string[];
  /** Expected result when defense is active */
  expectedResult: string;
  /** Automated test feasibility */
  automatable: boolean;
}

export interface LinkCrawlerRule {
  enabled: boolean;
  name: string;
  pattern: string;
  rule: "DEEPDECRYPT" | "REWRITE" | "DIRECTHTTP" | "FOLLOWREDIRECT" | "SUBMITFORM";
  /** Optional: cookie injection */
  cookies?: [string, string][];
  /** Optional: custom headers */
  headers?: [string, string][];
  maxDecryptDepth?: number;
  deepPattern?: string | null;
  rewriteReplaceWith?: string | null;
  formPattern?: string | null;
}

export interface ContentIntegrityCheck {
  id: string;
  name: string;
  description: string;
  method: "hash-verify" | "watermark-detect" | "drm-check" | "metadata-strip" | "exif-sanitize" | "fingerprint-embed";
  implementation: string;
  tools: string[];
}

export interface PlatformDefenseProfile {
  platform: string;
  description: string;
  threatModel: string[];
  defenses: string[];
  monitoringSignals: string[];
  incidentResponse: string[];
}

// ---------------------------------------------------------------------------
// Scraper behavior patterns (how downloaders attack platforms)
// ---------------------------------------------------------------------------

export const SCRAPER_PATTERNS: ScraperPattern[] = [
  {
    id: "scrp-link-crawl",
    technique: "link-crawl",
    name: "LinkCrawler Deep Scan",
    description:
      "Automated crawlers parse HTML/DOM to discover media URLs embedded in pages. JDownloader's LinkCrawler uses regex-based rules to match URL patterns and recursively follow links to find downloadable content.",
    attackVector:
      "Crawler fetches page HTML, applies regex patterns (deepPattern) to extract media URLs. Supports chaining rules so results from rule 1 feed into rule 2. Can submit forms (SUBMITFORM), follow redirects (FOLLOWREDIRECT), and rewrite URLs (REWRITE) to discover protected content.",
    indicatorPatterns: [
      'src="(https?://[^"]+\\.(?:mp4|webm|m3u8|mpd))"',
      '<source[^>]+src="([^"]+)"',
      'file:\\s*"(https?://[^"]+)"',
      "var\\s+(?:source|video|stream)\\s*=\\s*['\"]([^'\"]+)['\"]",
      "data-(?:src|video|stream)=\"([^\"]+)\"",
    ],
    httpSignatures: {
      userAgents: [
        "JDownloader",
        "Wget/1.",
        "curl/",
        "python-requests",
        "Go-http-client",
        "Java/",
        "okhttp/",
      ],
      headers: {
        "Accept": "text/html,application/xhtml+xml",
      },
      requestPatterns: [
        "Rapid sequential requests to same domain",
        "Predictable URL enumeration (incrementing IDs)",
        "Missing Referer header on media requests",
        "No JS execution (static HTML only)",
      ],
    },
    detectionMethods: [
      "User-Agent analysis — block known scraper signatures",
      "Request rate anomaly detection (>10 pages/sec)",
      "Missing browser fingerprint (no JS execution proof)",
      "Referrer validation — media requests without valid page referrer",
      "Cookie jar analysis — requests without session cookies",
      "TLS fingerprint (JA3/JA4) — detect non-browser TLS stacks",
    ],
    defenses: [
      "Require JS execution proof (dynamic token injection)",
      "Time-limited signed URLs for all media assets",
      "Honeypot URLs that trigger ban on access",
      "Dynamic DOM obfuscation of media source attributes",
      "Server-side rendering with nonce-based asset references",
    ],
    severity: "high",
    reference: "JDownloader KB: LinkCrawler Rules (DEEPDECRYPT, DIRECTHTTP, REWRITE)",
  },
  {
    id: "scrp-direct-http",
    technique: "direct-http",
    name: "Direct HTTP Download",
    description:
      "Once a media URL is discovered, downloaders issue direct HTTP GET/Range requests to fetch the file, bypassing the platform's player/DRM entirely. JDownloader's DIRECTHTTP rule marks URLs as directly downloadable.",
    attackVector:
      "Direct download via HTTP Range requests. Supports resume, chunked download, and multi-connection acceleration. Custom headers and cookies can be injected per-domain.",
    indicatorPatterns: [
      "Range: bytes=\\d+-\\d*",
      "Multiple parallel connections to same file",
      "HEAD request followed by chunked GETs",
    ],
    httpSignatures: {
      headers: {
        "Range": "bytes=0-",
        "Connection": "keep-alive",
      },
      requestPatterns: [
        "HEAD probe followed by parallel chunked GETs",
        "5-30 simultaneous connections to same resource",
        "Sequential Range byte requests",
        "Missing Origin/Referer headers",
      ],
    },
    detectionMethods: [
      "Connection count per IP per resource (>3 unusual for video)",
      "Range request pattern analysis (uniform chunk sizes = downloader)",
      "Missing player heartbeat / DRM license requests",
      "HEAD-then-GET pattern without prior page visit",
      "Token/session not present in download request",
    ],
    defenses: [
      "One-time-use download tokens (expire after first byte served)",
      "Max connections per token enforcement (1-2)",
      "Require DRM license handshake before serving content",
      "Block HEAD requests on media endpoints",
      "Inject session binding into media URL path",
    ],
    severity: "critical",
    reference: "JDownloader KB: DIRECTHTTP LinkCrawler rule",
  },
  {
    id: "scrp-cookie-replay",
    technique: "cookie-replay",
    name: "Cookie / Session Replay",
    description:
      "Scrapers capture authentication cookies (via browser extensions like Cookie-Editor, EditThisCookie, FlagCookies) and replay them in download managers to access premium/authenticated content.",
    attackVector:
      "Export cookies from browser session → import into JDownloader LinkCrawler rule cookies field or account manager. The updateCookies flag auto-refreshes session tokens. Multi-format cookie import support.",
    indicatorPatterns: [
      "Cookie header with valid session but non-browser User-Agent",
      "Same session cookie used concurrently from multiple IPs",
      "Session cookie presented without preceding login flow",
    ],
    httpSignatures: {
      headers: {
        "Cookie": "<valid-session-token>",
      },
      requestPatterns: [
        "Valid auth cookie but missing CSRF token",
        "Cookie replay from different IP/geolocation",
        "No progressive page navigation before API calls",
        "Session used beyond normal TTL",
      ],
    },
    detectionMethods: [
      "Session-IP binding — invalidate on IP change",
      "Concurrent session detection (same cookie, 2+ IPs)",
      "Behavioral biometrics — sessions without mouse/keyboard events",
      "CSRF token validation on all state-changing requests",
      "Device fingerprint binding to session",
    ],
    defenses: [
      "Bind sessions to TLS fingerprint + IP subnet",
      "Short-lived session tokens (5-15min) with refresh via JS",
      "Require CSRF token from dynamically-rendered page",
      "Rate limit per-session (not just per-IP)",
      "Anomaly alerts on session reuse patterns",
    ],
    severity: "high",
    reference: "JDownloader KB: Cookie login instructions, updateCookies feature",
  },
  {
    id: "scrp-m3u8-harvest",
    technique: "m3u8-harvest",
    name: "HLS/DASH Manifest Harvesting",
    description:
      "Scrapers extract .m3u8 (HLS) or .mpd (DASH) manifests to download video segments directly, completely bypassing the web player and any client-side DRM.",
    attackVector:
      "Monitor network traffic (devtools/proxy) → capture manifest URL → download all .ts/.mp4 segments → concatenate with ffmpeg. Tools: yt-dlp, ffmpeg, N_m3u8DL-RE, streamlink.",
    indicatorPatterns: [
      "\\.m3u8(\\?.*)?$",
      "\\.mpd(\\?.*)?$",
      "#EXTINF:",
      "#EXT-X-KEY:",
      "Representation id=",
    ],
    httpSignatures: {
      userAgents: [
        "yt-dlp",
        "streamlink",
        "ffmpeg",
        "N_m3u8DL-RE",
        "hlsdl",
      ],
      requestPatterns: [
        "Rapid sequential .ts segment downloads",
        "Complete manifest fetch without prior page load",
        "All quality variants downloaded simultaneously",
        "No adaptive bitrate switching (single quality throughout)",
      ],
    },
    detectionMethods: [
      "Manifest access without preceding page view / player init",
      "Segment download rate exceeding real-time playback speed",
      "All segments downloaded without any pauses (no human viewing)",
      "Missing DRM license acquisition request before segment fetch",
      "User-Agent mismatch between page view and manifest request",
    ],
    defenses: [
      "AES-128 segment encryption with rotating keys",
      "DRM: Widevine L1/L3, FairPlay, PlayReady",
      "Token-authenticated manifest URLs (short TTL)",
      "Server-side manifest generation with per-session segment URLs",
      "Segment URL obfuscation (random paths, no predictable naming)",
      "Rate-limit segment requests to ~1.5x real-time playback",
    ],
    severity: "critical",
    reference: "HLS/DASH streaming security, yt-dlp countermeasures",
  },
  {
    id: "scrp-api-abuse",
    technique: "api-abuse",
    name: "API Endpoint Abuse",
    description:
      "Scrapers discover and abuse internal APIs (content listing, search, user profiles) to bulk-enumerate and download content programmatically.",
    attackVector:
      "Reverse-engineer API from browser devtools → enumerate content IDs → batch download. Common targets: /api/content/{id}, /api/search?q=*, /api/user/{id}/media, GraphQL introspection.",
    indicatorPatterns: [
      "/api/v\\d+/content/\\d+",
      "graphql.*introspection",
      "\\?page=\\d+&limit=\\d+",
      "/api/.*\\?offset=\\d+",
    ],
    httpSignatures: {
      requestPatterns: [
        "Sequential ID enumeration (id=1, id=2, id=3...)",
        "Pagination exhaustion (page=1 through page=N)",
        "GraphQL introspection queries",
        "Bulk API calls without corresponding UI activity",
        "API requests without prior authentication flow",
      ],
    },
    detectionMethods: [
      "Detect sequential/predictable ID access patterns",
      "Rate limit API endpoints per authenticated user",
      "Monitor for GraphQL introspection queries",
      "Track API-to-pageview ratio (high ratio = scraper)",
      "Require API key with per-key quotas",
    ],
    defenses: [
      "Use UUIDs instead of sequential IDs for content",
      "Disable GraphQL introspection in production",
      "Per-user API rate limits with exponential backoff",
      "Require signed API requests (HMAC)",
      "Pagination cursor tokens instead of offset/limit",
      "Query complexity limits for GraphQL",
    ],
    severity: "high",
    reference: "API security best practices, GraphQL hardening",
  },
  {
    id: "scrp-stream-capture",
    technique: "stream-capture",
    name: "Stream / Screen Capture",
    description:
      "When DRM prevents direct download, attackers use screen recording, HDMI capture, or virtual audio/video devices to capture playback output.",
    attackVector:
      "OBS Studio screen capture, HDMI splitter/capture card, virtual display driver, virtual audio cable. Some tools hook into the video rendering pipeline directly.",
    indicatorPatterns: [],
    httpSignatures: {},
    detectionMethods: [
      "Detect virtual display drivers (screen resolution anomalies)",
      "Monitor for screen capture API calls (getDisplayMedia, MediaRecorder)",
      "Detect known capture software processes (OBS, Bandicam)",
      "HDMI HDCP handshake verification for hardware DRM",
      "Watermark presence verification in re-uploaded content",
    ],
    defenses: [
      "Forensic watermarking (invisible, per-session/user)",
      "HDCP enforcement via hardware DRM",
      "Detect and block screen capture APIs in-browser",
      "Low-latency watermark that survives re-encoding",
      "Content fingerprinting for takedown automation",
    ],
    severity: "medium",
    reference: "DRM & watermarking countermeasures",
  },
  {
    id: "scrp-browser-emulation",
    technique: "browser-emulation",
    name: "Headless Browser Scraping",
    description:
      "Advanced scrapers use headless browsers (Puppeteer, Playwright, Selenium) to execute JavaScript, solve challenges, and scrape dynamically-rendered content.",
    attackVector:
      "Launch headless Chrome/Firefox → navigate to content page → wait for JS rendering → extract media URLs from rendered DOM → download. Can solve simple captchas, handle SPA routing, and maintain sessions.",
    indicatorPatterns: [
      "navigator\\.webdriver === true",
      "Missing plugins array",
      "Headless Chrome UA substring",
    ],
    httpSignatures: {
      userAgents: [
        "HeadlessChrome",
        "PhantomJS",
      ],
      requestPatterns: [
        "Perfect sequential navigation (no human variability)",
        "Consistent viewport size across sessions",
        "Missing WebGL/Canvas fingerprint variation",
        "navigator.webdriver = true",
      ],
    },
    detectionMethods: [
      "navigator.webdriver detection (set to true in automation)",
      "WebGL renderer string analysis (SwiftShader = headless)",
      "Canvas fingerprint entropy check (too uniform = bot)",
      "Mouse movement / click pattern analysis (perfect paths = bot)",
      "Plugin/mime type enumeration (headless has none)",
      "Chrome DevTools Protocol detection (CDP websocket)",
      "Timing analysis (sub-millisecond precision = automated)",
    ],
    defenses: [
      "Bot detection SDK (DataDome, PerimeterX, Kasada, Akamai Bot Manager)",
      "Proof-of-work challenges (nonce computation)",
      "Browser attestation tokens (Privacy Pass)",
      "Progressive challenge escalation based on risk score",
      "Behavioral biometrics (mouse dynamics, scroll patterns, keystroke timing)",
    ],
    severity: "high",
    reference: "Anti-bot detection, headless browser fingerprinting",
  },
  {
    id: "scrp-redirect-follow",
    technique: "follow-redirect",
    name: "Redirect Chain Following",
    description:
      "Scrapers follow HTTP redirect chains (301/302/307/meta-refresh/JS redirect) to reach final download URLs, bypassing intermediate pages that would normally show ads or verify humanity.",
    attackVector:
      "JDownloader's FOLLOWREDIRECT rule accepts URLs and follows all redirects to the final destination. Bypasses interstitial pages, countdown timers, and ad-gated downloads.",
    indicatorPatterns: [
      "HTTP 301/302/307 chain following",
      "meta http-equiv=\"refresh\"",
      "window\\.location\\s*=",
    ],
    httpSignatures: {
      requestPatterns: [
        "Instant redirect following (no delay for countdown timers)",
        "Skip intermediate page rendering",
        "No ad impression requests between redirects",
      ],
    },
    detectionMethods: [
      "Track time between redirect hops (instant = bot)",
      "Verify ad impressions were fired on intermediate pages",
      "Require interaction proof at intermediate steps",
      "Monitor for missing JS execution on gateway pages",
    ],
    defenses: [
      "JS-computed redirect tokens (can't follow without executing JS)",
      "CAPTCHA at redirect gates for suspicious sessions",
      "Time-delay enforcement server-side (minimum dwell time)",
      "Click-jacking proof: require user gesture before redirect",
    ],
    severity: "medium",
    reference: "JDownloader KB: FOLLOWREDIRECT LinkCrawler rule",
  },
  {
    id: "scrp-thumbnail-enum",
    technique: "thumbnail-enum",
    name: "Thumbnail / Preview Enumeration",
    description:
      "Scrapers enumerate thumbnail URLs by manipulating predictable path patterns (e.g., changing resolution, frame number, or ID) to discover and bulk-download preview images or reconstruct video content.",
    attackVector:
      "Analyze thumbnail URL structure → predict other content IDs → enumerate all thumbnails. Common patterns: /thumb/{id}/{frame}.jpg, /preview/{quality}/{id}.webp",
    indicatorPatterns: [
      "/thumb(?:nail)?/\\d+/",
      "/preview/\\w+/\\d+",
      "/img/\\d+_\\d+\\.jpg",
    ],
    httpSignatures: {
      requestPatterns: [
        "Sequential ID enumeration on thumbnail endpoints",
        "Rapid bulk requests to thumbnail CDN",
        "Scraping all thumbnails without viewing any content pages",
      ],
    },
    detectionMethods: [
      "Rate limit thumbnail endpoint per IP/session",
      "Detect sequential ID access on image endpoints",
      "Monitor thumbnail-to-pageview ratio",
    ],
    defenses: [
      "UUID-based thumbnail paths (non-enumerable)",
      "Signed thumbnail URLs with short TTL",
      "Thumbnail CDN rate limiting (per token, not just IP)",
      "Require valid page session before serving thumbnails",
    ],
    severity: "medium",
    reference: "Content enumeration prevention",
  },
  {
    id: "scrp-header-spoof",
    technique: "header-spoof",
    name: "Header / Referer Spoofing",
    description:
      "Scrapers forge HTTP headers (Referer, Origin, User-Agent, cookies) to bypass hotlink protection and origin checks. JDownloader supports custom headers per LinkCrawler rule.",
    attackVector:
      "Set custom headers in download manager: Referer from platform domain, Origin matching CORS expectations, User-Agent mimicking real browser. JDownloader's headers field in LinkCrawler rules enables per-pattern header injection.",
    indicatorPatterns: [],
    httpSignatures: {
      requestPatterns: [
        "Valid Referer but mismatched TLS fingerprint",
        "Browser User-Agent with non-browser TLS (JA3 mismatch)",
        "Referer present but no prior page navigation in server logs",
        "Static headers across many requests (no Accept-Language variation)",
      ],
    },
    detectionMethods: [
      "Cross-reference Referer with server-side page view logs",
      "TLS fingerprint (JA3/JA4) vs declared User-Agent analysis",
      "Header consistency checks (real browsers send Accept-Language, etc.)",
      "Detect statistically identical header sets across sessions",
    ],
    defenses: [
      "JA3/JA4 TLS fingerprinting for origin verification",
      "Require server-verified page view before serving media",
      "Dynamic CORS tokens (not just Origin check)",
      "Encrypted client hints for browser version verification",
    ],
    severity: "medium",
    reference: "JDownloader KB: Custom headers in LinkCrawler rules",
  },
];

// ---------------------------------------------------------------------------
// Defense playbooks
// ---------------------------------------------------------------------------

export const DEFENSE_PLAYBOOKS: DefensePlaybook[] = [
  {
    id: "def-signed-urls",
    category: "url-signing",
    name: "Signed URL / Token Authentication",
    description:
      "Generate time-limited, user-bound signed URLs for all media assets. Tokens encode user ID, IP hash, expiry, and content ID. Prevents URL sharing and direct download.",
    implementation: {
      serverSide: [
        "Generate HMAC-SHA256 signed URL on content page load",
        "Include: userId, contentId, ipHash, expiresAt, nonce",
        "Validate signature + expiry on CDN edge (Cloudflare Worker / Lambda@Edge)",
        "Reject if IP hash doesn't match or token expired",
        "Log and alert on invalid signature attempts",
      ],
      clientSide: [
        "Fetch signed URL via authenticated API call",
        "Pass token as URL parameter or Authorization header",
        "Token refresh via JS before expiry (invisible to user)",
      ],
      cdnConfig: [
        "Cloudflare: Signed URL verification in Worker",
        "AWS CloudFront: Signed URLs with CloudFront key pairs",
        "Fastly: Token-based auth with VCL",
        "Bunny CDN: Token authentication with URL signing",
      ],
    },
    testCases: [
      {
        name: "Expired token rejection",
        description: "Attempt to access media URL with expired token",
        steps: [
          "Obtain valid signed URL",
          "Wait beyond TTL (e.g., 5 minutes)",
          "Request media with expired token",
        ],
        expectedResult: "HTTP 403 Forbidden with error: token_expired",
        automatable: true,
      },
      {
        name: "Token replay from different IP",
        description: "Use valid token from a different IP address",
        steps: [
          "Capture signed URL from session on IP-A",
          "Replay the same URL from IP-B (different subnet)",
        ],
        expectedResult: "HTTP 403 Forbidden with error: ip_mismatch",
        automatable: true,
      },
      {
        name: "URL sharing prevention",
        description: "Share a signed URL with another user",
        steps: [
          "Generate signed URL for user-A",
          "Attempt access with user-B's session",
        ],
        expectedResult: "HTTP 403 Forbidden with error: user_mismatch",
        automatable: true,
      },
    ],
    mitigates: ["direct-http", "link-crawl", "cookie-replay", "header-spoof"],
    bypassDifficulty: 8,
  },
  {
    id: "def-rate-limit",
    category: "rate-limiting",
    name: "Intelligent Rate Limiting",
    description:
      "Multi-layered rate limiting: per-IP, per-session, per-user, per-endpoint. Adaptive thresholds based on content type and user behavior. Graduated response: throttle → captcha → block.",
    implementation: {
      serverSide: [
        "Redis sliding window rate limiter per dimension (IP, session, user)",
        "Content-aware limits: thumbnails=100/min, videos=10/min, API=60/min",
        "Graduated response: 80% → warning header, 100% → throttle, 150% → CAPTCHA, 200% → block",
        "Exponential backoff enforcement for blocked clients",
        "Allowlist for CDN IPs, search engine bots (verified via reverse DNS)",
      ],
      clientSide: [
        "Retry-After header handling in player",
        "Graceful degradation messaging to user",
      ],
      cdnConfig: [
        "Cloudflare Rate Limiting rules by path pattern",
        "AWS WAF rate-based rules",
        "CDN-level bot score integration (Cloudflare Bot Management)",
      ],
    },
    testCases: [
      {
        name: "Burst request throttling",
        description: "Send 100 requests/sec to media endpoint",
        steps: [
          "Launch 100 concurrent requests to /api/content/{id}",
          "Track response codes and timing",
        ],
        expectedResult: "First 10 succeed (200), remainder get 429 with Retry-After",
        automatable: true,
      },
      {
        name: "Distributed rate limit evasion",
        description: "Rotate IPs but use same session token",
        steps: [
          "Send requests from 10 different IPs with same auth token",
          "Exceed per-session limit",
        ],
        expectedResult: "Session-level rate limit triggers regardless of IP rotation",
        automatable: true,
      },
    ],
    mitigates: ["link-crawl", "api-abuse", "thumbnail-enum", "direct-http"],
    bypassDifficulty: 6,
  },
  {
    id: "def-fingerprint",
    category: "fingerprinting",
    name: "Browser & TLS Fingerprinting",
    description:
      "Multi-signal fingerprinting: TLS (JA3/JA4), HTTP/2 settings, browser APIs (Canvas, WebGL, AudioContext), behavioral biometrics. Detects headless browsers, curl, wget, JDownloader, and other non-browser clients.",
    implementation: {
      serverSide: [
        "JA3/JA4 TLS fingerprint extraction at edge (nginx/Cloudflare)",
        "HTTP/2 SETTINGS frame fingerprinting (AKAMAI_FINGERPRINT)",
        "Cross-reference declared User-Agent with TLS fingerprint DB",
        "Maintain known-good fingerprint allowlist (Chrome, Firefox, Safari, Edge)",
        "Flag mismatches: browser UA + non-browser TLS = scraper",
      ],
      clientSide: [
        "Canvas fingerprint challenge (draw + hash operation)",
        "WebGL renderer/vendor string collection",
        "AudioContext fingerprint (oscillator output hash)",
        "navigator.plugins and mimeTypes enumeration",
        "Screen resolution and color depth validation",
        "Performance.now() granularity check (headless differs)",
      ],
    },
    testCases: [
      {
        name: "Headless Chrome detection",
        description: "Access platform via Puppeteer in headless mode",
        steps: [
          "Launch Puppeteer with headless: true",
          "Navigate to content page",
          "Attempt to play video",
        ],
        expectedResult: "Challenge presented; navigator.webdriver detected; blocked or degraded",
        automatable: true,
      },
      {
        name: "JA3 mismatch detection",
        description: "Send request with browser UA but curl TLS stack",
        steps: [
          "Use curl with Chrome User-Agent header",
          "Request a media page",
        ],
        expectedResult: "JA3 fingerprint doesn't match Chrome → flagged as suspicious",
        automatable: true,
      },
      {
        name: "JDownloader Java TLS detection",
        description: "Detect JDownloader's Java-based TLS fingerprint",
        steps: [
          "Allow JDownloader to crawl site",
          "Capture TLS fingerprint at edge",
        ],
        expectedResult: "Java TLS stack detected → JA3 flagged → challenge or block",
        automatable: true,
      },
    ],
    mitigates: ["browser-emulation", "header-spoof", "link-crawl", "direct-http", "cookie-replay"],
    bypassDifficulty: 7,
  },
  {
    id: "def-drm",
    category: "drm",
    name: "DRM & Content Encryption",
    description:
      "Multi-DRM implementation with Widevine (Chrome/Android), FairPlay (Safari/iOS), and PlayReady (Edge/Windows). Encrypted media extensions (EME) prevent direct segment download. Defense-in-depth with multiple DRM levels.",
    implementation: {
      serverSide: [
        "Multi-DRM license server (BuyDRM, PallyCon, Axinom, EZDRM)",
        "Per-session license tokens with user binding",
        "Content encryption: CENC (Common Encryption) for interoperability",
        "Key rotation: new keys every N segments or every session",
        "License persistence control: disable offline playback for premium content",
        "HDCP enforcement for hardware output protection",
      ],
      clientSide: [
        "EME integration in video player (Shaka Player, Video.js, hls.js + DRM)",
        "License acquisition flow: player → license proxy → DRM server",
        "Robustness level enforcement: HW_SECURE_ALL for premium content",
        "Disable screen capture APIs when DRM content is playing",
      ],
    },
    testCases: [
      {
        name: "Direct segment download prevention",
        description: "Attempt to download encrypted .ts segments and play without license",
        steps: [
          "Capture .m3u8 manifest URL",
          "Download encrypted segments",
          "Attempt to play with ffmpeg or VLC",
        ],
        expectedResult: "Segments are AES-128 encrypted; playback fails without valid DRM license",
        automatable: true,
      },
      {
        name: "License portability check",
        description: "Capture DRM license and replay on different device",
        steps: [
          "Capture license response from DRM server",
          "Attempt to use license on different device/session",
        ],
        expectedResult: "License bound to device/session; playback fails with license_error",
        automatable: true,
      },
    ],
    mitigates: ["direct-http", "m3u8-harvest", "stream-capture", "link-crawl"],
    bypassDifficulty: 9,
  },
  {
    id: "def-watermark",
    category: "watermarking",
    name: "Forensic Watermarking",
    description:
      "Invisible per-user/per-session watermarks embedded in video and image content. Survives re-encoding, cropping, and screen capture. Enables content leak tracing and DMCA automation.",
    implementation: {
      serverSide: [
        "Server-side watermark injection during transcoding (Nagra, Irdeto, Civolution)",
        "Per-session watermark ID encoding user + timestamp + session",
        "Watermark DB: map watermark ID → user → session → IP",
        "Automated content fingerprinting service (YouTube Content ID, Audible Magic)",
        "DMCA takedown automation: detect leak → extract watermark → identify leaker → issue takedown",
      ],
      clientSide: [
        "Client-side visible watermark overlay (username/session in semi-transparent text)",
        "Canvas-based dynamic watermark (position varies per frame)",
        "Deterrent messaging: 'This content is watermarked for [username]'",
      ],
    },
    testCases: [
      {
        name: "Watermark survival after re-encoding",
        description: "Re-encode watermarked video and verify watermark persists",
        steps: [
          "Capture watermarked video segment",
          "Re-encode with ffmpeg (different codec, resolution, bitrate)",
          "Run watermark extraction on re-encoded file",
        ],
        expectedResult: "Watermark successfully extracted; user identified",
        automatable: true,
      },
      {
        name: "Watermark survival after crop/resize",
        description: "Crop and resize watermarked content, verify detection",
        steps: [
          "Crop video to 80% center region",
          "Downscale to 720p",
          "Run watermark extraction",
        ],
        expectedResult: "Watermark detected despite modifications",
        automatable: true,
      },
    ],
    mitigates: ["stream-capture", "m3u8-harvest", "direct-http"],
    bypassDifficulty: 9,
  },
  {
    id: "def-hotlink",
    category: "hotlink-protection",
    name: "Hotlink & Embed Protection",
    description:
      "Prevent unauthorized embedding and hotlinking of media assets. Validate Referer/Origin, enforce CSP frame-ancestors, and use token-bound CDN delivery.",
    implementation: {
      serverSide: [
        "Validate Referer header against allowed domains",
        "CSP frame-ancestors directive: restrict embedding to own domains",
        "X-Frame-Options: SAMEORIGIN for legacy browser support",
        "CDN-level Referer check (Cloudflare, CloudFront, Fastly)",
        "Signed cookies for CDN access (scoped to domain + path)",
      ],
      clientSide: [
        "Embed code with token-based authentication",
        "postMessage verification for iframe embeds",
        "Window.top check for frame-busting",
      ],
      cdnConfig: [
        "Cloudflare: Hotlink Protection toggle + WAF rules",
        "CloudFront: Referer-based origin access control",
        "Bunny CDN: Referer whitelist per pull zone",
      ],
    },
    testCases: [
      {
        name: "Cross-domain embed blocked",
        description: "Embed media player on unauthorized domain",
        steps: [
          "Create test page on external domain",
          "Embed platform's media player via iframe",
          "Attempt to load content",
        ],
        expectedResult: "CSP frame-ancestors blocks embed; content does not load",
        automatable: true,
      },
      {
        name: "Hotlinked image blocked",
        description: "Reference platform image from external page",
        steps: [
          "Create <img> tag on external site pointing to platform image URL",
          "Load external page",
        ],
        expectedResult: "Image returns 403 or placeholder image",
        automatable: true,
      },
    ],
    mitigates: ["direct-http", "link-crawl", "header-spoof"],
    bypassDifficulty: 5,
  },
  {
    id: "def-anti-debug",
    category: "anti-debug",
    name: "Anti-Debug & Obfuscation",
    description:
      "Deter reverse engineering of client-side media handling. Obfuscate JavaScript, detect DevTools, and make scraper development harder.",
    implementation: {
      serverSide: [
        "Serve obfuscated JS bundles (JavaScript Obfuscator, Terser with mangling)",
        "Rotate obfuscation seeds per deployment",
        "Server-side rendering of critical media URLs (no client-side URL construction)",
      ],
      clientSide: [
        "DevTools detection: debugger statement trap",
        "Console.log override to detect logging",
        "Window size delta check (DevTools changes inner dimensions)",
        "Firebug / React DevTools detection",
        "Code integrity checks (hash own script, detect modification)",
        "String encryption for API endpoints and keys",
      ],
    },
    testCases: [
      {
        name: "DevTools detection triggers",
        description: "Open browser DevTools and verify detection",
        steps: [
          "Open platform in browser",
          "Open DevTools (F12)",
          "Check if anti-debug mechanisms trigger",
        ],
        expectedResult: "Warning displayed or media playback paused; event logged server-side",
        automatable: false,
      },
    ],
    mitigates: ["browser-emulation", "link-crawl", "m3u8-harvest"],
    bypassDifficulty: 4,
  },
];

// ---------------------------------------------------------------------------
// Content integrity checks
// ---------------------------------------------------------------------------

export const CONTENT_INTEGRITY_CHECKS: ContentIntegrityCheck[] = [
  {
    id: "ci-hash-verify",
    name: "File Hash Verification",
    description:
      "Compute and verify SHA-256/MD5 hashes of uploaded content to detect tampering, ensure delivery integrity, and prevent duplicate uploads.",
    method: "hash-verify",
    implementation:
      "On upload: compute SHA-256, store in DB. On delivery: include hash in manifest/headers. Client verifies after download. SFV/CRC check for archive integrity (JDownloader-style).",
    tools: ["sha256sum", "md5sum", "SubResource Integrity (SRI) for web assets"],
  },
  {
    id: "ci-watermark-detect",
    name: "Watermark Detection & Extraction",
    description:
      "Scan uploaded/re-uploaded content for embedded forensic watermarks to trace content leaks back to source sessions.",
    method: "watermark-detect",
    implementation:
      "Perceptual hashing (pHash, dHash) for image similarity. Video fingerprinting for motion-based matching. Invisible watermark extraction via frequency domain analysis (DCT/DWT).",
    tools: ["Nagra NexGuard", "Irdeto", "Civolution", "perceptual-hash libs"],
  },
  {
    id: "ci-drm-check",
    name: "DRM License Validation",
    description:
      "Verify DRM license chain integrity, check for license server spoofing, and validate encryption key delivery.",
    method: "drm-check",
    implementation:
      "Validate license server certificate chain. Check DRM token signature. Verify content key matches encrypted segments. Monitor for CDM (Content Decryption Module) version/integrity.",
    tools: ["Widevine proxy checker", "DRM license validator", "EME Logger extension"],
  },
  {
    id: "ci-metadata-strip",
    name: "Metadata & EXIF Sanitization",
    description:
      "Strip potentially identifying or dangerous metadata from uploaded media before storage and delivery. Prevents location leaks, tracking, and XSS via metadata injection.",
    method: "metadata-strip",
    implementation:
      "Strip EXIF GPS data, camera serial numbers, embedded thumbnails. Sanitize XMP/IPTC. Remove or rewrite video container metadata (moov atom, matroska tags). Validate no executable content in metadata fields.",
    tools: ["ExifTool", "ffmpeg -map_metadata -1", "sharp (Node.js)", "mat2"],
  },
  {
    id: "ci-fingerprint-embed",
    name: "Content Fingerprint Embedding",
    description:
      "Embed robust content fingerprints for automated content matching across platforms. Enables re-upload detection and take-down automation.",
    method: "fingerprint-embed",
    implementation:
      "Generate perceptual fingerprint on upload (pHash for images, chromaprint for audio, video fingerprint for video). Store in fingerprint DB. Compare all new uploads against existing fingerprints. Flag matches above threshold.",
    tools: ["pHash", "chromaprint/AcoustID", "YouTube Content ID", "Audible Magic"],
  },
];

// ---------------------------------------------------------------------------
// Platform defense profiles
// ---------------------------------------------------------------------------

export const PLATFORM_DEFENSE_PROFILES: PlatformDefenseProfile[] = [
  {
    platform: "adult-content-platform",
    description: "Defense profile for adult content creator platforms (OnlyFans, Fansly, FreakMe-style)",
    threatModel: [
      "Content scraping and redistribution to tube sites",
      "Account sharing and credential stuffing",
      "Automated content downloading via tools like JDownloader, yt-dlp",
      "Screen recording and HDMI capture of premium content",
      "Unauthorized embedding/hotlinking on third-party sites",
      "Thumbnail enumeration for preview harvesting",
      "API abuse for bulk content listing",
      "Cookie/session replay for premium content access",
    ],
    defenses: [
      "Forensic watermarking with per-session user ID encoding",
      "DRM (Widevine L1 minimum) for video content",
      "Signed URLs with 5-minute TTL and IP binding",
      "Session-bound authentication with device fingerprint",
      "Rate limiting: 10 video requests/min, 50 thumbnail requests/min",
      "JA3/JA4 TLS fingerprinting to detect non-browser clients",
      "DMCA takedown automation with watermark-based leak tracing",
      "Anti-debug and JS obfuscation for client-side player",
      "CSP frame-ancestors: self only (no external embeds)",
      "UUID-based content paths (no sequential enumeration)",
    ],
    monitoringSignals: [
      "Spike in media requests per session (>20 videos/hour)",
      "JA3 fingerprint mismatch (browser UA, non-browser TLS)",
      "Geographic anomalies (session IP vs account registration country)",
      "Multiple sessions per account (concurrent access from different IPs)",
      "Abnormal download patterns (all content vs selective viewing)",
      "Missing player heartbeat/DRM license requests during media access",
      "Thumbnail endpoint hit rate exceeding normal browsing patterns",
    ],
    incidentResponse: [
      "Auto-suspend account on confirmed scraping detection",
      "Extract watermark from leaked content → identify source user",
      "Issue automated DMCA takedown to hosting providers",
      "Rotate signing keys if URL signing compromise suspected",
      "Escalate repeat offenders to legal team",
      "Publish transparency report on content protection effectiveness",
    ],
  },
  {
    platform: "streaming-platform",
    description: "Defense profile for video streaming platforms (Netflix, Twitch-style)",
    threatModel: [
      "Stream ripping via yt-dlp/streamlink",
      "DRM bypass via CDM patching or L3 key extraction",
      "Re-streaming to unauthorized platforms",
      "Credential sharing across geographic regions",
      "Automated content cataloging and metadata scraping",
    ],
    defenses: [
      "Multi-DRM: Widevine L1 + FairPlay + PlayReady",
      "Key rotation every 60 seconds during live streams",
      "Concurrent stream limit per account (max 2)",
      "Geographic session binding with IP intelligence",
      "Segment-level encryption with per-session keys",
      "Bot score threshold for playback initialization",
    ],
    monitoringSignals: [
      "CDM version anomalies (outdated or patched CDM)",
      "License request patterns (bulk acquisition = ripper)",
      "Stream consumption rate vs real-time (faster = capture)",
      "API call patterns for content catalog enumeration",
    ],
    incidentResponse: [
      "Revoke DRM license on anomaly detection",
      "Force re-authentication on suspicious sessions",
      "Rate-limit license acquisition per device",
      "CDM revocation for compromised devices",
    ],
  },
];

// ---------------------------------------------------------------------------
// LinkCrawler rule examples (for testing defense against JDownloader)
// ---------------------------------------------------------------------------

export const EXAMPLE_CRAWLER_RULES: LinkCrawlerRule[] = [
  {
    enabled: true,
    name: "Test: Deep scan for video URLs",
    pattern: "https://(?:www\\.)?example\\.com/content/(.+)",
    rule: "DEEPDECRYPT",
    maxDecryptDepth: 2,
    deepPattern: 'src="(https?://[^"]+\\.(?:mp4|m3u8|mpd)(?:\\?[^"]*)?)"',
  },
  {
    enabled: true,
    name: "Test: Follow download redirects",
    pattern: "https://(?:www\\.)?example\\.com/download/(.+)",
    rule: "FOLLOWREDIRECT",
    maxDecryptDepth: 3,
  },
  {
    enabled: true,
    name: "Test: Direct HTTP for CDN assets",
    pattern: "https://cdn\\.example\\.com/media/[a-f0-9]+\\.(?:mp4|webm)",
    rule: "DIRECTHTTP",
    headers: [
      ["Referer", "https://www.example.com/"],
      ["User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"],
    ],
  },
  {
    enabled: true,
    name: "Test: Rewrite thumbnail to full resolution",
    pattern: "https://thumb\\.example\\.com/(\\d+)_thumb\\.jpg",
    rule: "REWRITE",
    rewriteReplaceWith: "https://media.example.com/$1_full.jpg",
  },
  {
    enabled: true,
    name: "Test: Cookie-authenticated premium content",
    pattern: "https://(?:www\\.)?example\\.com/premium/(.+)",
    rule: "DEEPDECRYPT",
    cookies: [
      ["session_id", "<captured-session-cookie>"],
      ["premium", "true"],
    ],
    headers: [
      ["X-Requested-With", "XMLHttpRequest"],
    ],
    maxDecryptDepth: 1,
    deepPattern: '"file":"(https?://[^"]+)"',
  },
];

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

export function getScraperPattern(id: string): ScraperPattern | undefined {
  return SCRAPER_PATTERNS.find((p) => p.id === id);
}

export function getScrapersByTechnique(technique: ScraperTechnique): ScraperPattern[] {
  return SCRAPER_PATTERNS.filter((p) => p.technique === technique);
}

export function getScrapersBySeverity(severity: ThreatSeverity): ScraperPattern[] {
  return SCRAPER_PATTERNS.filter((p) => p.severity === severity);
}

export function getDefensePlaybook(id: string): DefensePlaybook | undefined {
  return DEFENSE_PLAYBOOKS.find((p) => p.id === id);
}

export function getDefensesByCategory(category: DefenseCategory): DefensePlaybook[] {
  return DEFENSE_PLAYBOOKS.filter((p) => p.category === category);
}

export function getDefensesForTechnique(technique: ScraperTechnique): DefensePlaybook[] {
  return DEFENSE_PLAYBOOKS.filter((p) => p.mitigates.includes(technique));
}

export function getPlatformProfile(platform: string): PlatformDefenseProfile | undefined {
  return PLATFORM_DEFENSE_PROFILES.find((p) => p.platform === platform);
}

export function getContentIntegrityCheck(id: string): ContentIntegrityCheck | undefined {
  return CONTENT_INTEGRITY_CHECKS.find((c) => c.id === id);
}

export function getAllTestCases(): { defense: string; tests: DefenseTestCase[] }[] {
  return DEFENSE_PLAYBOOKS.map((p) => ({
    defense: p.name,
    tests: p.testCases,
  }));
}

export function getAutomatableTests(): { defense: string; test: DefenseTestCase }[] {
  const results: { defense: string; test: DefenseTestCase }[] = [];
  for (const playbook of DEFENSE_PLAYBOOKS) {
    for (const tc of playbook.testCases) {
      if (tc.automatable) {
        results.push({ defense: playbook.name, test: tc });
      }
    }
  }
  return results;
}

/**
 * Score a platform's defense posture against a specific scraper technique.
 * Returns 0-100 score based on number of applicable defenses and their bypass difficulty.
 */
export function scoreDefensePosture(technique: ScraperTechnique): {
  score: number;
  maxScore: number;
  defenses: string[];
  gaps: string[];
} {
  const applicable = getDefensesForTechnique(technique);
  const score = applicable.reduce((sum, d) => sum + d.bypassDifficulty * 10, 0);
  const maxScore = 100;

  const allDefenseCategories: DefenseCategory[] = [
    "url-signing", "token-auth", "rate-limiting", "fingerprinting",
    "captcha", "drm", "watermarking", "hotlink-protection",
    "geo-restriction", "obfuscation", "anti-debug", "content-encryption", "access-control",
  ];

  const coveredCategories = new Set(applicable.map((d) => d.category));
  const gaps = allDefenseCategories.filter((c) => !coveredCategories.has(c));

  return {
    score: Math.min(score, maxScore),
    maxScore,
    defenses: applicable.map((d) => d.name),
    gaps,
  };
}
