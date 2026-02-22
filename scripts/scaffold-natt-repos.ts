/**
 * scaffold-natt-repos.ts — NATT GitHub Repository Scaffolding Script
 *
 * Creates and initializes GitHub repositories for the NATT ecosystem:
 *  • natt-roe         — Rules of Engagement templates and validator
 *  • natt-vault       — Mission reconsolidation vault
 *  • natt-mcp-knowledge — MCP knowledge server for NATT
 *  • natt-skills      — Password and auth bypass research skills
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_... npx tsx scripts/scaffold-natt-repos.ts
 *
 * Options:
 *   --org <orgname>   Create under organization (default: authenticated user)
 *   --private         Create as private repos (default: private)
 *   --public          Create as public repos
 *   --dry-run         Print what would be created without doing it
 */

import { Octokit } from "@octokit/rest";
import fs from "fs/promises";
import path from "path";

// ─────────────────────────────────────────────────────────────────────────────
//  Config
// ─────────────────────────────────────────────────────────────────────────────

interface RepoSpec {
  name: string;
  description: string;
  topics: string[];
  readme: string;
  files: Array<{ path: string; content: string }>;
  private: boolean;
}

const BASE_TOPICS = ["natt", "ethical-hacking", "security", "pentest", "devbot"];

const REPOS: RepoSpec[] = [
  {
    name: "natt-roe",
    description: "NATT Rules of Engagement engine — validates authorization before every security mission",
    topics: [...BASE_TOPICS, "rules-of-engagement", "authorization", "compliance"],
    private: true,
    readme: `# natt-roe

**N**etwork **A**ttack & **T**esting **T**oolkit — Rules of Engagement Engine

> Part of the [NATT Ghost Agent](https://github.com/TolaniLabs/NATT) ecosystem.

## Overview

Every NATT mission is gated by a Rules of Engagement (ROE) document. 
This package provides:

- Pre-mission ROE validation (target scope, time windows, operator auth)
- Signed engagement document storage
- Phase-level ROE gates during mission execution
- Audit logging of all ROE events

## Installation

\`\`\`bash
npm install @natt/roe
# or
pnpm add @natt/roe
\`\`\`

## Quick Start

\`\`\`typescript
import { createROEEngagement, validateROE } from "@natt/roe";

// Create engagement
const engagement = await createROEEngagement({
  name: "My Web App Assessment",
  scope: { inScope: ["example.com", "*.example.com"], outOfScope: [], includeSubdomains: true },
  client: { name: "Example Corp", contactEmail: "security@example.com", authorizingOfficer: "Jane Smith" },
  operator: { id: "op-001", name: "NATT Ghost", organization: "SecFirm LLC", credential: "OSCP-12345" },
});

// Validate before mission
const result = await validateROE(
  engagement.id,
  "https://example.com",
  "web-app",
  "stealth",
  engagement.missionPassphrase,
  "op-001"
);

if (!result.approved) throw new Error("Mission blocked: " + result.violations[0]?.message);
\`\`\`

## Security Notice

This tool is for **authorized professional security assessment only**. 
All use is subject to applicable law. Unauthorized use is prohibited.

## License

MIT
`,
    files: [
      {
        path: ".gitignore",
        content: "node_modules/\ndist/\n.env\n.natt/\n*.local\n",
      },
      {
        path: "tsconfig.json",
        content: JSON.stringify({
          compilerOptions: {
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            outDir: "dist",
            strict: true,
            declaration: true,
            declarationMap: true,
            sourceMap: true,
            esModuleInterop: true,
          },
          include: ["src/**/*"],
          exclude: ["node_modules", "dist"],
        }, null, 2),
      },
    ],
  },
  {
    name: "natt-vault",
    description: "NATT mission reconsolidation vault — stores, indexes, and exports all mission artifacts",
    topics: [...BASE_TOPICS, "vault", "mission-artifacts", "forensics", "reporting"],
    private: true,
    readme: `# natt-vault

**N**etwork **A**ttack & **T**esting **T**oolkit — Mission Reconsolidation Vault

> Part of the [NATT Ghost Agent](https://github.com/TolaniLabs/NATT) ecosystem.

## Overview

The NATT Vault stores all mission context with full chain-of-custody:

- **Mission archive**: JSON, Markdown, HTML reports per mission
- **Evidence collection**: Finding evidence files with integrity hashes
- **Reconsolidation packages**: Single-directory bundle of all artifacts per mission
- **Chain of custody**: Audit trail for all vault operations
- **Vault index**: Searchable index of all past missions

## Vault Structure

\`\`\`
.natt/
  vault/
    index.json               ← master mission index
    <missionId>/
      mission.json           ← complete mission data
      report.md              ← human-readable report
      report.html            ← interactive HTML report
      recon-raw.json         ← raw reconnaissance data
      findings-evidence.json ← all finding evidence
      chain-of-custody.json  ← evidence handling record
      roe-brief.txt          ← operator ROE brief
      PACKAGE.json           ← export manifest
\`\`\`

## License

MIT
`,
    files: [
      { path: ".gitignore", content: "node_modules/\ndist/\n.env\n.natt/\n*.local\n" },
    ],
  },
  {
    name: "natt-mcp-knowledge",
    description: "NATT MCP Knowledge Server — Model Context Protocol server exposing NATT security knowledge base",
    topics: [...BASE_TOPICS, "mcp", "model-context-protocol", "security-knowledge", "roe"],
    private: true,
    readme: `# natt-mcp-knowledge

**N**etwork **A**ttack & **T**esting **T**oolkit — MCP Knowledge Server

> Part of the [NATT Ghost Agent](https://github.com/TolaniLabs/NATT) ecosystem.

## Overview

An MCP (Model Context Protocol) server that exposes NATT security knowledge to AI models:

### Tools

| Tool | Description |
|------|-------------|
| \`validate_roe\` | Validate a mission against ROE parameters |
| \`get_roe_template\` | Get ROE template for a mission type |
| \`get_mission_guidance\` | Get step-by-step mission guidance and hard limits |
| \`identify_hash\` | Identify a password hash type and crackability |
| \`get_password_attacks\` | Get password attack techniques for given context |
| \`get_auth_bypass_techniques\` | Get auth bypass vectors for a given category |
| \`get_secret_patterns\` | Get secret detection patterns for a provider |
| \`query_vault\` | Search past mission results in the vault |

## Setup (MCP client config)

\`\`\`json
{
  "mcpServers": {
    "natt-knowledge": {
      "command": "node",
      "args": ["path/to/natt-mcp-knowledge/dist/index.js"]
    }
  }
}
\`\`\`

## License

MIT
`,
    files: [
      { path: ".gitignore", content: "node_modules/\ndist/\n.env\n.natt/\n" },
    ],
  },
  {
    name: "natt-skills",
    description: "NATT security research skills — hash analysis, secrets detection, auth bypass research",
    topics: [...BASE_TOPICS, "password-analysis", "secrets-detection", "jwt", "oauth", "research"],
    private: true,
    readme: `# natt-skills

**N**etwork **A**ttack & **T**esting **T**oolkit — Advanced Research Skills

> Part of the [NATT Ghost Agent](https://github.com/TolaniLabs/NATT) ecosystem.

## ⚠️ Authorized Use Only

This library is for **authorized professional security research only**. It provides:

- Analysis and identification tools
- Educational knowledge bases
- Research guidance

It does **NOT** provide automated attack tooling.

## Skills

### Password Analysis
- \`identifyHash(hash)\` — Identify hash type and crackability
- \`assessPasswordPolicy(signals)\` — Score password policy
- \`checkDefaultCredentials(service)\` — Default cred lookup

### Secrets Detection
- \`scanContentForSecrets(content, filename)\` — Scan for 80+ secret patterns
- \`isLikelySecret(value)\` — Shannon entropy analysis
- \`shannonEntropy(str)\` — Raw entropy calculation

### Auth Bypass Research
- \`analyzeJWT(token)\` — JWT security analysis
- \`getRelevantAuthBypasses(context)\` — Auth bypass vector catalog
- \`analyzeCredentialExposure(url, html, headers)\` — Credential exposure surface analysis
- \`AUTH_BYPASS_VECTORS\` — Full research catalog

## License

MIT
`,
    files: [
      { path: ".gitignore", content: "node_modules/\ndist/\n.env\n.natt/\n" },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  CLI Argument Parsing
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(): { org?: string; isPrivate: boolean; dryRun: boolean } {
  const args = process.argv.slice(2);
  let org: string | undefined;
  let isPublic = false;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--org" && args[i + 1]) {
      org = args[++i];
    } else if (args[i] === "--public") {
      isPublic = true;
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }

  return { org, isPrivate: !isPublic, dryRun };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Scaffold Logic
// ─────────────────────────────────────────────────────────────────────────────

async function createRepo(
  octokit: Octokit,
  spec: RepoSpec,
  owner: string,
  org?: string,
  dryRun: boolean = false
): Promise<void> {
  console.log(`\n📁 ${spec.name}`);
  console.log(`   ${spec.description}`);
  console.log(`   Topics: ${spec.topics.join(", ")}`);
  console.log(`   Visibility: ${spec.private ? "private" : "public"}`);

  if (dryRun) {
    console.log(`   → [DRY RUN] Would create repo and push ${spec.files.length + 1} files`);
    return;
  }

  try {
    // Create repo
    const createParams = {
      name: spec.name,
      description: spec.description,
      private: spec.private,
      auto_init: true,
      has_issues: true,
      has_wiki: false,
    };

    let repoData;
    if (org) {
      const { data } = await octokit.repos.createInOrg({ org, ...createParams });
      repoData = data;
    } else {
      const { data } = await octokit.repos.createForAuthenticatedUser(createParams);
      repoData = data;
    }

    console.log(`   ✅ Created: ${repoData.html_url}`);

    // Add topics (requires separate endpoint)
    try {
      await octokit.repos.replaceAllTopics({
        owner: org ?? owner,
        repo: spec.name,
        names: spec.topics,
      });
      console.log(`   ✅ Topics set`);
    } catch (topicErr) {
      console.warn(`   ⚠️  Could not set topics: ${(topicErr as Error).message}`);
    }

    // Small delay to allow repo initialization
    await new Promise((r) => setTimeout(r, 2000));

    // Get default branch SHA
    let sha: string;
    try {
      const { data: refData } = await octokit.git.getRef({
        owner: org ?? owner,
        repo: spec.name,
        ref: "heads/main",
      });
      sha = refData.object.sha;
    } catch {
      // Try master
      try {
        const { data: refData } = await octokit.git.getRef({
          owner: org ?? owner,
          repo: spec.name,
          ref: "heads/master",
        });
        sha = refData.object.sha;
      } catch {
        console.warn(`   ⚠️  Could not get branch SHA — skipping file creation`);
        return;
      }
    }

    // Create README.md
    await octokit.repos.createOrUpdateFileContents({
      owner: org ?? owner,
      repo: spec.name,
      path: "README.md",
      message: "docs: initial README",
      content: Buffer.from(spec.readme, "utf-8").toString("base64"),
      sha: undefined as unknown as string, // auto_init creates it — we update
    }).catch(async () => {
      // If create fails (file exists from auto_init), get SHA and update
      const { data: fileData } = await octokit.repos.getContent({
        owner: org ?? owner,
        repo: spec.name,
        path: "README.md",
      });
      const fileSha = (fileData as { sha: string }).sha;
      await octokit.repos.createOrUpdateFileContents({
        owner: org ?? owner,
        repo: spec.name,
        path: "README.md",
        message: "docs: update README",
        content: Buffer.from(spec.readme, "utf-8").toString("base64"),
        sha: fileSha,
      });
    });

    console.log(`   ✅ README.md created`);

    // Create additional files
    for (const file of spec.files) {
      await octokit.repos.createOrUpdateFileContents({
        owner: org ?? owner,
        repo: spec.name,
        path: file.path,
        message: `chore: add ${file.path}`,
        content: Buffer.from(file.content, "utf-8").toString("base64"),
      });
      console.log(`   ✅ ${file.path} created`);
      await new Promise((r) => setTimeout(r, 500)); // rate limit buffer
    }
  } catch (err) {
    const error = err as { status?: number; message?: string };
    if (error.status === 422) {
      console.warn(`   ⚠️  Repo already exists: ${spec.name}`);
    } else {
      console.error(`   ❌ Failed: ${error.message}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { org, isPrivate, dryRun } = parseArgs();

  const token = process.env["GITHUB_TOKEN"];
  if (!token && !dryRun) {
    console.error("❌ GITHUB_TOKEN environment variable is required");
    console.error("   Usage: GITHUB_TOKEN=ghp_... npx tsx scripts/scaffold-natt-repos.ts");
    process.exit(1);
  }

  console.log("👻 NATT GitHub Repository Scaffolding");
  console.log("═══════════════════════════════════════════");
  if (dryRun) console.log("🔍 DRY RUN MODE — no changes will be made\n");

  const octokit = new Octokit({ auth: token ?? "dry-run" });

  // Get authenticated user
  let owner = "unknown";
  if (!dryRun) {
    try {
      const { data: user } = await octokit.users.getAuthenticated();
      owner = user.login;
      console.log(`👤 Authenticated as: ${owner}`);
    } catch {
      console.error("❌ Failed to authenticate. Check your GITHUB_TOKEN.");
      process.exit(1);
    }
  }

  if (org) {
    console.log(`🏢 Creating under organization: ${org}`);
  } else {
    console.log(`👤 Creating under user: ${owner}`);
  }

  console.log(`🔒 Visibility: ${isPrivate ? "private" : "public"}`);
  console.log(`📦 Repos to create: ${REPOS.length}\n`);

  for (const spec of REPOS) {
    const specWithVisibility = { ...spec, private: isPrivate };
    await createRepo(octokit, specWithVisibility, owner, org, dryRun);
  }

  console.log("\n\n═══════════════════════════════════════════");
  console.log("✅ NATT GitHub scaffold complete");
  console.log("");
  console.log("Next steps:");
  console.log("  1. Clone each repo and add source code");
  console.log("  2. Set up branch protection rules");
  console.log("  3. Configure GitHub Actions CI/CD");
  console.log("  4. Add CODEOWNERS file");
  console.log("  5. Configure Dependabot security alerts");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
