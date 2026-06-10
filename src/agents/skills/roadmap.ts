/**
 * Dynamic Ethical Security Skills Roadmap
 *
 * Derived from the attachment's progression model:
 * Basics -> Operating Systems -> Networking -> Programming -> Tools -> Lab -> Practice
 *
 * This module keeps NATT and DevBot skill scaffolding data-driven so new tracks can
 * be added without hard-coding command logic.
 */

export type RoadmapStageId =
  | "understand-basics"
  | "operating-systems"
  | "networking"
  | "programming"
  | "tools"
  | "set-up-lab"
  | "start-practicing";

export type SkillDifficulty = "beginner" | "intermediate" | "advanced";

export interface DynamicSkill {
  id: string;
  name: string;
  stageId: RoadmapStageId;
  difficulty: SkillDifficulty;
  description: string;
  outcomes: string[];
  relatedTools: string[];
  resources: string[];
}

export interface DynamicTool {
  id: string;
  name: string;
  category: "recon" | "web" | "analysis" | "password" | "traffic" | "platform";
  stageId: RoadmapStageId;
  purpose: string;
  safeUsage: string[];
  commandExamples: string[];
}

export interface DynamicResource {
  id: string;
  title: string;
  type: "guide" | "lab" | "checklist" | "playbook";
  stageId: RoadmapStageId;
  summary: string;
  url?: string;
  internalPath?: string;
}

export interface RoadmapStage {
  id: RoadmapStageId;
  title: string;
  goals: string[];
  prerequisites: RoadmapStageId[];
}

export interface DynamicRoadmapRegistry {
  version: string;
  generatedAt: string;
  stages: RoadmapStage[];
  skills: DynamicSkill[];
  tools: DynamicTool[];
  resources: DynamicResource[];
}

const STAGES: RoadmapStage[] = [
  {
    id: "understand-basics",
    title: "Understand Basics",
    goals: ["TCP/IP and DNS foundations", "HTTP/HTTPS request model"],
    prerequisites: [],
  },
  {
    id: "operating-systems",
    title: "Operating Systems",
    goals: ["Linux fundamentals", "Windows internals", "macOS security posture"],
    prerequisites: ["understand-basics"],
  },
  {
    id: "networking",
    title: "Networking",
    goals: ["IP/MAC/DNS/DHCP mapping", "Ports and protocol triage", "OSI-layer troubleshooting"],
    prerequisites: ["understand-basics", "operating-systems"],
  },
  {
    id: "programming",
    title: "Programming",
    goals: ["Python and Bash automation", "JavaScript/PHP/SQL attack-surface literacy"],
    prerequisites: ["understand-basics", "operating-systems", "networking"],
  },
  {
    id: "tools",
    title: "Tools",
    goals: ["Nmap and Burp workflows", "Metasploit and credential tooling", "Traffic analysis with Wireshark"],
    prerequisites: ["networking", "programming"],
  },
  {
    id: "set-up-lab",
    title: "Set Up Lab",
    goals: ["Virtualized isolated environment", "Kali/Parrot operator baseline"],
    prerequisites: ["tools"],
  },
  {
    id: "start-practicing",
    title: "Start Practicing",
    goals: ["Guided challenge progression", "Evidence-first reporting discipline"],
    prerequisites: ["set-up-lab"],
  },
];

