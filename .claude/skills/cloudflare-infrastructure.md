# Cloudflare Infrastructure — Agent & MCP Reference Index

> **Last updated**: 2026-02-23
> **Token name**: `Cache`
> **Token ID**: `fbda934136dbefb1c306204d2ba4afc9`
> **Account ID**: `d20586cf099d39fcbeb5db4043e20f6f`
> **Account email**: `info@tolanicorp.us`
> **Env var**: `CLOUDFLARE_API_TOKEN` (in `.env`)

---

## 1. API Token Permissions

### 1.1 Zone-Level Permissions (All Zones)

Resource: `com.cloudflare.api.account.zone.*` = `*`

| Permission Group | ID | Access |
|---|---|---|
| Zone Read | `c8fed203ed3043cba015a93ad1616f1f` | Read zone metadata, settings |
| Zone Settings Write | `3030687196b94b638145a3953da2b699` | Modify zone settings (SSL, caching, security level, etc.) |
| Zone DNS Settings Write | `c4df38be41c247b3b4b7702e76eadae0` | DNSSEC, zone transfer settings |
| DNS Read | `82e64a83756745bbbb1c9c2701bf816b` | List/read DNS records |
| DNS Write | `4755a26eedb94da69e1066d98aa820be` | Create/update/delete DNS records |
| Cache Purge | `e17beae8b8cb423a99b1730f21238bed` | Purge cache (by URL, tag, prefix, or everything) |
| SSL and Certificates Write | `c03055bc037c4ea9afb9a9f104b7b721` | SSL mode, client certs, edge certs |
| Page Rules Write | `ed07f6c337da4195b4e72a1fb2c6bcae` | Create/modify page rules |
| Firewall Services Write | `43137f8d07884d3198dc0ee77ca6e79b` | WAF, firewall rules, IP access rules |
| Workers Routes Write | `28f4b596e7d643029c524985477ae49a` | Map Workers to zone routes |
| Analytics Read | `9c88f9c5bce24ce7af9a958ba9c504db` | Zone traffic analytics (GraphQL) |
| Bot Management Write | `3b94c49258ec4573b06d51d99b6416c0` | Bot Fight Mode, Super Bot Fight Mode |
| Web3 Hostnames Write | `5ea6da42edb34811a78d1b007557c0ca` | Web3 gateway hostnames |

### 1.2 Account-Level Permissions

Resource: `com.cloudflare.api.account.d20586cf099d39fcbeb5db4043e20f6f` = `*`

