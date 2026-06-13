/**
 * VPN Security Knowledge Base
 *
 * Comprehensive VPN protocol analysis, leak detection, configuration auditing,
 * operational compatibility, provider integration, and VPN-aware defense patterns.
 *
 * Coverage:
 * - Protocol Security: OpenVPN, WireGuard, IKEv2/IPSec, L2TP, PPTP analysis
 * - Leak Detection: DNS, WebRTC, IPv6, traffic correlation attacks
 * - Config Auditing: cipher suites, key exchange, authentication, logging
 * - Operational Compatibility: proxy-aware HTTP, DNS handling, timeout tuning
 * - Provider Integration: Mullvad, NordVPN, ExpressVPN, Tailscale, ProtonVPN APIs
 * - VPN-Aware Defense: IP reputation, geo-mismatch, residential vs datacenter detection
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type VpnProtocol = "openvpn" | "wireguard" | "ikev2" | "ipsec" | "l2tp" | "pptp" | "sstp" | "shadowsocks" | "v2ray";

export type VpnLeakType =
  | "dns-leak"
  | "webrtc-leak"
  | "ipv6-leak"
  | "traffic-correlation"
  | "timing-attack"
  | "kill-switch-bypass"
  | "split-tunnel-leak"
  | "captive-portal-bypass"
  | "torrent-leak"
  | "browser-fingerprint";

export type VpnDefenseCategory =
  | "protocol-hardening"
  | "leak-prevention"
  | "traffic-obfuscation"
  | "key-management"
  | "authentication"
  | "network-isolation"
  | "monitoring"
  | "failsafe";

export type VpnProvider =
  | "mullvad"
  | "nordvpn"
  | "expressvpn"
  | "protonvpn"
  | "tailscale"
  | "surfshark"
  | "privateinternetaccess"
  | "ipvanish"
  | "cyberghost"
  | "custom";

export type IpType =
  | "datacenter"
  | "residential"
  | "mobile"
  | "tor-exit"
  | "vpn-exit"
  | "proxy"
  | "cdn"
  | "hosting"
  | "isp";

export type VpnSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface VpnLeakPattern {
  readonly id: string;
  readonly type: VpnLeakType;
  readonly name: string;
  readonly severity: VpnSeverity;
  readonly cvss: number;
  readonly description: string;
  readonly detectionMethods: readonly string[];
  readonly indicators: readonly string[];
  readonly automatable: boolean;
  readonly testSteps: readonly string[];
  readonly tools: readonly string[];
  readonly remediation: readonly string[];
  readonly cwe: string;
  readonly references: readonly string[];
}

export interface VpnProtocolAnalysis {
  readonly protocol: VpnProtocol;
  readonly name: string;
  readonly securityRating: 1 | 2 | 3 | 4 | 5;
  readonly strengths: readonly string[];
  readonly weaknesses: readonly string[];
  readonly recommendedCiphers: readonly string[];
  readonly deprecatedCiphers: readonly string[];
  readonly portOptions: readonly number[];
  readonly obfuscationSupport: boolean;
  readonly auditStatus: "audited" | "partial" | "none";
  readonly knownVulnerabilities: readonly string[];
  readonly bestPractices: readonly string[];
}

export interface VpnDefensePlaybook {
  readonly id: string;
  readonly name: string;
  readonly category: VpnDefenseCategory;
  readonly description: string;
  readonly effectiveness: number; // 1-10
  readonly implementation: {
    readonly principle: string;
    readonly codeExamples: readonly {
      readonly language: string;
      readonly code: string;
      readonly notes: string;
    }[];
    readonly configuration: readonly string[];
    readonly commonMistakes: readonly string[];
  };
  readonly testCases: readonly {
    readonly name: string;
    readonly description: string;
    readonly steps: readonly string[];
    readonly expected: string;
    readonly automatable: boolean;
  }[];
  readonly mitigatesLeaks: readonly VpnLeakType[];
  readonly references: readonly string[];
}

export interface VpnProviderProfile {
  readonly provider: VpnProvider;
  readonly name: string;
  readonly apiAvailable: boolean;
  readonly apiEndpoint?: string;
  readonly protocols: readonly VpnProtocol[];
  readonly features: readonly string[];
  readonly jurisdictions: readonly string[];
  readonly loggingPolicy: "no-logs" | "minimal" | "connection" | "full";
  readonly killSwitchSupport: boolean;
  readonly multihopSupport: boolean;
  readonly portForwardingSupport: boolean;
  readonly integrationNotes: readonly string[];
  readonly automationCapabilities: readonly string[];
}

export interface IpReputationSignal {
  readonly ipType: IpType;
  readonly confidence: number; // 0-100
  readonly indicators: readonly string[];
  readonly riskScore: number; // 0-100
  readonly geoMismatch: boolean;
  readonly datacenterAsn: boolean;
  readonly knownVpnExit: boolean;
  readonly torExit: boolean;
  readonly proxyDetected: boolean;
  readonly residentialProxy: boolean;
}

export interface VpnConfigWeakness {
  readonly configKey: string;
  readonly severity: VpnSeverity;
  readonly issue: string;
  readonly recommendation: string;
  readonly cwe: string;
}

export interface OperationalConfig {
  readonly proxySettings: {
    readonly httpProxy?: string;
    readonly httpsProxy?: string;
    readonly socksProxy?: string;
    readonly noProxy: readonly string[];
  };
  readonly dnsSettings: {
    readonly useDoh: boolean;
    readonly dohProvider?: string;
    readonly fallbackDns: readonly string[];
    readonly dnsCacheEnabled: boolean;
  };
  readonly timeoutSettings: {
    readonly connectTimeout: number;
    readonly readTimeout: number;
    readonly writeTimeout: number;
    readonly idleTimeout: number;
    readonly retryAttempts: number;
    readonly retryDelay: number;
  };
  readonly networkSettings: {
    readonly forceIpv4: boolean;
    readonly bindInterface?: string;
    readonly mtu?: number;
    readonly keepAliveInterval: number;
  };
}

// ─── VPN Protocol Analysis ───────────────────────────────────────────────────

export const VPN_PROTOCOL_ANALYSIS: Record<VpnProtocol, VpnProtocolAnalysis> = {
  wireguard: {
    protocol: "wireguard",
    name: "WireGuard",
    securityRating: 5,
    strengths: [
      "Modern cryptography (ChaCha20, Curve25519, BLAKE2s, SipHash24)",
      "Minimal attack surface (~4000 lines of code)",
      "Formally verified cryptographic primitives",
      "Fast connection establishment (<100ms)",
      "Excellent performance (kernel-level implementation)",
      "Simple configuration, fewer misconfig opportunities",
      "Built-in roaming support",
    ],
    weaknesses: [
      "No dynamic IP obfuscation (static public keys)",
      "Limited protocol agility (can't swap algorithms)",
      "Requires UDP (can be blocked by firewalls)",
      "Server stores client public keys (linkability)",
      "No built-in user authentication (key-based only)",
    ],
    recommendedCiphers: ["ChaCha20-Poly1305"],
    deprecatedCiphers: [],
    portOptions: [51820],
    obfuscationSupport: false,
    auditStatus: "audited",
    knownVulnerabilities: [],
    bestPractices: [
      "Rotate keys periodically (every 90 days)",
      "Use unique keys per device",
      "Implement kill switch at firewall level",
      "Consider wg-obfs or udp2raw for censorship bypass",
      "Monitor handshake timestamps for stale connections",
    ],
  },
  openvpn: {
    protocol: "openvpn",
    name: "OpenVPN",
    securityRating: 4,
    strengths: [
      "Battle-tested, 20+ years of security audits",
      "Highly configurable cipher suites",
      "Can run over TCP 443 (firewall bypass)",
      "Supports certificate-based and username/password auth",
      "Plugin architecture for custom authentication",
      "Wide platform support",
    ],
    weaknesses: [
      "Complex configuration prone to misconfigs",
      "Large codebase (~100k lines)",
      "Performance overhead (userspace)",
      "TLS fingerprinting detectable",
      "Slower connection establishment",
    ],
    recommendedCiphers: [
      "AES-256-GCM",
      "CHACHA20-POLY1305",
    ],
    deprecatedCiphers: [
      "BF-CBC",
      "DES-CBC",
      "RC2-CBC",
      "AES-128-CBC",
      "AES-256-CBC", // prefer GCM
    ],
    portOptions: [1194, 443, 80],
    obfuscationSupport: true,
    auditStatus: "audited",
    knownVulnerabilities: [
      "CVE-2020-15078: Authentication bypass in deferred auth",
      "CVE-2017-12166: Out-of-bounds write in Windows branch",
      "CVE-2014-8104: DoS via packet-id rollover",
    ],
    bestPractices: [
      "Use tls-crypt for control channel encryption",
      "Enable tls-version-min 1.2",
      "Use ECDHE key exchange (ecdh-curve secp384r1)",
      "Set cipher AES-256-GCM and ncp-ciphers AES-256-GCM:CHACHA20-POLY1305",
      "Enable auth SHA256 or SHA384",
      "Use certificate pinning (verify-x509-name)",
      "Set remote-cert-tls server",
      "Consider obfsproxy/stunnel for censorship bypass",
    ],
  },
  ikev2: {
    protocol: "ikev2",
    name: "IKEv2/IPSec",
    securityRating: 4,
    strengths: [
      "Native OS support (Windows, macOS, iOS, Android)",
      "MOBIKE support for seamless network switching",
      "Fast reconnection after network changes",
      "Strong authentication options (certificates, EAP)",
      "Well-audited, standardized protocol",
    ],
    weaknesses: [
      "Complex protocol with many configuration options",
      "UDP-based (can be blocked)",
      "Implementation varies by vendor",
      "Certificate management complexity",
    ],
    recommendedCiphers: [
      "AES-256-GCM",
      "CHACHA20-POLY1305",
    ],
    deprecatedCiphers: [
      "3DES",
      "DES",
      "AES-128-CBC",
    ],
    portOptions: [500, 4500],
    obfuscationSupport: false,
    auditStatus: "audited",
    knownVulnerabilities: [
      "CVE-2018-5389: IKEv1 aggressive mode vulnerable to offline dictionary attacks",
    ],
    bestPractices: [
      "Use IKEv2 (not IKEv1)",
      "Enable PFS with DH group 19 or higher (ECDH)",
      "Use certificate-based authentication over PSK",
      "Configure proper IKE/ESP lifetime values",
      "Implement Dead Peer Detection (DPD)",
    ],
  },
  ipsec: {
    protocol: "ipsec",
    name: "IPSec",
    securityRating: 4,
    strengths: [
      "Network-layer encryption (all traffic protected)",
      "Mature, standardized protocol suite",
      "Hardware acceleration support",
      "Transparent to applications",
    ],
    weaknesses: [
      "Complex configuration",
      "NAT traversal complications",
      "Requires kernel support",
    ],
    recommendedCiphers: [
      "AES-256-GCM",
      "AES-128-GCM",
    ],
    deprecatedCiphers: [
      "DES",
      "3DES",
      "NULL",
    ],
    portOptions: [500, 4500],
    obfuscationSupport: false,
    auditStatus: "audited",
    knownVulnerabilities: [],
    bestPractices: [
      "Use ESP with AES-GCM authenticated encryption",
      "Avoid AH alone (no confidentiality)",
      "Enable NAT-T for router compatibility",
      "Use strong IKE policies",
    ],
  },
  l2tp: {
    protocol: "l2tp",
    name: "L2TP/IPSec",
    securityRating: 3,
    strengths: [
      "Wide platform support",
      "Double encapsulation with IPSec",
      "Standardized, well-understood",
    ],
    weaknesses: [
      "Performance overhead from double encapsulation",
      "Fixed ports make it easy to block",
      "No encryption without IPSec",
      "Suspected NSA compromise (leaked documents)",
    ],
    recommendedCiphers: ["AES-256-GCM"],
    deprecatedCiphers: ["3DES", "DES"],
    portOptions: [1701, 500, 4500],
    obfuscationSupport: false,
    auditStatus: "partial",
    knownVulnerabilities: [
      "Potential weakening per NSA leaked documents (unconfirmed)",
    ],
    bestPractices: [
      "Always pair with IPSec (L2TP alone has no encryption)",
      "Prefer IKEv2 or WireGuard over L2TP",
      "Use certificate auth over PSK",
    ],
  },
  pptp: {
    protocol: "pptp",
    name: "PPTP",
    securityRating: 1,
    strengths: [
      "Fast (minimal overhead)",
      "Native Windows support",
      "Easy setup",
    ],
    weaknesses: [
      "MS-CHAPv2 authentication is broken",
      "MPPE encryption is weak (RC4-based)",
      "Vulnerable to bit-flipping attacks",
      "NSA can decrypt in real-time (leaked documents)",
      "No PFS support",
    ],
    recommendedCiphers: [],
    deprecatedCiphers: ["MPPE-40", "MPPE-128"],
    portOptions: [1723],
    obfuscationSupport: false,
    auditStatus: "audited",
    knownVulnerabilities: [
      "MS-CHAPv2 crackable in 24 hours (Moxie Marlinspike, 2012)",
      "MPPE vulnerable to bit-flipping (no integrity protection)",
      "CVE-2012-2040: NSA PPTP decryption capability",
    ],
    bestPractices: [
      "DO NOT USE - Protocol is fundamentally broken",
      "Migrate to WireGuard, OpenVPN, or IKEv2",
    ],
  },
  sstp: {
    protocol: "sstp",
    name: "SSTP",
    securityRating: 3,
    strengths: [
      "Uses SSL/TLS over TCP 443 (firewall-friendly)",
      "Native Windows integration",
      "Strong encryption when configured properly",
    ],
    weaknesses: [
      "Proprietary Microsoft protocol",
      "Not open source, limited auditing",
      "Windows-centric",
      "TCP overhead in VPN-over-TCP",
    ],
    recommendedCiphers: ["AES-256-GCM"],
    deprecatedCiphers: ["RC4", "3DES"],
    portOptions: [443],
    obfuscationSupport: true,
    auditStatus: "none",
    knownVulnerabilities: [],
    bestPractices: [
      "Ensure TLS 1.2+ is enforced",
      "Use strong cipher suites",
      "Consider OpenVPN TCP 443 as open-source alternative",
    ],
  },
  shadowsocks: {
    protocol: "shadowsocks",
    name: "Shadowsocks",
    securityRating: 3,
    strengths: [
      "Designed for censorship circumvention",
      "Lightweight, fast performance",
      "Difficult to detect (looks like HTTPS)",
      "Plugin system for additional obfuscation",
    ],
    weaknesses: [
      "Not a full VPN (SOCKS5 proxy)",
      "No authentication beyond pre-shared key",
      "Replay attacks possible without proper setup",
      "Detection improving in censored regions",
    ],
    recommendedCiphers: [
      "chacha20-ietf-poly1305",
      "aes-256-gcm",
    ],
    deprecatedCiphers: [
      "aes-256-cfb",
      "rc4-md5",
      "bf-cfb",
    ],
    portOptions: [443, 8388],
    obfuscationSupport: true,
    auditStatus: "partial",
    knownVulnerabilities: [
      "Replay attacks on stream ciphers (fixed with AEAD)",
      "Active probing detection by GFW",
    ],
    bestPractices: [
      "Use AEAD ciphers only (chacha20-ietf-poly1305 or aes-256-gcm)",
      "Enable obfs plugin (obfs-http, obfs-tls)",
      "Use SIP003 plugins for additional obfuscation",
      "Rotate passwords periodically",
    ],
  },
  v2ray: {
    protocol: "v2ray",
    name: "V2Ray/VMess",
    securityRating: 4,
    strengths: [
      "Advanced traffic obfuscation (WebSocket, mKCP, QUIC)",
      "Designed for censorship circumvention",
      "Multiple inbound/outbound proxies",
      "CDN-friendly (can route through Cloudflare)",
      "Built-in routing rules",
    ],
    weaknesses: [
      "Complex configuration",
      "Not a traditional VPN (proxy-based)",
      "VMess protocol has had vulnerabilities",
      "Large codebase",
    ],
    recommendedCiphers: [
      "chacha20-poly1305",
      "aes-128-gcm",
    ],
    deprecatedCiphers: [],
    portOptions: [443, 80],
    obfuscationSupport: true,
    auditStatus: "partial",
    knownVulnerabilities: [
      "VMess AEAD timing attack (fixed in v4.24.2)",
    ],
    bestPractices: [
      "Use VLESS over VMess (simpler, fewer attack surfaces)",
      "Enable TLS with valid certificates",
      "Use WebSocket transport for CDN routing",
      "Configure proper mux settings",
    ],
  },
};

// ─── Leak Detection Patterns ─────────────────────────────────────────────────

export const VPN_LEAK_PATTERNS: readonly VpnLeakPattern[] = [
  {
    id: "leak-dns-01",
    type: "dns-leak",
    name: "DNS Query Leak Outside VPN Tunnel",
    severity: "high",
    cvss: 7.5,
    description: "DNS queries bypass the VPN tunnel and are sent to the ISP's DNS servers, revealing browsing activity and real location despite VPN connection.",
    detectionMethods: [
      "Compare DNS resolver IP to VPN exit IP",
      "Monitor DNS queries on local interface during VPN session",
      "Use external DNS leak test services",
      "Packet capture on network interface",
    ],
    indicators: [
      "DNS response from non-VPN IP",
      "Multiple DNS servers responding",
      "ISP DNS server in resolver list",
      "DNS queries visible on WAN interface",
    ],
    automatable: true,
    testSteps: [
      "1. Connect to VPN",
      "2. Run: nslookup whoami.akamai.net",
      "3. Compare response IP to expected VPN exit",
      "4. Alternatively: dig +short resolver.opendns.com myip.opendns.com @208.67.222.222",
      "5. If IP differs from VPN exit, DNS is leaking",
    ],
    tools: [
      "dnsleaktest.com",
      "ipleak.net",
      "dnsleak.com",
      "Wireshark (port 53 filter)",
      "tcpdump -i any port 53",
    ],
    remediation: [
      "Configure VPN client to push DNS servers",
      "Block non-tunnel DNS at firewall level",
      "Use DNS-over-HTTPS (DoH) through VPN",
      "Set system DNS to VPN provider's servers",
      "Enable VPN's DNS leak protection feature",
    ],
    cwe: "CWE-200",
    references: [
      "https://www.dnsleaktest.com/what-is-a-dns-leak.html",
      "https://mullvad.net/help/dns-leaks/",
    ],
  },
  {
    id: "leak-webrtc-01",
    type: "webrtc-leak",
    name: "WebRTC IP Disclosure",
    severity: "high",
    cvss: 7.5,
    description: "WebRTC STUN requests leak the real public IP address through browser APIs, bypassing VPN tunnel entirely. Works even with VPN connected.",
    detectionMethods: [
      "JavaScript RTCPeerConnection enumeration",
      "Browser console WebRTC API check",
      "External WebRTC leak test pages",
    ],
    indicators: [
      "RTCPeerConnection returns local/public IP",
      "STUN response contains non-VPN IP",
      "Multiple IP candidates in SDP",
    ],
    automatable: true,
    testSteps: [
      "1. Connect to VPN",
      "2. Open browser developer console",
      "3. Create RTCPeerConnection with STUN server",
      "4. Enumerate ICE candidates",
      "5. Check if any candidate IP differs from VPN exit",
      "6. Or visit browserleaks.com/webrtc",
    ],
    tools: [
      "browserleaks.com/webrtc",
      "ipleak.net",
      "Browser console (RTCPeerConnection)",
      "Puppeteer/Playwright for automation",
    ],
    remediation: [
      "Disable WebRTC in browser (about:config media.peerconnection.enabled=false)",
      "Use browser extensions (WebRTC Control, uBlock Origin)",
      "Configure browser policies to disable WebRTC",
      "Use browsers with built-in WebRTC protection (Mullvad Browser)",
      "Proxy WebRTC through TURN server inside VPN",
    ],
    cwe: "CWE-200",
    references: [
      "https://www.privacytools.io/browsers/#webrtc",
      "https://mullvad.net/help/webrtc/",
    ],
  },
  {
    id: "leak-ipv6-01",
    type: "ipv6-leak",
    name: "IPv6 Traffic Bypass",
    severity: "high",
    cvss: 7.5,
    description: "IPv6 traffic routes outside the VPN tunnel because the VPN only handles IPv4, exposing real IPv6 address and traffic.",
    detectionMethods: [
      "Compare IPv6 address to VPN exit",
      "Monitor IPv6 traffic during VPN session",
      "External IPv6 leak test services",
    ],
    indicators: [
      "IPv6 connectivity while VPN reports IPv4-only",
      "Different IPv6 address than expected",
      "IPv6 traffic on physical interface",
    ],
    automatable: true,
    testSteps: [
      "1. Connect to VPN",
      "2. Visit ipv6leak.com or test-ipv6.com",
      "3. If IPv6 address shown differs from VPN or is your ISP's, leak exists",
      "4. Check with: curl -6 ifconfig.co",
    ],
    tools: [
      "ipv6leak.com",
      "test-ipv6.com",
      "ipleak.net",
      "curl -6",
      "ip -6 addr",
    ],
    remediation: [
      "Disable IPv6 at OS level if VPN doesn't support it",
      "Use VPN with native IPv6 tunnel support",
      "Configure firewall to block IPv6 outside tunnel",
      "Enable VPN's IPv6 leak protection",
      "sysctl net.ipv6.conf.all.disable_ipv6=1",
    ],
    cwe: "CWE-200",
    references: [
      "https://www.top10vpn.com/tools/what-is-my-ip/ipv6-leak-test/",
    ],
  },
  {
    id: "leak-killswitch-01",
    type: "kill-switch-bypass",
    name: "Kill Switch Failure on VPN Drop",
    severity: "critical",
    cvss: 8.5,
    description: "When VPN connection drops, traffic continues over the unprotected network connection instead of being blocked, exposing real IP and traffic.",
    detectionMethods: [
      "Force VPN disconnect while monitoring traffic",
      "Test firewall rules after VPN process termination",
      "Monitor network during VPN reconnection",
    ],
    indicators: [
      "Traffic flows after VPN process killed",
      "No firewall rules blocking non-VPN traffic",
      "Successful connections during VPN reconnect",
    ],
    automatable: true,
    testSteps: [
      "1. Connect to VPN",
      "2. Start continuous ping to 8.8.8.8",
      "3. Kill VPN process (pkill openvpn or similar)",
      "4. Observe if pings continue uninterrupted",
      "5. Check firewall rules: iptables -L -n",
    ],
    tools: [
      "ping (continuous)",
      "iptables/nftables",
      "Windows Firewall (netsh)",
      "Wireshark",
    ],
    remediation: [
      "Enable VPN client's kill switch feature",
      "Configure OS firewall to only allow VPN interface traffic",
      "Use WireGuard's AllowedIPs 0.0.0.0/0 (implicit kill switch)",
      "iptables -A OUTPUT ! -o tun0 -j DROP",
      "Use systemd unit with BindsTo for auto-kill",
    ],
    cwe: "CWE-636",
    references: [
      "https://mullvad.net/help/linux-kill-switch-iptables/",
    ],
  },
  {
    id: "leak-traffic-correlation-01",
    type: "traffic-correlation",
    name: "Traffic Correlation Attack",
    severity: "medium",
    cvss: 5.9,
    description: "Adversary observing both VPN entry and exit can correlate traffic patterns (timing, volume) to link users to their activities despite encryption.",
    detectionMethods: [
      "Statistical analysis of traffic patterns",
      "Timing correlation across entry/exit",
      "Volume analysis",
    ],
    indicators: [
      "Unique traffic patterns (streaming, downloads)",
      "Predictable timing of activities",
      "Fixed session durations",
    ],
    automatable: false,
    testSteps: [
      "1. Traffic correlation is a passive attack",
      "2. Self-test: analyze your traffic patterns",
      "3. Consider: does your VPN provider log connection times?",
      "4. Evaluate if you connect to the same servers at predictable times",
    ],
    tools: [
      "Wireshark (traffic analysis)",
      "NetFlow/sFlow collectors",
      "Statistical analysis tools",
    ],
    remediation: [
      "Use multi-hop VPN (entry/exit in different jurisdictions)",
      "Add chaff traffic to obscure patterns",
      "Use no-log VPN providers",
      "Avoid predictable usage patterns",
      "Consider Tor for high-risk scenarios",
    ],
    cwe: "CWE-200",
    references: [
      "https://www.usenix.org/conference/usenixsecurity14/technical-sessions/presentation/johnson",
    ],
  },
  {
    id: "leak-split-tunnel-01",
    type: "split-tunnel-leak",
    name: "Split Tunnel Misconfiguration",
    severity: "medium",
    cvss: 6.5,
    description: "Split tunneling configuration allows sensitive traffic to bypass VPN, exposing certain applications or destinations.",
    detectionMethods: [
      "Review VPN routing table",
      "Monitor traffic on physical vs tunnel interface",
      "Test specific application traffic paths",
    ],
    indicators: [
      "Some traffic on physical interface during VPN session",
      "Partial VPN routes (not 0.0.0.0/0)",
      "Application-specific leaks",
    ],
    automatable: true,
    testSteps: [
      "1. Connect to VPN",
      "2. Check routing: route print or ip route",
      "3. Identify if default route goes through VPN",
      "4. Test specific apps: curl --interface eth0 ifconfig.me",
      "5. If any traffic bypasses tunnel, split tunnel is leaking",
    ],
    tools: [
      "route print",
      "ip route show",
      "netstat -rn",
      "Wireshark (interface comparison)",
    ],
    remediation: [
      "Disable split tunneling if not needed",
      "Review and audit split tunnel rules",
      "Use application-level VPN enforcement",
      "Configure firewall to block non-tunnel traffic for sensitive apps",
    ],
    cwe: "CWE-16",
    references: [],
  },
  {
    id: "leak-captive-portal-01",
    type: "captive-portal-bypass",
    name: "Captive Portal VPN Bypass",
    severity: "low",
    cvss: 4.3,
    description: "Captive portal detection mechanisms bypass VPN tunnel to check network connectivity, potentially leaking requests.",
    detectionMethods: [
      "Monitor HTTP requests during VPN connection",
      "Check captive portal detection URLs",
      "Analyze OS network connectivity checks",
    ],
    indicators: [
      "HTTP requests to connectivitycheck.gstatic.com outside VPN",
      "Windows NCSI traffic on physical interface",
      "macOS captive.apple.com checks",
    ],
    automatable: true,
    testSteps: [
      "1. Connect to VPN",
      "2. Capture traffic: tcpdump -i eth0 port 80",
      "3. Look for: connectivitycheck.*, captive.apple.com, msftconnecttest.com",
      "4. If seen, captive portal checks are leaking",
    ],
    tools: [
      "tcpdump",
      "Wireshark",
      "Little Snitch (macOS)",
    ],
    remediation: [
      "Disable OS captive portal detection",
      "Configure VPN to handle captive portals",
      "Windows: HKLM\\SYSTEM\\CurrentControlSet\\Services\\NlaSvc\\Parameters\\Internet\\EnableActiveProbing=0",
      "macOS: defaults write /Library/Preferences/SystemConfiguration/com.apple.captive.control Active -bool false",
    ],
    cwe: "CWE-200",
    references: [],
  },
  {
    id: "leak-torrent-01",
    type: "torrent-leak",
    name: "BitTorrent Client IP Leak",
    severity: "high",
    cvss: 7.5,
    description: "BitTorrent clients announce real IP via DHT, PEX, or tracker requests that bypass VPN tunnel.",
    detectionMethods: [
      "Monitor torrent client traffic",
      "Check DHT announcements",
      "Review tracker responses",
    ],
    indicators: [
      "DHT traffic on physical interface",
      "Real IP in tracker announcements",
      "UPnP/NAT-PMP exposing real IP",
    ],
    automatable: true,
    testSteps: [
      "1. Connect to VPN",
      "2. Start torrent client with a test torrent",
      "3. Visit ipleak.net/torrent or use checkmytorrentip.upcoil.com",
      "4. Add the magnet link and check reported IP",
      "5. If real IP shown, torrent is leaking",
    ],
    tools: [
      "ipleak.net/torrent",
      "checkmytorrentip.upcoil.com",
      "Wireshark (BitTorrent filter)",
    ],
    remediation: [
      "Disable DHT and PEX in torrent client",
      "Bind torrent client to VPN interface only",
      "Use torrent-friendly VPN with port forwarding",
      "Enable VPN kill switch",
      "Configure client proxy through VPN SOCKS5",
    ],
    cwe: "CWE-200",
    references: [],
  },
  {
    id: "leak-timing-01",
    type: "timing-attack",
    name: "VPN Protocol Timing Analysis",
    severity: "medium",
    cvss: 5.3,
    description: "Timing patterns in VPN traffic can reveal protocol type, usage patterns, or content characteristics despite encryption.",
    detectionMethods: [
      "Statistical timing analysis",
      "Inter-packet delay measurement",
      "Traffic burst pattern analysis",
    ],
    indicators: [
      "Recognizable timing patterns",
      "Protocol-specific handshake timing",
      "Usage pattern correlation",
    ],
    automatable: false,
    testSteps: [
      "1. Capture VPN traffic over time",
      "2. Analyze inter-packet timing distribution",
      "3. Look for patterns correlating with activities",
      "4. This is an advanced attack requiring significant traffic",
    ],
    tools: [
      "tshark (timing analysis)",
      "Statistical analysis tools",
      "Machine learning classifiers",
    ],
    remediation: [
      "Use traffic obfuscation (obfs4, wstunnel)",
      "Pad packets to fixed sizes",
      "Add random delays (increases latency)",
      "Use constant-rate tunnels",
    ],
    cwe: "CWE-208",
    references: [],
  },
  {
    id: "leak-fingerprint-01",
    type: "browser-fingerprint",
    name: "Browser Fingerprint Persistence Through VPN",
    severity: "medium",
    cvss: 5.9,
    description: "Browser fingerprint (canvas, WebGL, fonts, plugins) remains constant across VPN sessions, allowing cross-session tracking.",
    detectionMethods: [
      "Browser fingerprint comparison across sessions",
      "Canvas/WebGL fingerprint analysis",
      "Font enumeration detection",
    ],
    indicators: [
      "Identical fingerprint with different VPN servers",
      "Unique canvas/WebGL hash",
      "Rare plugin combination",
    ],
    automatable: true,
    testSteps: [
      "1. Visit browserleaks.com before VPN",
      "2. Connect to VPN (different server)",
      "3. Visit browserleaks.com again",
      "4. Compare fingerprint values",
      "5. If identical, fingerprint persists through VPN",
    ],
    tools: [
      "browserleaks.com",
      "amiunique.org",
      "coveryourtracks.eff.org",
      "Puppeteer fingerprint scripts",
    ],
    remediation: [
      "Use privacy-focused browser (Tor Browser, Mullvad Browser)",
      "Enable resist fingerprinting (Firefox privacy.resistFingerprinting)",
      "Use browser profiles with different fingerprints",
      "Consider canvas/WebGL blocking extensions",
      "Randomize fingerprint per session (JS injection)",
    ],
    cwe: "CWE-200",
    references: [
      "https://www.eff.org/pages/cover-your-tracks",
    ],
  },
];

// ─── VPN Defense Playbooks ───────────────────────────────────────────────────

export const VPN_DEFENSE_PLAYBOOKS: readonly VpnDefensePlaybook[] = [
  {
    id: "def-protocol-01",
    name: "VPN Protocol Hardening",
    category: "protocol-hardening",
    description: "Configure VPN protocols with maximum security settings, eliminate weak ciphers, and enforce modern cryptography.",
    effectiveness: 9,
    implementation: {
      principle: "Use only audited protocols (WireGuard, OpenVPN) with AEAD ciphers and strong key exchange.",
      codeExamples: [
        {
          language: "OpenVPN",
          code: `# Server configuration
cipher AES-256-GCM
ncp-ciphers AES-256-GCM:CHACHA20-POLY1305
auth SHA384
tls-version-min 1.2
tls-cipher TLS-ECDHE-RSA-WITH-AES-256-GCM-SHA384
ecdh-curve secp384r1
dh none
tls-crypt ta.key
remote-cert-tls client
verify-x509-name client-cert name`,
          notes: "Use tls-crypt (not tls-auth) for control channel encryption. Disable static DH, use ECDHE.",
        },
        {
          language: "WireGuard",
          code: `# /etc/wireguard/wg0.conf
[Interface]
PrivateKey = <server_private_key>
Address = 10.0.0.1/24
ListenPort = 51820
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

[Peer]
PublicKey = <client_public_key>
AllowedIPs = 10.0.0.2/32
PersistentKeepalive = 25`,
          notes: "WireGuard uses fixed modern cryptography. Focus on key management and network isolation.",
        },
        {
          language: "IKEv2",
          code: `# strongSwan ipsec.conf
conn vpn
    keyexchange=ikev2
    ike=aes256gcm16-prfsha384-ecp384!
    esp=aes256gcm16-ecp384!
    dpdaction=clear
    dpddelay=300s
    rekey=no
    left=%any
    leftcert=server.crt
    leftsendcert=always
    right=%any
    rightauth=eap-mschapv2
    rightsourceip=10.0.0.0/24
    rightdns=10.0.0.1`,
          notes: "Use ECDH groups (ecp384) over MODP. Enable DPD for stale connection cleanup.",
        },
      ],
      configuration: [
        "Disable all CBC-mode ciphers (use GCM or ChaCha20-Poly1305)",
        "Enforce TLS 1.2+ for control channel",
        "Use ECDHE for key exchange (secp384r1 or x25519)",
        "Enable Perfect Forward Secrecy",
        "Set appropriate key lifetimes (4-24 hours for data keys)",
      ],
      commonMistakes: [
        "Allowing fallback to weak ciphers via ncp-ciphers",
        "Using static DH instead of ECDHE",
        "Enabling TLS 1.0/1.1 for compatibility",
        "Using pre-shared keys instead of certificates",
        "Not enabling tls-crypt/tls-auth",
      ],
    },
    testCases: [
      {
        name: "Cipher Suite Verification",
        description: "Verify only strong ciphers are negotiated",
        steps: [
          "Connect to VPN with verbose logging",
          "Check negotiated cipher in connection log",
          "Attempt connection with weak cipher only",
          "Confirm weak cipher is rejected",
        ],
        expected: "Only AES-256-GCM or ChaCha20-Poly1305 negotiated",
        automatable: true,
      },
      {
        name: "TLS Version Check",
        description: "Verify TLS 1.2+ enforcement",
        steps: [
          "Attempt OpenVPN connection with TLS 1.1 maximum",
          "Check if connection is rejected",
          "Verify TLS 1.2+ in successful connection logs",
        ],
        expected: "TLS 1.0 and 1.1 connections are rejected",
        automatable: true,
      },
    ],
    mitigatesLeaks: [],
    references: [
      "https://community.openvpn.net/openvpn/wiki/BestPractices",
      "https://www.wireguard.com/papers/wireguard.pdf",
    ],
  },
  {
    id: "def-leak-01",
    name: "Comprehensive Leak Prevention",
    category: "leak-prevention",
    description: "Implement DNS, WebRTC, IPv6, and kill switch protections to prevent information leakage outside VPN tunnel.",
    effectiveness: 10,
    implementation: {
      principle: "Block all traffic that could bypass the VPN tunnel at the OS/firewall level.",
      codeExamples: [
        {
          language: "Linux (iptables)",
          code: `#!/bin/bash
# VPN Kill Switch with DNS leak prevention
VPN_IF="tun0"
VPN_DNS="10.0.0.1"
LOCAL_NET="192.168.1.0/24"

# Flush existing rules
iptables -F
iptables -X

# Default policies: drop everything
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP

# Allow loopback
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# Allow established connections
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow LAN (adjust your local network)
iptables -A INPUT -s $LOCAL_NET -j ACCEPT
iptables -A OUTPUT -d $LOCAL_NET -j ACCEPT

# Allow VPN tunnel
iptables -A INPUT -i $VPN_IF -j ACCEPT
iptables -A OUTPUT -o $VPN_IF -j ACCEPT

# Allow VPN establishment (UDP OpenVPN)
iptables -A OUTPUT -p udp --dport 1194 -j ACCEPT
# Or for WireGuard
iptables -A OUTPUT -p udp --dport 51820 -j ACCEPT

# DNS only through VPN DNS
iptables -A OUTPUT -d $VPN_DNS -p udp --dport 53 -j ACCEPT
iptables -A OUTPUT -d $VPN_DNS -p tcp --dport 53 -j ACCEPT

# Block IPv6
ip6tables -P INPUT DROP
ip6tables -P FORWARD DROP
ip6tables -P OUTPUT DROP`,
          notes: "Adjust VPN_IF, VPN_DNS, and LOCAL_NET for your setup. Run before connecting to VPN.",
        },
        {
          language: "Windows (PowerShell)",
          code: `# VPN Kill Switch via Windows Firewall
$vpnAdapter = "WireGuard Tunnel"
$localNet = "192.168.1.0/24"

# Block all outbound by default
New-NetFirewallRule -DisplayName "VPN Kill Switch - Block All" -Direction Outbound -Action Block -Profile Any

# Allow VPN adapter traffic
New-NetFirewallRule -DisplayName "VPN Kill Switch - Allow VPN" -Direction Outbound -InterfaceAlias $vpnAdapter -Action Allow -Profile Any

# Allow local network
New-NetFirewallRule -DisplayName "VPN Kill Switch - Allow LAN" -Direction Outbound -RemoteAddress $localNet -Action Allow -Profile Any

# Allow DHCP
New-NetFirewallRule -DisplayName "VPN Kill Switch - Allow DHCP" -Direction Outbound -Protocol UDP -RemotePort 67,68 -Action Allow -Profile Any

# Disable IPv6
Set-NetAdapterBinding -Name "*" -ComponentID ms_tcpip6 -Enabled $false`,
          notes: "Run as Administrator. Adjust $vpnAdapter to match your VPN interface name.",
        },
        {
          language: "Browser (Firefox)",
          code: `// about:config settings for WebRTC leak prevention
media.peerconnection.enabled = false
media.peerconnection.ice.default_address_only = true
media.peerconnection.ice.no_host = true
media.peerconnection.ice.proxy_only_if_behind_proxy = true

// DNS-over-HTTPS
network.trr.mode = 3  // DoH only
network.trr.uri = https://cloudflare-dns.com/dns-query

// Disable captive portal detection
network.captive-portal-service.enabled = false`,
          notes: "Apply via user.js or about:config. Consider Tor Browser or Mullvad Browser for full protection.",
        },
      ],
      configuration: [
        "Enable VPN client's built-in kill switch",
        "Configure OS firewall to allow only VPN interface traffic",
        "Disable IPv6 at adapter or OS level",
        "Use VPN provider's DNS servers",
        "Disable WebRTC in browsers",
        "Configure applications to bind to VPN interface",
      ],
      commonMistakes: [
        "Relying solely on VPN client kill switch (can be buggy)",
        "Forgetting IPv6 leak vector",
        "Not testing kill switch after configuration",
        "Allowing captive portal detection to bypass VPN",
        "Not binding torrent/P2P clients to VPN interface",
      ],
    },
    testCases: [
      {
        name: "DNS Leak Test",
        description: "Verify DNS queries go through VPN",
        steps: [
          "Connect to VPN",
          "Visit dnsleaktest.com",
          "Run extended test",
          "Verify all DNS servers are VPN provider's",
        ],
        expected: "Only VPN DNS servers shown, no ISP DNS",
        automatable: true,
      },
      {
        name: "Kill Switch Test",
        description: "Verify traffic stops when VPN drops",
        steps: [
          "Connect to VPN",
          "Start continuous ping to 8.8.8.8",
          "Disconnect/kill VPN process",
          "Observe ping behavior",
        ],
        expected: "Pings fail immediately after VPN disconnect",
        automatable: true,
      },
      {
        name: "WebRTC Leak Test",
        description: "Verify WebRTC doesn't leak IP",
        steps: [
          "Connect to VPN",
          "Visit browserleaks.com/webrtc",
          "Check for local/public IP disclosure",
        ],
        expected: "No IP or only VPN IP shown",
        automatable: true,
      },
    ],
    mitigatesLeaks: [
      "dns-leak",
      "webrtc-leak",
      "ipv6-leak",
      "kill-switch-bypass",
      "split-tunnel-leak",
      "captive-portal-bypass",
      "torrent-leak",
    ],
    references: [
      "https://mullvad.net/help/dns-leaks/",
      "https://mullvad.net/help/linux-kill-switch-iptables/",
    ],
  },
  {
    id: "def-obfuscation-01",
    name: "Traffic Obfuscation",
    category: "traffic-obfuscation",
    description: "Disguise VPN traffic to bypass censorship and DPI-based blocking.",
    effectiveness: 8,
    implementation: {
      principle: "Make VPN traffic indistinguishable from regular HTTPS or other allowed traffic.",
      codeExamples: [
        {
          language: "OpenVPN + stunnel",
          code: `# stunnel.conf (client)
[openvpn]
client = yes
accept = 127.0.0.1:1194
connect = vpn.example.com:443
verifyChain = yes
CAfile = ca.crt

# OpenVPN client config
remote 127.0.0.1 1194 tcp
# (rest of config)`,
          notes: "Wraps OpenVPN in TLS. Server needs stunnel listening on 443.",
        },
        {
          language: "WireGuard + wstunnel",
          code: `# Server
wstunnel server ws://0.0.0.0:443 --restrict-to 127.0.0.1:51820

# Client
wstunnel client -L udp://127.0.0.1:51820:127.0.0.1:51820 ws://vpn.example.com:443

# WireGuard client config
[Peer]
Endpoint = 127.0.0.1:51820
# (rest of config)`,
          notes: "Tunnels WireGuard UDP over WebSocket. Looks like regular HTTPS traffic.",
        },
        {
          language: "V2Ray",
          code: `// Client config for V2Ray with WebSocket
{
  "outbounds": [{
    "protocol": "vmess",
    "settings": {
      "vnext": [{
        "address": "vpn.example.com",
        "port": 443,
        "users": [{ "id": "your-uuid", "security": "auto" }]
      }]
    },
    "streamSettings": {
      "network": "ws",
      "security": "tls",
      "wsSettings": { "path": "/websocket" }
    }
  }]
}`,
          notes: "V2Ray masquerades as HTTPS to a CDN. Can be routed through Cloudflare.",
        },
      ],
      configuration: [
        "Use TCP port 443 for VPN (mimics HTTPS)",
        "Enable obfuscation plugins (obfs4, meek, shadowsocks)",
        "Consider domain fronting where available",
        "Use WebSocket transport for CDN compatibility",
        "Implement TLS for wrapper layer",
      ],
      commonMistakes: [
        "Using distinctive TLS fingerprints",
        "Not matching SNI with actual website",
        "Predictable packet sizes despite obfuscation",
        "Using known VPN server IPs (already blocked)",
        "Static obfuscation patterns detectable by ML",
      ],
    },
    testCases: [
      {
        name: "DPI Detection Test",
        description: "Verify traffic is not identifiable as VPN",
        steps: [
          "Capture VPN traffic with tcpdump",
          "Analyze with nDPI or similar classifier",
          "Check if classified as VPN or generic HTTPS",
        ],
        expected: "Traffic classified as HTTPS/TLS, not OpenVPN/WireGuard",
        automatable: true,
      },
    ],
    mitigatesLeaks: ["timing-attack"],
    references: [
      "https://github.com/StreisandEffect/streisand",
      "https://github.com/erebe/wstunnel",
    ],
  },
  {
    id: "def-key-mgmt-01",
    name: "VPN Key Management",
    category: "key-management",
    description: "Secure generation, storage, rotation, and revocation of VPN cryptographic keys.",
    effectiveness: 9,
    implementation: {
      principle: "Use unique keys per device, rotate regularly, and maintain secure key storage.",
      codeExamples: [
        {
          language: "WireGuard",
          code: `#!/bin/bash
# Generate new WireGuard keys
umask 077
wg genkey | tee privatekey | wg pubkey > publickey

# Key rotation script
NEW_PRIVKEY=$(wg genkey)
NEW_PUBKEY=$(echo $NEW_PRIVKEY | wg pubkey)

# Update local config
wg set wg0 private-key <(echo $NEW_PRIVKEY)

# Notify server to update peer pubkey
# (implement via API or config management)

# Store old key for grace period
echo "$(date): Rotated key" >> /var/log/wg-rotation.log`,
          notes: "Rotate keys every 90 days. Maintain old keys briefly for reconnection window.",
        },
        {
          language: "OpenVPN PKI",
          code: `#!/bin/bash
# EasyRSA key generation
cd /etc/openvpn/easy-rsa

# Initialize PKI
./easyrsa init-pki

# Build CA (offline if possible)
./easyrsa build-ca nopass

# Generate server cert
./easyrsa build-server-full server nopass

# Generate CRL
./easyrsa gen-crl

# Generate client cert with unique CN
CLIENT_CN="user-$(date +%Y%m%d)-$(openssl rand -hex 4)"
./easyrsa build-client-full $CLIENT_CN nopass

# Generate tls-crypt key
openvpn --genkey secret ta.key`,
          notes: "Use unique CNs per device. Maintain CRL for revocation. Store CA offline.",
        },
      ],
      configuration: [
        "Generate unique keys per device (no key sharing)",
        "Rotate keys every 90 days minimum",
        "Maintain CRL and OCSP for certificate-based VPNs",
        "Store private keys with 600 permissions (owner read/write only)",
        "Consider HSM or secure enclave for high-security deployments",
        "Implement key escrow for recovery scenarios",
      ],
      commonMistakes: [
        "Sharing keys across devices",
        "Not rotating keys after employee offboarding",
        "Storing keys with world-readable permissions",
        "Not maintaining CRL for revocation",
        "Using weak key generation entropy",
      ],
    },
    testCases: [
      {
        name: "Key Uniqueness Check",
        description: "Verify each device has unique keys",
        steps: [
          "Collect public keys from all devices",
          "Check for duplicates",
          "Verify key generation dates",
        ],
        expected: "All public keys are unique",
        automatable: true,
      },
      {
        name: "Key Rotation Compliance",
        description: "Verify keys are rotated within policy",
        steps: [
          "Check key generation timestamps",
          "Compare against rotation policy (90 days)",
          "Identify stale keys",
        ],
        expected: "No keys older than rotation policy",
        automatable: true,
      },
    ],
    mitigatesLeaks: [],
    references: [
      "https://www.wireguard.com/quickstart/",
      "https://easy-rsa.readthedocs.io/",
    ],
  },
  {
    id: "def-auth-01",
    name: "VPN Authentication Hardening",
    category: "authentication",
    description: "Implement strong multi-factor authentication for VPN access.",
    effectiveness: 9,
    implementation: {
      principle: "Use certificate-based auth with optional MFA. Avoid PSK for user authentication.",
      codeExamples: [
        {
          language: "OpenVPN + TOTP",
          code: `# Server config
plugin /usr/lib/openvpn/plugins/openvpn-plugin-auth-pam.so openvpn
verify-client-cert require

# PAM config (/etc/pam.d/openvpn)
auth required pam_google_authenticator.so
auth required pam_unix.so
account required pam_unix.so

# Client config
auth-user-pass
# User enters: username / TOTP_code+password`,
          notes: "Combines certificate, password, and TOTP. User must have google-authenticator configured.",
        },
        {
          language: "IKEv2 + EAP-TLS",
          code: `# strongSwan ipsec.conf
conn vpn-eap-tls
    keyexchange=ikev2
    left=%any
    leftcert=server.crt
    leftid=@vpn.example.com
    leftsendcert=always
    right=%any
    rightauth=eap-tls
    rightcert=client.crt
    rightsourceip=10.0.0.0/24
    eap_identity=%identity
    auto=add`,
          notes: "EAP-TLS requires client certificates. Strongest IKEv2 auth option.",
        },
      ],
      configuration: [
        "Require client certificates (not PSK)",
        "Implement MFA (TOTP, hardware token, or push notification)",
        "Use EAP-TLS or EAP-TTLS for enterprise deployments",
        "Set account lockout after failed attempts",
        "Log all authentication events",
        "Implement certificate expiration monitoring",
      ],
      commonMistakes: [
        "Using pre-shared keys for user authentication",
        "Allowing password-only authentication",
        "Not monitoring failed authentication attempts",
        "Sharing certificates across users",
        "Not revoking certs when users leave",
      ],
    },
    testCases: [
      {
        name: "PSK Authentication Rejection",
        description: "Verify PSK-only auth is rejected",
        steps: [
          "Attempt VPN connection with PSK only (no cert)",
          "Verify connection is rejected",
          "Check server logs for rejection reason",
        ],
        expected: "Connection rejected, cert required",
        automatable: true,
      },
      {
        name: "Revoked Certificate Test",
        description: "Verify revoked certs are rejected",
        steps: [
          "Revoke a test certificate",
          "Update CRL on VPN server",
          "Attempt connection with revoked cert",
        ],
        expected: "Connection rejected with revocation error",
        automatable: true,
      },
    ],
    mitigatesLeaks: [],
    references: [
      "https://wiki.strongswan.org/projects/strongswan/wiki/EapConfiguration",
    ],
  },
  {
    id: "def-isolation-01",
    name: "Network Isolation",
    category: "network-isolation",
    description: "Implement network segmentation and access controls for VPN clients.",
    effectiveness: 8,
    implementation: {
      principle: "Apply principle of least privilege. VPN clients should only access required resources.",
      codeExamples: [
        {
          language: "OpenVPN CCD",
          code: `# /etc/openvpn/ccd/user@example.com
# Per-client configuration
ifconfig-push 10.0.0.50 255.255.255.0
push "route 192.168.1.0 255.255.255.0"
# Don't push default gateway - split tunnel for specific resources only

# Server iptables
iptables -A FORWARD -s 10.0.0.50 -d 192.168.1.100 -p tcp --dport 443 -j ACCEPT
iptables -A FORWARD -s 10.0.0.50 -j DROP`,
          notes: "CCD (client-config-dir) allows per-user routing and firewall rules.",
        },
        {
          language: "WireGuard + nftables",
          code: `# nftables isolation rules
table inet vpn_acl {
    chain forward {
        type filter hook forward priority 0; policy drop;
        
        # Engineering team - access to internal apps
        iifname "wg0" ip saddr 10.0.0.0/28 ip daddr 192.168.1.0/24 accept
        
        # Contractors - access to specific host only
        iifname "wg0" ip saddr 10.0.0.16/28 ip daddr 192.168.1.100 tcp dport 443 accept
        
        # All VPN - DNS and established
        iifname "wg0" ip daddr 10.0.0.1 udp dport 53 accept
        ct state established,related accept
    }
}`,
          notes: "Allocate IP ranges to user groups. Apply firewall rules per range.",
        },
      ],
      configuration: [
        "Segment VPN clients by role/department into IP ranges",
        "Apply firewall rules per client or group",
        "Restrict inter-client communication unless required",
        "Log all cross-segment access attempts",
        "Implement zero-trust principles within VPN",
      ],
      commonMistakes: [
        "Granting full network access to all VPN clients",
        "Not restricting client-to-client traffic",
        "Using flat IP addressing (no segmentation)",
        "Not logging denied access attempts",
        "Allowing VPN clients to reach management interfaces",
      ],
    },
    testCases: [
      {
        name: "Unauthorized Access Block",
        description: "Verify clients can't access restricted resources",
        steps: [
          "Connect as contractor-role VPN user",
          "Attempt to access engineering-only resource",
          "Verify access is denied",
        ],
        expected: "Access denied, connection blocked",
        automatable: true,
      },
    ],
    mitigatesLeaks: [],
    references: [
      "https://wiki.nftables.org/",
    ],
  },
  {
    id: "def-monitoring-01",
    name: "VPN Monitoring & Alerting",
    category: "monitoring",
    description: "Implement comprehensive logging, monitoring, and alerting for VPN infrastructure.",
    effectiveness: 7,
    implementation: {
      principle: "Log all connection events, monitor for anomalies, alert on suspicious activity.",
      codeExamples: [
        {
          language: "OpenVPN",
          code: `# Server config - verbose logging
verb 4
status /var/log/openvpn/status.log 10
log-append /var/log/openvpn/openvpn.log

# Client connect/disconnect scripts
client-connect /etc/openvpn/scripts/client-connect.sh
client-disconnect /etc/openvpn/scripts/client-disconnect.sh

# client-connect.sh
#!/bin/bash
echo "$(date): CONNECT cn=$common_name ip=$trusted_ip vpn_ip=$ifconfig_pool_remote_ip" >> /var/log/openvpn/audit.log
# Send to SIEM
logger -p auth.info -t openvpn "VPN_CONNECT cn=$common_name src=$trusted_ip dst=$ifconfig_pool_remote_ip"`,
          notes: "Log to syslog for SIEM integration. Include CN, source IP, and assigned VPN IP.",
        },
        {
          language: "Prometheus + Grafana",
          code: `# prometheus.yml
- job_name: 'wireguard'
  static_configs:
    - targets: ['localhost:9586']  # wireguard_exporter

# Alert rules
groups:
- name: vpn_alerts
  rules:
  - alert: VPNClientConnectedFromNewCountry
    expr: |
      changes(wireguard_peer_last_handshake_seconds[1h]) > 0
      and on(public_key) (geoip_country != geoip_country offset 24h)
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "VPN client {{ $labels.public_key }} connected from new country"
      
  - alert: VPNBruteForce
    expr: rate(openvpn_auth_failures_total[5m]) > 5
    for: 2m
    labels:
      severity: critical`,
          notes: "Use Prometheus exporters for WireGuard/OpenVPN metrics. Alert on geo-anomalies.",
        },
      ],
      configuration: [
        "Log connection/disconnection events with timestamps",
        "Record source IPs for geo-analysis",
        "Monitor for concurrent sessions from same user",
        "Alert on geo-impossible logins",
        "Track bandwidth consumption per user",
        "Monitor authentication failures",
      ],
      commonMistakes: [
        "Logging user passwords (security violation)",
        "Not correlating VPN logs with other security logs",
        "Setting alert thresholds too low (alert fatigue)",
        "Not retaining logs for investigation",
        "Ignoring geographic anomaly alerts",
      ],
    },
    testCases: [
      {
        name: "Login Alert Test",
        description: "Verify alerts fire on suspicious login",
        steps: [
          "Configure alert for new geo",
          "Connect from VPN server in different country",
          "Verify alert fires",
        ],
        expected: "Alert generated for new geo login",
        automatable: false,
      },
    ],
    mitigatesLeaks: [],
    references: [
      "https://github.com/MindFlavor/prometheus_wireguard_exporter",
    ],
  },
  {
    id: "def-failsafe-01",
    name: "Failsafe Configuration",
    category: "failsafe",
    description: "Implement redundancy, failover, and recovery mechanisms for VPN infrastructure.",
    effectiveness: 7,
    implementation: {
      principle: "Ensure VPN availability through redundancy and automatic failover.",
      codeExamples: [
        {
          language: "OpenVPN",
          code: `# Client config with failover
remote vpn1.example.com 1194 udp
remote vpn2.example.com 1194 udp
remote vpn1.example.com 443 tcp
remote vpn2.example.com 443 tcp
remote-random
connect-retry 5
connect-retry-max 3
resolv-retry infinite

# Server-side HAProxy
frontend vpn_lb
    bind *:1194
    mode tcp
    default_backend vpn_servers

backend vpn_servers
    mode tcp
    balance roundrobin
    option tcp-check
    server vpn1 10.0.0.11:1194 check
    server vpn2 10.0.0.12:1194 check backup`,
          notes: "Multiple remotes with random selection. HAProxy for active health checking.",
        },
        {
          language: "WireGuard",
          code: `# Multi-peer failover (client)
[Interface]
PrivateKey = <key>
Address = 10.0.0.2/32
# Try primary, then backup DNS
DNS = 10.0.0.1, 10.0.1.1

[Peer]
# Primary server
PublicKey = <primary_key>
Endpoint = vpn1.example.com:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25

# Note: WireGuard doesn't support native failover
# Use wg-quick hooks or external scripts

# PostUp hook for failover monitoring
PostUp = /etc/wireguard/monitor-failover.sh &`,
          notes: "WireGuard lacks native failover. Implement via scripts that swap Peer config.",
        },
      ],
      configuration: [
        "Deploy VPN servers in multiple availability zones",
        "Configure clients with multiple server endpoints",
        "Implement health checks on VPN servers",
        "Use DNS-based failover (short TTL)",
        "Document recovery procedures",
        "Test failover regularly",
      ],
      commonMistakes: [
        "Single point of failure VPN server",
        "Not testing failover before production",
        "Long DNS TTL preventing rapid failover",
        "Not monitoring backup server health",
        "Missing documentation for manual failover",
      ],
    },
    testCases: [
      {
        name: "Failover Test",
        description: "Verify automatic failover works",
        steps: [
          "Connect to primary VPN server",
          "Shut down primary server",
          "Verify client reconnects to backup",
          "Check continuity of VPN connection",
        ],
        expected: "Client automatically fails over with minimal disruption",
        automatable: true,
      },
    ],
    mitigatesLeaks: ["kill-switch-bypass"],
    references: [],
  },
];

// ─── VPN Provider Profiles ───────────────────────────────────────────────────

export const VPN_PROVIDER_PROFILES: readonly VpnProviderProfile[] = [
  {
    provider: "mullvad",
    name: "Mullvad VPN",
    apiAvailable: true,
    apiEndpoint: "https://api.mullvad.net",
    protocols: ["wireguard", "openvpn"],
    features: [
      "Anonymous accounts (no email required)",
      "Cryptocurrency payments",
      "Multi-hop",
      "Port forwarding",
      "SOCKS5 proxy",
      "DNS-over-HTTPS",
      "Diskless servers (RAM-only)",
    ],
    jurisdictions: ["Sweden"],
    loggingPolicy: "no-logs",
    killSwitchSupport: true,
    multihopSupport: true,
    portForwardingSupport: true,
    integrationNotes: [
      "API: GET /www/relays/wireguard/ for server list",
      "Account creation: POST /www/accounts/",
      "WireGuard key upload: POST /www/wg-pubkeys/add/",
      "API uses account number as authentication",
    ],
    automationCapabilities: [
      "Create accounts programmatically",
      "Upload WireGuard keys via API",
      "Query server list and status",
      "Check account expiry",
      "Port forwarding management",
    ],
  },
  {
    provider: "nordvpn",
    name: "NordVPN",
    apiAvailable: true,
    apiEndpoint: "https://api.nordvpn.com",
    protocols: ["openvpn", "wireguard", "ikev2"],
    features: [
      "Double VPN",
      "Onion over VPN",
      "Dedicated IP",
      "CyberSec (ad blocking)",
      "Meshnet (peer-to-peer)",
      "Threat Protection",
    ],
    jurisdictions: ["Panama"],
    loggingPolicy: "no-logs",
    killSwitchSupport: true,
    multihopSupport: true,
    portForwardingSupport: false,
    integrationNotes: [
      "API: GET /v1/servers for server list",
      "OAuth2 authentication required",
      "NordLynx = WireGuard-based protocol",
      "Rate limits: 100 requests per minute",
    ],
    automationCapabilities: [
      "Query server list with filters (country, features)",
      "Get recommended server",
      "Check server load",
      "Manage Meshnet peers (with OAuth)",
    ],
  },
  {
    provider: "expressvpn",
    name: "ExpressVPN",
    apiAvailable: false,
    protocols: ["openvpn", "ikev2"],
    features: [
      "Lightway protocol (proprietary)",
      "TrustedServer (RAM-only)",
      "Split tunneling",
      "Network Lock (kill switch)",
      "Private DNS",
    ],
    jurisdictions: ["British Virgin Islands"],
    loggingPolicy: "no-logs",
    killSwitchSupport: true,
    multihopSupport: false,
    portForwardingSupport: false,
    integrationNotes: [
      "No public API available",
      "Manual config download required",
      "Lightway uses wolfSSL and ChaCha20",
      "OpenVPN configs available in account portal",
    ],
    automationCapabilities: [
      "Download OpenVPN configs manually",
      "Scrape server status from website (not recommended)",
    ],
  },
  {
    provider: "protonvpn",
    name: "ProtonVPN",
    apiAvailable: true,
    apiEndpoint: "https://api.protonvpn.ch",
    protocols: ["openvpn", "wireguard", "ikev2"],
    features: [
      "Secure Core (multi-hop through privacy-friendly countries)",
      "NetShield (ad/malware blocking)",
      "Tor over VPN",
      "Port forwarding (paid plans)",
      "Stealth protocol (obfuscation)",
    ],
    jurisdictions: ["Switzerland"],
    loggingPolicy: "no-logs",
    killSwitchSupport: true,
    multihopSupport: true,
    portForwardingSupport: true,
    integrationNotes: [
      "API: GET /vpn/logicals for server list",
      "Authentication: ProtonMail/VPN account",
      "Free tier available with API access",
      "Stealth protocol wraps WireGuard in TLS",
    ],
    automationCapabilities: [
      "Query server list with features filter",
      "Get VPN credentials",
      "WireGuard config generation",
      "NetShield configuration",
    ],
  },
  {
    provider: "tailscale",
    name: "Tailscale",
    apiAvailable: true,
    apiEndpoint: "https://api.tailscale.com",
    protocols: ["wireguard"],
    features: [
      "Zero-config mesh VPN",
      "MagicDNS",
      "ACLs (Access Control Lists)",
      "Exit nodes",
      "Subnet routing",
      "SSO integration (Google, Microsoft, Okta)",
      "Taildrop (file sharing)",
    ],
    jurisdictions: ["USA/Canada"],
    loggingPolicy: "minimal",
    killSwitchSupport: false,
    multihopSupport: false,
    portForwardingSupport: false,
    integrationNotes: [
      "API: OAuth2 or API key authentication",
      "Full API for device, ACL, and DNS management",
      "Coordination server (non-traffic) is centralized",
      "Data plane is peer-to-peer (no central server)",
      "Headscale: open-source coordination server alternative",
    ],
    automationCapabilities: [
      "List and manage devices",
      "Configure ACLs programmatically",
      "Manage DNS settings",
      "Enable/disable exit nodes",
      "Invite users via API",
      "Query device status and IP",
    ],
  },
  {
    provider: "surfshark",
    name: "Surfshark",
    apiAvailable: false,
    protocols: ["openvpn", "wireguard", "ikev2"],
    features: [
      "Unlimited devices",
      "CleanWeb (ad blocking)",
      "MultiHop",
      "Camouflage mode (obfuscation)",
      "NoBorders mode (censorship bypass)",
      "Nexus (server network optimization)",
    ],
    jurisdictions: ["Netherlands"],
    loggingPolicy: "no-logs",
    killSwitchSupport: true,
    multihopSupport: true,
    portForwardingSupport: false,
    integrationNotes: [
      "No public API",
      "Manual config download from account",
      "WireGuard configs available in apps",
    ],
    automationCapabilities: [],
  },
  {
    provider: "privateinternetaccess",
    name: "Private Internet Access (PIA)",
    apiAvailable: true,
    apiEndpoint: "https://www.privateinternetaccess.com/api",
    protocols: ["openvpn", "wireguard"],
    features: [
      "Open-source clients",
      "Port forwarding",
      "MACE (ad blocking)",
      "Split tunneling",
      "Multi-hop",
      "Dedicated IP",
    ],
    jurisdictions: ["USA"],
    loggingPolicy: "no-logs",
    killSwitchSupport: true,
    multihopSupport: true,
    portForwardingSupport: true,
    integrationNotes: [
      "API for server list and some features",
      "Open-source desktop/mobile clients on GitHub",
      "WireGuard key generation via API",
      "Port forwarding requires WireGuard",
    ],
    automationCapabilities: [
      "Query server list",
      "Generate WireGuard keys",
      "Request port forwarding",
      "Check server status",
    ],
  },
  {
    provider: "custom",
    name: "Custom/Self-Hosted VPN",
    apiAvailable: false,
    protocols: ["wireguard", "openvpn", "ikev2", "ipsec"],
    features: [
      "Full control over infrastructure",
      "Custom routing and firewall rules",
      "No third-party trust required",
      "Choice of hosting provider/country",
    ],
    jurisdictions: ["User-defined"],
    loggingPolicy: "no-logs",
    killSwitchSupport: true,
    multihopSupport: true,
    portForwardingSupport: true,
    integrationNotes: [
      "Deploy on VPS (DigitalOcean, Vultr, Hetzner, etc.)",
      "Use Algo VPN, Streisand, or manual setup",
      "WireGuard: wg-quick for simple deployment",
      "OpenVPN: use OpenVPN Access Server or manual config",
    ],
    automationCapabilities: [
      "Full API via your hosting provider",
      "Terraform/Ansible automation",
      "Custom key management",
      "Integrate with your monitoring stack",
    ],
  },
];

// ─── IP Reputation Detection ─────────────────────────────────────────────────

export interface IpReputationDatabase {
  readonly datacenterAsns: readonly number[];
  readonly knownVpnExitIps: readonly string[];
  readonly knownTorExitIps: readonly string[];
  readonly residentialProxyIndicators: readonly string[];
}

/**
 * Analyze an IP address for VPN/proxy indicators.
 * This is a pattern-based analysis - real-world use requires
 * integration with IP reputation services.
 */
