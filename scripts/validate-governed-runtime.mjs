import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const lockPath = path.join(root, 'governance/tolani-contract-lock.json');
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));

const fail = (message) => {
  console.error(`GOVERNANCE FAILURE: ${message}`);
  process.exitCode = 1;
};

const requiredDenied = [
  'production.write',
  'deployment.production.execute',
  'github.pull_request.merge',
  'github.branch.protected.modify',
  'identity.role.modify',
  'secret.read.raw',
  'policy.modify.direct',
  'payment.execute',
  'contract.execute'
];

if (lock.authority.repository !== 'Tolani-Corp/TolaniLabs') fail('untrusted contract authority');
if (!/^[0-9a-f]{40}$/.test(lock.authority.commit)) fail('authority commit must be immutable');
if (lock.agent.name !== 'devbot-developer') fail('wrong agent identity');
if (lock.agent.serviceAccount !== 'agent-devbot-developer') fail('wrong service account');
if (lock.agent.maximumAutonomyLevel !== 3) fail('maximum autonomy must be Level 3');
if (lock.agent.level3Active !== false) fail('Level 3 must remain inactive pending approval');
if (lock.agent.level4Enabled !== false) fail('Level 4 must remain disabled');
if (lock.promotion.requiredPassingWindows < 3) fail('three passing windows are required');
if (lock.promotion.minimumCasesPerWindow < 100) fail('each window requires at least 100 cases');
if (!lock.promotion.productionCanaryRequired) fail('production canary is required');

for (const approval of ['founder', 'platform-owner', 'independent-security']) {
  if (!lock.promotion.requiredApprovals.includes(approval)) fail(`missing ${approval} approval`);
}
for (const action of requiredDenied) {
  if (!lock.deniedActions.includes(action)) fail(`missing denied action ${action}`);
}
for (const contract of lock.contracts) {
  if (!/^[0-9a-f]{40}$/.test(contract.gitBlobSha)) fail(`invalid immutable blob SHA for ${contract.path}`);
}

export function createDelegatedSession({ principalId, principalScopes, requestedScopes, ttlSeconds = 900 }) {
  if (!principalId) throw new Error('principalId is required');
  if (!Array.isArray(principalScopes) || !Array.isArray(requestedScopes)) throw new Error('scopes must be arrays');
  if (ttlSeconds <= 0 || ttlSeconds > 3600) throw new Error('session TTL must be between 1 and 3600 seconds');
  const excess = requestedScopes.filter((scope) => !principalScopes.includes(scope));
  if (excess.length) throw new Error(`delegated scope exceeds principal: ${excess.join(', ')}`);
  return {
    sessionId: `devbot-${Date.now()}`,
    principalId,
    agentId: lock.agent.serviceAccount,
    scopes: [...requestedScopes],
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    ephemeralWorkspaceRequired: true,
    protectedBranchWrite: false,
    selfMerge: false,
    productionWrite: false
  };
}

export function authorizeAction({ action, branch, workspaceEphemeral, telemetryReady, contextReady }) {
  if (lock.deniedActions.includes(action)) return { allowed: false, reason: 'explicitly-denied' };
  if (!telemetryReady) return { allowed: false, reason: 'telemetry-unavailable' };
  if (!contextReady) return { allowed: false, reason: 'required-context-unavailable' };
  if (!workspaceEphemeral) return { allowed: false, reason: 'workspace-not-ephemeral' };
  if (!branch || branch === 'main' || branch === 'master') return { allowed: false, reason: 'protected-or-default-branch' };
  if (!branch.startsWith('agent/')) return { allowed: false, reason: 'unapproved-branch-prefix' };
  return { allowed: true, reason: 'bounded-level3-candidate' };
}

export function buildEvidencePackage(input) {
  const required = ['intent', 'files', 'sources', 'tests', 'security', 'cost', 'risk', 'rollback', 'approvals', 'traceId'];
  const missing = required.filter((field) => input[field] === undefined || input[field] === null);
  if (missing.length) throw new Error(`evidence package missing: ${missing.join(', ')}`);
  return {
    schemaVersion: 1,
    authorityCommit: lock.authority.commit,
    agent: `${lock.agent.name}@${lock.agent.version}`,
    level3Active: lock.agent.level3Active,
    level4Enabled: lock.agent.level4Enabled,
    generatedAt: new Date().toISOString(),
    ...input
  };
}

if (!process.exitCode) console.log('DevBot governed runtime contract passed. Level 3 inactive; Level 4 disabled.');