| Permission Group | ID | Category |
|---|---|---|
| Pages Write | `8d28297797f24fb8a0c332fe0866ec89` | Deploy/manage Pages projects |
| Workers Scripts Write | `e086da7e2179491d91ee5f35b3ca210a` | Deploy Workers |
| Workers KV Storage Write | `f7f0eda5697f475c90846e879bab8666` | KV namespace CRUD |
| Workers R2 Storage Write | `bf7481a1826f439697cb59a20b22293e` | R2 bucket CRUD |
| Workers R2 Data Catalog Write | `d229766a2f7f4d299f20eaa8c9b1fde9` | R2 data catalog |
| Workers R2 SQL Read | `f45430d92e2b4a6cb9f94f2594c141b8` | R2 SQL queries |
| D1 Write | `09b2857d1c31407795e75e3fed8617a1` | D1 database CRUD |
| Workers AI Write | `bacc64e0f6c34fc0883a1223f938a104` | Workers AI inference |
| Images Write | `618ec6c64a3a42f8b08bdcb147ded4e4` | Cloudflare Images |
| Logs Write | `96163bd1b0784f62b3e44ed8c2ab1eb6` | Logpush/Logpull |
| MCP Portals Write | `db3d398df73946acb755c05b69edfc30` | MCP portal management |
| Pipelines Write | `e34111af393449539859485aa5ddd5bd` | Cloudflare Pipelines |
| Browser Rendering Write | `adddda876faa4a0590f1b23a038976e4` | Browser Rendering API |
| Mass URL Redirects Write | `abe78e2276664f4db588c1f675a77486` | Bulk redirects |
| Radar Read | `dfe525ec7b07472c827d8d009178b2ac` | Internet traffic intelligence |
| China Network Steering Write | `c6f6338ceae545d0b90daaa1fed855e6` | CNS for China Net |
| Access: Apps Write | `ad7a6f88896d498f98eb30592abfbbf4` | Zero Trust app policies |
| Access: Apps and Policies Write | `1e13c5124ca64b72b1969a67e8829049` | Full Zero Trust |
| Access: SSH Auditing Write | `d30c9ad8b5224e7cb8d41bcb4757effc` | SSH session audit |
| Access: Keys Read | `0974adb35b73411a84ebcc8e91cc29eb` | Access service tokens |
| Access: Organizations, Identity Providers, and Groups Write | `bfe0d8686a584fa680f4c53b5eb0de6d` | IdP config |
| Account WAF Read | `56b2af4817c84ad99187911dc3986c23` | Account-level WAF |
| Connectivity Directory Admin | `77efc2c0724d4c4eb94bfd9656247130` | Network connectivity |
| DDoS Botnet Feed Write | `0caa90c9b186447397c8b00358d34a76` | DDoS intelligence |
| IOT Write | `865ebd55bc6d4b109de6813eccfefd13` | IoT device management |
| Magic Network Monitoring Admin | `8e6ed1ef6e864ad0ae477ceffa5aa5eb` | Network monitoring |
| SCIM Provisioning | `d5812c023a5048b4882175a28952362d` | SCIM user sync |
| Cloudflare DEX | `3a1e1ef09dd34271bb44fc4c6a419952` | Digital Experience Monitoring |

### 1.3 User-Level Permissions

Resource: `com.cloudflare.api.user.3eab7ad78d73dff73ee17f56d0c8120e` = `*`

| Permission Group | ID |
|---|---|
| API Tokens Write | `686d18d5ac6c441c867cbf6771e58a0a` |
| Memberships Write | `9201bc6f42d440968aaab0c6f17ebb1d` |
| User Details Write | `55a5e17cc99e4a3fa1f3432d262f2e55` |

---

## 2. Zones & DNS Inventory

### 2.1 bettorsace.win
- **Zone ID**: `cd457b1c596f0655b5b3a6010597b93f`
- **Plan**: Free
- **SSL**: Full
- **Security Level**: Under Attack
- **Pages Project**: `bettorsace` → `bettorsace.pages.dev`
- **Custom Domains**: `bettorsace.win`, `www.bettorsace.win`
- **Repo**: Direct upload (no Git integration on CF)
- **Email**: Cloudflare Email Routing (MX → route{1,2,3}.mx.cloudflare.net)
- **DNS Records**:
  | Type | Name | Content | Proxied |
  |------|------|---------|---------|
  | CNAME | `bettorsace.win` | `bettorsace.pages.dev` | Yes |
  | CNAME | `www.bettorsace.win` | `bettorsace.win` | Yes |
  | MX | `bettorsace.win` | `route{1,2,3}.mx.cloudflare.net` | — |
  | TXT | `bettorsace.win` | SPF: `include:_spf.mx.cloudflare.net` | — |
  | TXT | `cf2024-1._domainkey` | DKIM RSA key | — |

### 2.2 freakme.fun
- **Zone ID**: `2fd87bb2af3024f95c3734231b731357`
- **Plan**: Free
- **SSL**: Full
- **Security Level**: Medium
- **Pages Projects**:
  - `freakme` → `freakme.pages.dev` (apex domain `freakme.fun`)
  - `freakme-fun` → `freakme-fun.pages.dev` (www subdomain)