export function analyzeIpReputation(
  ip: string,
  asn?: number,
  asnOrg?: string,
  reverseDns?: string,
  geoCountry?: string,
  userClaimedCountry?: string
): IpReputationSignal {
  const indicators: string[] = [];
  let riskScore = 0;
  let ipType: IpType = "isp";
  let confidence = 50;

  // Datacenter ASN detection (partial list)
  const datacenterAsns = [
    14061, // DigitalOcean
    16276, // OVH
    24940, // Hetzner
    63949, // Linode
    20473, // Vultr
    14618, // Amazon AWS
    15169, // Google Cloud
    8075,  // Microsoft Azure
    13335, // Cloudflare
  ];

  if (asn && datacenterAsns.includes(asn)) {
    indicators.push(`Datacenter ASN detected: ${asn}`);
    ipType = "datacenter";
    riskScore += 30;
    confidence = 85;
  }

  // Org name analysis
  if (asnOrg) {
    const lowerOrg = asnOrg.toLowerCase();
    if (/hosting|server|cloud|datacenter|vps|dedicated/i.test(lowerOrg)) {
      indicators.push(`Hosting-related organization: ${asnOrg}`);
      if (ipType === "isp") ipType = "hosting";
      riskScore += 20;
      confidence = Math.max(confidence, 70);
    }
    if (/vpn|private.internet|nord|express|mullvad|proton/i.test(lowerOrg)) {
      indicators.push(`Known VPN provider: ${asnOrg}`);
      ipType = "vpn-exit";
      riskScore += 40;
      confidence = 90;
    }
  }

  // Reverse DNS analysis
  if (reverseDns) {
    if (/tor|exit|relay/i.test(reverseDns)) {
      indicators.push(`Tor-related reverse DNS: ${reverseDns}`);
      ipType = "tor-exit";
      riskScore += 50;
      confidence = 95;
    }
    if (/vpn|proxy|server|cloud|host/i.test(reverseDns)) {
      indicators.push(`VPN/proxy-related reverse DNS: ${reverseDns}`);
      if (ipType === "isp") ipType = "datacenter";
      riskScore += 15;
    }
  }

  // Geo mismatch detection
  const geoMismatch = !!(geoCountry && userClaimedCountry && 
    geoCountry.toLowerCase() !== userClaimedCountry.toLowerCase());
  
  if (geoMismatch) {
    indicators.push(`Geo mismatch: IP in ${geoCountry}, user claims ${userClaimedCountry}`);
    riskScore += 25;
  }

  // Cap risk score
  riskScore = Math.min(riskScore, 100);

  return {
    ipType,
    confidence,
    indicators,
    riskScore,
    geoMismatch,
    datacenterAsn: asn ? datacenterAsns.includes(asn) : false,
    knownVpnExit: ipType === "vpn-exit",
    torExit: ipType === "tor-exit",
    proxyDetected: ["proxy", "datacenter", "hosting"].includes(ipType),
    residentialProxy: false, // Requires external service to detect
  };
}