const SKILLS: DynamicSkill[] = [
  {
    id: "skill-http-baseline",
    name: "HTTP Surface Mapping",
    stageId: "understand-basics",
    difficulty: "beginner",
    description: "Map routes, methods, auth points, and header posture for a target.",
    outcomes: [
      "Enumerate exposed endpoints and methods",
      "Classify sensitive headers and misconfigurations",
      "Produce reproducible baseline notes",
    ],
    relatedTools: ["tool-burp-suite", "tool-nmap"],
    resources: ["resource-web-baseline-checklist"],
  },
  {
    id: "skill-os-hardening-gap",
    name: "OS Hardening Gap Review",
    stageId: "operating-systems",
    difficulty: "intermediate",
    description: "Assess host controls and identify gaps across Linux/Windows/macOS patterns.",
    outcomes: [
      "Pinpoint missing baseline controls",
      "Map risky services and startup vectors",
      "Prioritize remediation with owner actions",
    ],
    relatedTools: ["tool-nmap", "tool-wireshark"],
    resources: ["resource-host-hardening-playbook"],
  },
  {
    id: "skill-network-triage",
    name: "Network Exposure Triage",
    stageId: "networking",
    difficulty: "intermediate",
    description: "Discover open services and map protocol risk to business impact.",
    outcomes: [
      "Service inventory with risk tags",
      "Protocol-level exploitability notes",
      "Attack path shortlisting",
    ],
    relatedTools: ["tool-nmap", "tool-wireshark"],
    resources: ["resource-network-attack-path"],
  },
  {
    id: "skill-security-automation",
    name: "Security Automation Scripting",
    stageId: "programming",
    difficulty: "advanced",
    description: "Build safe repeatable scripts for recon and evidence capture.",
    outcomes: [
      "Automate recon and result normalization",
      "Implement ROE-aware scan guards",
      "Standardize report payload generation",
    ],
    relatedTools: ["tool-burp-suite", "tool-nmap"],
    resources: ["resource-automation-playbook"],
  },
  {
    id: "skill-web-proxy-analysis",
    name: "Proxy-Based Web Testing",
    stageId: "tools",
    difficulty: "advanced",
    description: "Use proxy interception to trace auth, sessions, and input handling safely.",
    outcomes: [
      "Detect broken auth/session flow",
      "Identify weak validation and attack vectors",
      "Document exploitability with clean PoC steps",
    ],
    relatedTools: ["tool-burp-suite", "tool-john-the-ripper"],
    resources: ["resource-web-proxy-guide"],
  },
  {
    id: "skill-lab-orchestration",
    name: "Lab Orchestration",
    stageId: "set-up-lab",
    difficulty: "beginner",
    description: "Set up isolated test ranges and repeatable target scenarios.",
    outcomes: [
      "Safe virtualized target matrix",
      "Snapshot-based rollback workflow",
      "Shared operator runbooks",
    ],
    relatedTools: ["tool-virtualbox", "tool-kali-linux"],
    resources: ["resource-lab-setup-guide"],
  },
  {
    id: "skill-practice-track",
    name: "Structured Practice Track",
    stageId: "start-practicing",
    difficulty: "intermediate",
    description: "Run controlled challenges and improve report quality over iterations.",
    outcomes: [
      "Challenge completion trends",
      "Improved evidence quality",
      "Reusable issue templates and summaries",
    ],
    relatedTools: ["tool-hack-the-box", "tool-tryhackme"],
    resources: ["resource-practice-tracker"],
  },
];

const TOOLS: DynamicTool[] = [
  {
    id: "tool-nmap",
    name: "Nmap",
    category: "recon",
    stageId: "tools",
    purpose: "Port/service discovery and baseline network enumeration.",
    safeUsage: ["Use scoped targets only", "Avoid aggressive timing in production", "Record scan windows"],
    commandExamples: ["nmap -sV -T3 <target>", "nmap -p 80,443,8080 <target>"],
  },
  {
    id: "tool-burp-suite",
    name: "Burp Suite",
    category: "web",
    stageId: "tools",
    purpose: "HTTP interception, replay, and app attack-surface validation.",
    safeUsage: ["Use approved proxy scope", "Mask sensitive records in exports", "Disable intrusive scans unless authorized"],
    commandExamples: ["Proxy + Repeater workflow", "Target scope + passive scan"],
  },
  {
    id: "tool-metasploit",
    name: "Metasploit",
    category: "analysis",
    stageId: "tools",
    purpose: "Exploit validation in controlled labs and approved engagements.",
    safeUsage: ["Lab first", "ROE approval required", "No destructive modules by default"],
    commandExamples: ["msfconsole", "search <module>; use <module>"],
  },
  {
    id: "tool-john-the-ripper",
    name: "John the Ripper",
    category: "password",
    stageId: "tools",
    purpose: "Password policy testing and hash-strength validation.",
    safeUsage: ["Use sanitized test hashes", "Never run against unauthorized credentials"],
    commandExamples: ["john --format=bcrypt hashes.txt"],
  },
  {
    id: "tool-wireshark",
    name: "Wireshark",
    category: "traffic",
    stageId: "tools",
    purpose: "Packet-level diagnostics and protocol anomaly detection.",
    safeUsage: ["Capture only in scope", "Protect PII in traces", "Store encrypted capture artifacts"],
    commandExamples: ["Capture filter: host <target>", "Display filter: http || tls"],
  },
  {
    id: "tool-virtualbox",
    name: "VirtualBox/VMware",
    category: "platform",
    stageId: "set-up-lab",
    purpose: "Isolated virtual lab environment.",
    safeUsage: ["No bridged exposure unless required", "Snapshot before intrusive tests"],
    commandExamples: ["Create host-only network", "Snapshot/rollback workflow"],
  },
  {
    id: "tool-kali-linux",
    name: "Kali Linux / Parrot OS",
    category: "platform",
    stageId: "set-up-lab",
    purpose: "Security tooling runtime for controlled operations.",
    safeUsage: ["Harden default profile", "Keep tools patched", "Use non-root operator account"],
    commandExamples: ["apt update && apt upgrade", "tooling profile bootstrap"],
  },
  {
    id: "tool-tryhackme",
    name: "TryHackMe",
    category: "platform",
    stageId: "start-practicing",
    purpose: "Guided challenge training for ethical security skills.",
    safeUsage: ["Use legal challenge environments only"],
    commandExamples: ["Path progression by stage"],
  },
  {
    id: "tool-hack-the-box",
    name: "Hack The Box",
    category: "platform",
    stageId: "start-practicing",
    purpose: "Applied security challenge labs.",
    safeUsage: ["Only challenge targets in platform scope"],
    commandExamples: ["Retired box practice cycle"],
  },
];