- **Repo**: `Tolani-Corp/freakme.fun` (Git-connected on `freakme-fun`)
- **Email**: Cloudflare Email Routing + Mailer Send SPF
- **DNS Records**:
  | Type | Name | Content |
  |------|------|---------|
  | CNAME | `freakme.fun` | `freakme.pages.dev` |
  | CNAME | `www.freakme.fun` | `freakme-fun.pages.dev` |
  | MX | `freakme.fun` | `route{1,2,3}.mx.cloudflare.net` |
  | TXT | `freakme.fun` | SPF: `include:spf.mailersend.net` |
  | TXT | `_dmarc.freakme.fun` | DMARC: `p=none` |
  | TXT | `cf2024-1._domainkey` | DKIM RSA key |
  | TXT | `twilio-domain-verification` | Twilio verify |

### 2.3 mangomodels.io
- **Zone ID**: `b8082376e23dd2373810bfdcb4996d3c`
- **Plan**: Free
- **SSL**: Full
- **Security Level**: Medium
- **Hosting**: Vercel (A → `76.76.21.21`, www CNAME → Vercel DNS)
- **Email**: Titan Email (`mx1.titan.email`, `mx2.titan.email`)
- **Transactional Email**: Amazon SES via `send.mangomodels.io`
- **DNS Records**:
  | Type | Name | Content |
  |------|------|---------|
  | A | `mangomodels.io` | `76.76.21.21` (Vercel) |
  | CNAME | `www.mangomodels.io` | Vercel DNS |
  | MX | `mangomodels.io` | `mx{1,2}.titan.email` |
  | MX | `send.mangomodels.io` | `feedback-smtp.us-east-1.amazonses.com` |
  | TXT | `mangomodels.io` | SPF: `include:spf.titan.email` |
  | TXT | `send.mangomodels.io` | SPF: `include:amazonses.com` |
  | TXT | `resend._domainkey` | Resend DKIM |
  | TXT | `titan1._domainkey` | Titan DKIM |
  | TXT | `_dmarc` | DMARC |

### 2.4 tccg.work
- **Zone ID**: `3a47939ab62470d56a66857fc4626755`
- **Plan**: Free
- **SSL**: Strict
- **Security Level**: Medium
- **Hosting**: `216.150.1.1` (direct IP)
- **Email**: Titan Email
- **DNS Records**:
  | Type | Name | Content |
  |------|------|---------|
  | A | `tccg.work` | `216.150.1.1` |
  | CNAME | `www.tccg.work` | `tccg.work` |
  | MX | `tccg.work` | `mx{1,2}.titan.email` |
  | TXT | `tccg.work` | SPF: `include:spf.titan.email` |
  | TXT | `tccg.work` | SPF: `-all` (conflict!) |
  | TXT | `_dmarc` | DMARC: `p=reject` (strict) |
  | TXT | `_dmarc` | DMARC: `p=none` (conflict!) |
  | TXT | `*._domainkey` | DKIM: empty `p=` (revoked) |

> ⚠ **tccg.work has conflicting DNS**: dual SPF records (one `-all`, one `~all`) and dual DMARC records (`p=reject` vs `p=none`). Needs cleanup.

---

## 3. Account Resources

### 3.1 Pages Projects
| Project | Subdomain | Prod Branch | Custom Domains | Repo |
|---------|-----------|-------------|----------------|------|
| `bettorsace` | `bettorsace.pages.dev` | `main` | `bettorsace.win` | Direct upload |
| `freakme-fun` | `freakme-fun.pages.dev` | `main` | `www.freakme.fun` | `Tolani-Corp/freakme.fun` |
| `freakme` | `freakme.pages.dev` | `main` | `freakme.fun` | Direct upload |

### 3.2 Workers
| Worker | Last Modified |
|--------|---------------|
| `bettorsace` | 2026-02-14 |
| `freakme-gateway` | 2026-02-12 |

### 3.3 Storage
- **KV Namespaces**: None
- **D1 Databases**: None
- **R2 Buckets**: Access denied (token may need `R2 Read` added for listing)

---

## 4. Traffic & Analytics (7-day snapshot as of 2026-02-23)

| Zone | Requests | Cached | Bandwidth | Visitors | Threats | Page Views |
|------|----------|--------|-----------|----------|---------|------------|
| bettorsace.win | 14,293 | 2,842 | 112.51 MB | 703 | 12 | 4,213 |
| freakme.fun | — | — | — | — | — | — |
| mangomodels.io | — | — | — | — | — | — |
| tccg.work | — | — | — | — | — | — |