// ─── Operational Configuration Builder ───────────────────────────────────────

/**
 * Build operational configuration for VPN-compatible HTTP clients.
 */
export function buildOperationalConfig(options: {
  vpnProvider?: VpnProvider;
  proxyUrl?: string;
  useDoh?: boolean;
  dohProvider?: string;
  forceIpv4?: boolean;
  highLatencyMode?: boolean;
}): OperationalConfig {
  const {
    proxyUrl,
    useDoh = true,
    dohProvider = "https://cloudflare-dns.com/dns-query",
    forceIpv4 = true,
    highLatencyMode = false,
  } = options;

  // Parse proxy URL if provided
  const proxySettings: OperationalConfig["proxySettings"] = proxyUrl
    ? proxyUrl.startsWith("socks")
      ? {
          socksProxy: proxyUrl,
          noProxy: ["localhost", "127.0.0.1", "::1", "*.local"],
        }
      : {
          httpProxy: proxyUrl,
          httpsProxy: proxyUrl,
          noProxy: ["localhost", "127.0.0.1", "::1", "*.local"],
        }
    : {
        noProxy: ["localhost", "127.0.0.1", "::1", "*.local"],
      };

  // Timeout settings adjusted for VPN latency
  const timeoutSettings: OperationalConfig["timeoutSettings"] = highLatencyMode
    ? {
        connectTimeout: 30000,
        readTimeout: 60000,
        writeTimeout: 30000,
        idleTimeout: 120000,
        retryAttempts: 5,
        retryDelay: 2000,
      }
    : {
        connectTimeout: 10000,
        readTimeout: 30000,
        writeTimeout: 15000,
        idleTimeout: 60000,
        retryAttempts: 3,
        retryDelay: 1000,
      };

  return {
    proxySettings,
    dnsSettings: {
      useDoh,
      dohProvider: useDoh ? dohProvider : undefined,
      fallbackDns: ["1.1.1.1", "8.8.8.8"],
      dnsCacheEnabled: true,
    },
    timeoutSettings,
    networkSettings: {
      forceIpv4,
      keepAliveInterval: highLatencyMode ? 60000 : 30000,
    },
  };
}