const RESOURCES: DynamicResource[] = [
  {
    id: "resource-web-baseline-checklist",
    title: "Web Baseline Checklist",
    type: "checklist",
    stageId: "understand-basics",
    summary: "Checklist for HTTP posture, headers, and auth boundary mapping.",
    internalPath: "src/agents/skills/roadmap.ts",
  },
  {
    id: "resource-host-hardening-playbook",
    title: "Host Hardening Gap Playbook",
    type: "playbook",
    stageId: "operating-systems",
    summary: "Linux/Windows/macOS hardening control matrix.",
    internalPath: "src/agents/skills/roadmap.ts",
  },
  {
    id: "resource-network-attack-path",
    title: "Network Attack Path Worksheet",
    type: "guide",
    stageId: "networking",
    summary: "Template for mapping protocol exposure to impact.",
    internalPath: "src/agents/skills/roadmap.ts",
  },
  {
    id: "resource-automation-playbook",
    title: "Security Automation Playbook",
    type: "playbook",
    stageId: "programming",
    summary: "Script design standards for ROE-aware security automation.",
    internalPath: "src/agents/skills/roadmap.ts",
  },
  {
    id: "resource-web-proxy-guide",
    title: "Proxy Testing Guide",
    type: "guide",
    stageId: "tools",
    summary: "Burp/NATT coordinated workflow for session and input analysis.",
    internalPath: "src/agents/skills/roadmap.ts",
  },
  {
    id: "resource-lab-setup-guide",
    title: "Lab Setup Guide",
    type: "guide",
    stageId: "set-up-lab",
    summary: "Virtualized lab and snapshot operations baseline.",
    internalPath: "src/agents/skills/roadmap.ts",
  },
  {
    id: "resource-practice-tracker",
    title: "Practice Progress Tracker",
    type: "lab",
    stageId: "start-practicing",
    summary: "Track challenge outcomes and remediation quality over time.",
    internalPath: "src/agents/skills/roadmap.ts",
  },
];

export function createDynamicRoadmapRegistry(now: Date = new Date()): DynamicRoadmapRegistry {
  return {
    version: "1.0.0",
    generatedAt: now.toISOString(),
    stages: STAGES,
    skills: SKILLS,
    tools: TOOLS,
    resources: RESOURCES,
  };
}

export function listStageSkills(stageId: RoadmapStageId): DynamicSkill[] {
  return SKILLS.filter((skill) => skill.stageId === stageId);
}

export function listStageTools(stageId: RoadmapStageId): DynamicTool[] {
  return TOOLS.filter((tool) => tool.stageId === stageId);
}

export function listStageResources(stageId: RoadmapStageId): DynamicResource[] {
  return RESOURCES.filter((resource) => resource.stageId === stageId);
}

export function getNextStages(stageId: RoadmapStageId): RoadmapStage[] {
  return STAGES.filter((stage) => stage.prerequisites.includes(stageId));
}

export function getRoadmapStage(stageId: RoadmapStageId): RoadmapStage | undefined {
  return STAGES.find((stage) => stage.id === stageId);
}