> Only `bettorsace.win` has active traffic. Other zones have no traffic in the last 7 days.

---

## 5. Agent Skill → Token Permission Mapping

### 5.1 NATT Ghost Agent Skills

| NATT Skill | Permission Required | Token Has | Status |
|---|---|---|---|
| `cdn-waf-detection` | Zone Read | ✅ | **Active** — can detect CF presence via headers |
| `http-security-headers` | Zone Read | ✅ | **Active** — audit CSP, HSTS, etc. |
| `dns-intelligence` | DNS Read | ✅ | **Active** — enumerate A, MX, TXT, SPF, DKIM, DMARC |
| `subdomain-enum` | DNS Read | ✅ | **Active** — enumerate subdomains via DNS |
| `cloud-misconfiguration` | Zone Settings Read + DNS Read | ✅ | **Planned → Now Unblocked** |
| Firewall audit | Firewall Services Write | ✅ | Agent can read/write WAF rules |
| SSL posture scan | SSL and Certificates Write | ✅ | Agent can audit SSL config |
| Cache poisoning recon | Cache Purge | ✅ | Agent can purge caches during testing |
| Worker route inspection | Workers Routes Write | ✅ | Agent can inspect/modify worker routes |

### 5.2 DevBot Orchestrator Agent Skills

| Agent Role | CF Permission Used | Capability |
|---|---|---|
| `devops` | Pages Write | Deploy to Cloudflare Pages |
| `devops` | Workers Scripts Write | Deploy Workers |
| `devops` | DNS Write | Manage DNS records programmatically |
| `devops` | D1 Write | Provision D1 databases |
| `devops` | KV Storage Write | Provision KV namespaces |
| `devops` | Cache Purge | Purge CDN cache after deploys |
| `security` | Firewall Services Write | Deploy firewall rules |
| `security` | Bot Management Write | Configure bot protection |
| `security` | Account WAF Read | Audit WAF rules |
| `security` | Access: Apps Write | Configure Zero Trust |

### 5.3 MCP Server Capabilities

| MCP Capability | Token Permission | API Endpoint |
|---|---|---|
| List zones | Zone Read | `GET /zones` |
| Get zone settings | Zone Read | `GET /zones/{id}/settings` |
| List DNS records | DNS Read | `GET /zones/{id}/dns_records` |
| Create DNS record | DNS Write | `POST /zones/{id}/dns_records` |
| Update DNS record | DNS Write | `PATCH /zones/{id}/dns_records/{id}` |
| Delete DNS record | DNS Write | `DELETE /zones/{id}/dns_records/{id}` |
| Purge cache | Cache Purge | `POST /zones/{id}/purge_cache` |
| Deploy Pages | Pages Write | `POST /accounts/{id}/pages/projects/{name}/deployments` |
| List Workers | Workers Scripts Write | `GET /accounts/{id}/workers/scripts` |
| Update zone setting | Zone Settings Write | `PATCH /zones/{id}/settings/{setting}` |
| SSL verification | SSL Certificates Write | `GET /zones/{id}/ssl/verification` |
| Firewall rules | Firewall Services Write | `GET/POST /zones/{id}/firewall/rules` |
| Analytics (GraphQL) | Analytics Read | `POST /graphql` |
| Dev Mode toggle | Zone Settings Write | `PATCH /zones/{id}/settings/development_mode` |
| Enable Under Attack | Zone Settings Write | `PATCH /zones/{id}/settings/security_level` |

---

## 6. API Quick Reference

### Authentication Header
```
Authorization: Bearer $CLOUDFLARE_API_TOKEN
Content-Type: application/json
```

### Base URL
```
https://api.cloudflare.com/client/v4
```

### Common Operations