// ─── VPN Configuration Analyzer ──────────────────────────────────────────────

export function analyzeVpnConfig(config: {
  protocol?: VpnProtocol;
  cipher?: string;
  auth?: string;
  tlsVersion?: string;
  keyExchange?: string;
  allowedCiphers?: readonly string[];
  killSwitch?: boolean;
  dnsLeakProtection?: boolean;
  ipv6Enabled?: boolean;
  splitTunnel?: boolean;
  loggingEnabled?: boolean;
}): VpnConfigWeakness[] {
  const weaknesses: VpnConfigWeakness[] = [];

  // Protocol check
  if (config.protocol === "pptp") {
    weaknesses.push({
      configKey: "protocol",
      severity: "critical",
      issue: "PPTP protocol is fundamentally broken and can be decrypted in real-time",
      recommendation: "Migrate to WireGuard, OpenVPN, or IKEv2",
      cwe: "CWE-327",
    });
  } else if (config.protocol === "l2tp") {
    weaknesses.push({
      configKey: "protocol",
      severity: "medium",
      issue: "L2TP has suspected NSA weaknesses (per leaked documents)",
      recommendation: "Consider WireGuard or OpenVPN instead",
      cwe: "CWE-327",
    });
  }

  // Cipher check
  const weakCiphers = ["BF-CBC", "DES", "3DES", "RC4", "AES-128-CBC", "AES-256-CBC"];
  if (config.cipher && weakCiphers.some((c) => config.cipher!.toUpperCase().includes(c))) {
    weaknesses.push({
      configKey: "cipher",
      severity: "high",
      issue: `Weak or deprecated cipher: ${config.cipher}`,
      recommendation: "Use AES-256-GCM or ChaCha20-Poly1305",
      cwe: "CWE-327",
    });
  }

  // TLS version check
  if (config.tlsVersion && parseFloat(config.tlsVersion) < 1.2) {
    weaknesses.push({
      configKey: "tlsVersion",
      severity: "high",
      issue: `TLS ${config.tlsVersion} is deprecated and vulnerable`,
      recommendation: "Enforce TLS 1.2 or higher",
      cwe: "CWE-326",
    });
  }

  // Key exchange check
  if (config.keyExchange) {
    const ke = config.keyExchange.toLowerCase();
    if (ke.includes("dh") && !ke.includes("ecdh")) {
      weaknesses.push({
        configKey: "keyExchange",
        severity: "medium",
        issue: "Static DH groups are less secure than ECDH",
        recommendation: "Use ECDHE with secp384r1 or x25519",
        cwe: "CWE-326",
      });
    }
  }

  // Kill switch check
  if (config.killSwitch === false) {
    weaknesses.push({
      configKey: "killSwitch",
      severity: "high",
      issue: "Kill switch disabled - traffic will leak if VPN drops",
      recommendation: "Enable kill switch in VPN client and OS firewall",
      cwe: "CWE-636",
    });
  }

  // DNS leak protection check
  if (config.dnsLeakProtection === false) {
    weaknesses.push({
      configKey: "dnsLeakProtection",
      severity: "high",
      issue: "DNS leak protection disabled",
      recommendation: "Enable DNS leak protection and use VPN provider's DNS",
      cwe: "CWE-200",
    });
  }

  // IPv6 check
  if (config.ipv6Enabled === true) {
    weaknesses.push({
      configKey: "ipv6Enabled",
      severity: "medium",
      issue: "IPv6 enabled - potential leak vector if VPN doesn't tunnel IPv6",
      recommendation: "Disable IPv6 at OS level or ensure VPN handles IPv6",
      cwe: "CWE-200",
    });
  }

  // Split tunnel check
  if (config.splitTunnel === true) {
    weaknesses.push({
      configKey: "splitTunnel",
      severity: "low",
      issue: "Split tunneling enabled - some traffic may bypass VPN",
      recommendation: "Audit split tunnel rules to ensure sensitive apps use VPN",
      cwe: "CWE-16",
    });
  }

  // Logging check
  if (config.loggingEnabled === true) {
    weaknesses.push({
      configKey: "loggingEnabled",
      severity: "info",
      issue: "VPN client logging enabled",
      recommendation: "Disable verbose logging in production for privacy",
      cwe: "CWE-532",
    });
  }

  return weaknesses;
}

// ─── Helper Functions ────────────────────────────────────────────────────────

export function getVpnProtocol(protocol: VpnProtocol): VpnProtocolAnalysis {
  return VPN_PROTOCOL_ANALYSIS[protocol];
}

export function getSecureProtocols(): VpnProtocolAnalysis[] {
  return Object.values(VPN_PROTOCOL_ANALYSIS).filter((p) => p.securityRating >= 4);
}

export function getVpnLeak(id: string): VpnLeakPattern | undefined {
  return VPN_LEAK_PATTERNS.find((l) => l.id === id);
}

export function getVpnLeaksByType(type: VpnLeakType): VpnLeakPattern[] {
  return VPN_LEAK_PATTERNS.filter((l) => l.type === type);
}

export function getVpnLeaksBySeverity(severity: VpnSeverity): VpnLeakPattern[] {
  return VPN_LEAK_PATTERNS.filter((l) => l.severity === severity);
}

export function getAutomatableVpnLeakTests(): VpnLeakPattern[] {
  return VPN_LEAK_PATTERNS.filter((l) => l.automatable);
}

export function getVpnDefense(id: string): VpnDefensePlaybook | undefined {
  return VPN_DEFENSE_PLAYBOOKS.find((d) => d.id === id);
}

export function getVpnDefensesByCategory(category: VpnDefenseCategory): VpnDefensePlaybook[] {
  return VPN_DEFENSE_PLAYBOOKS.filter((d) => d.category === category);
}