```bash
# Verify token
GET /user/tokens/verify

# List all zones
GET /zones?account.id={account_id}

# Get zone DNS records
GET /zones/{zone_id}/dns_records

# Create DNS record
POST /zones/{zone_id}/dns_records
{ "type": "CNAME", "name": "subdomain", "content": "target.example.com", "proxied": true }

# Purge entire cache
POST /zones/{zone_id}/purge_cache
{ "purge_everything": true }

# Toggle development mode
PATCH /zones/{zone_id}/settings/development_mode
{ "value": "on" }

# GraphQL analytics (7-day requests)
POST /graphql
{ "query": "{ viewer { zones(filter: {zoneTag: \"ZONE_ID\"}) { httpRequests1dGroups(limit: 7, filter: {date_geq: \"YYYY-MM-DD\"}) { sum { requests } } } } }" }

# Deploy Pages (direct upload)
POST /accounts/{account_id}/pages/projects/{project}/deployments

# List Pages projects
GET /accounts/{account_id}/pages/projects
```

---

## 7. Environment Variable Reference

Add to `.env` for agent consumption:

```dotenv
# Cloudflare API
CLOUDFLARE_API_TOKEN=<token>
CLOUDFLARE_ACCOUNT_ID=d20586cf099d39fcbeb5db4043e20f6f

# Zone IDs
CF_ZONE_BETTORSACE=cd457b1c596f0655b5b3a6010597b93f
CF_ZONE_FREAKME=2fd87bb2af3024f95c3734231b731357
CF_ZONE_MANGOMODELS=b8082376e23dd2373810bfdcb4996d3c
CF_ZONE_TCCG=3a47939ab62470d56a66857fc4626755
```

---

## 8. Security Considerations

- **Token scope**: Covers all zones on the account — any zone can be read/modified
- **Write access**: DNS, Firewall, Workers, Pages, SSL are all writable — guard against accidental destructive ops
- **ROE integration**: NATT missions targeting Tolani-Corp zones should pre-populate ROE with zone IDs from this index
- **Token rotation**: Token can self-modify (has `API Tokens Write`) — rotate via API if compromised
- **Audit trail**: All Cloudflare API actions are logged in Cloudflare Audit Logs (dashboard or API)
- **R2 gap**: Token cannot list R2 buckets (needs `R2 Read` added if needed)

---

## 9. Known Issues & Action Items

| # | Issue | Zone | Priority |
|---|---|---|---|
| 1 | Dual conflicting SPF records (`-all` vs `~all`) | tccg.work | High |
| 2 | Dual conflicting DMARC records (`p=reject` vs `p=none`) | tccg.work | High |
| 3 | Revoked DKIM key (`p=` empty) on wildcard `*._domainkey` | tccg.work | Medium |
| 4 | R2 bucket listing returns 403 — may need `R2 Read` perm | Account | Low |
| 5 | `freakme.fun` has two Pages projects (legacy `freakme` + new `freakme-fun`) | freakme.fun | Low |
| 6 | `bettorsace` Pages project not Git-connected (direct upload only) | bettorsace.win | Info |

---

## 10. MCP Server Integration Points

### Existing MCP Servers
| Server | Location | Transport | Purpose |
|--------|----------|-----------|---------|
| `natt-mcp-knowledge` | `mcp-natt/` | stdio | NATT security knowledge |
| `devbot-media-client` | `src/mcp/client.ts` | stdio | FreakMe media processing |

### Recommended: Cloudflare MCP Server
A `mcp-cloudflare/` server should expose:
- **Tools**: `cf_list_zones`, `cf_get_dns`, `cf_create_dns`, `cf_delete_dns`, `cf_purge_cache`, `cf_get_analytics`, `cf_deploy_pages`, `cf_toggle_dev_mode`, `cf_set_security_level`
- **Resources**: `cf://zones`, `cf://zones/{id}/dns`, `cf://zones/{id}/settings`, `cf://account/pages`, `cf://account/workers`
- **Transport**: stdio (same pattern as `mcp-natt`)
- **Auth**: Read `CLOUDFLARE_API_TOKEN` from env

This enables any AI model (Claude, GPT, local LLM) to manage Cloudflare infrastructure via MCP without custom integration code.