export function getVpnDefensesForLeak(leakType: VpnLeakType): VpnDefensePlaybook[] {
  return VPN_DEFENSE_PLAYBOOKS.filter((d) => d.mitigatesLeaks.includes(leakType));
}

export function getVpnProvider(provider: VpnProvider): VpnProviderProfile | undefined {
  return VPN_PROVIDER_PROFILES.find((p) => p.provider === provider);
}

export function getVpnProvidersWithApi(): VpnProviderProfile[] {
  return VPN_PROVIDER_PROFILES.filter((p) => p.apiAvailable);
}

export function getVpnProvidersByProtocol(protocol: VpnProtocol): VpnProviderProfile[] {
  return VPN_PROVIDER_PROFILES.filter((p) => p.protocols.includes(protocol));
}

export function getNoLogVpnProviders(): VpnProviderProfile[] {
  return VPN_PROVIDER_PROFILES.filter((p) => p.loggingPolicy === "no-logs");
}

export function getAllVpnTestCases(): { defense: string; testCase: VpnDefensePlaybook["testCases"][number] }[] {
  const tests: { defense: string; testCase: VpnDefensePlaybook["testCases"][number] }[] = [];
  for (const defense of VPN_DEFENSE_PLAYBOOKS) {
    for (const tc of defense.testCases) {
      tests.push({ defense: defense.name, testCase: tc });
    }
  }
  return tests;
}

export function getAutomatableVpnTests(): { defense: string; testCase: VpnDefensePlaybook["testCases"][number] }[] {
  return getAllVpnTestCases().filter((t) => t.testCase.automatable);
}

/**
 * Score VPN posture based on configuration and deployment.
 */
export function scoreVpnPosture(config: {
  protocol: VpnProtocol;
  weaknesses: readonly VpnConfigWeakness[];
  leakTestResults: readonly { leak: VpnLeakType; detected: boolean }[];
  killSwitchVerified: boolean;
  mfaEnabled: boolean;
  keyRotationDays?: number;
}): { score: number; grade: string; findings: string[] } {
  let score = 100;
  const findings: string[] = [];

  // Protocol score (0-20 points)
  const protocolInfo = VPN_PROTOCOL_ANALYSIS[config.protocol];
  const protocolScore = (protocolInfo.securityRating / 5) * 20;
  score -= 20 - protocolScore;
  if (protocolInfo.securityRating < 3) {
    findings.push(`Weak protocol: ${config.protocol} (rating ${protocolInfo.securityRating}/5)`);
  }

  // Weakness deductions
  for (const weakness of config.weaknesses) {
    switch (weakness.severity) {
      case "critical":
        score -= 25;
        findings.push(`Critical: ${weakness.issue}`);
        break;
      case "high":
        score -= 15;
        findings.push(`High: ${weakness.issue}`);
        break;
      case "medium":
        score -= 8;
        findings.push(`Medium: ${weakness.issue}`);
        break;
      case "low":
        score -= 3;
        findings.push(`Low: ${weakness.issue}`);
        break;
    }
  }

  // Leak test results
  for (const leak of config.leakTestResults) {
    if (leak.detected) {
      score -= 15;
      findings.push(`Leak detected: ${leak.leak}`);
    }
  }

  // Kill switch
  if (!config.killSwitchVerified) {
    score -= 10;
    findings.push("Kill switch not verified");
  }

  // MFA
  if (!config.mfaEnabled) {
    score -= 5;
    findings.push("MFA not enabled");
  }

  // Key rotation
  if (config.keyRotationDays && config.keyRotationDays > 90) {
    score -= 5;
    findings.push(`Key rotation overdue: ${config.keyRotationDays} days`);
  }

  // Normalize score
  score = Math.max(0, Math.min(100, score));

  // Grade
  let grade: string;
  if (score >= 90) grade = "A";
  else if (score >= 80) grade = "B";
  else if (score >= 70) grade = "C";
  else if (score >= 60) grade = "D";
  else grade = "F";

  return { score, grade, findings };
}
