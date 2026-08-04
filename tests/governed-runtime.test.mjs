import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizeAction, buildEvidencePackage, createDelegatedSession } from '../scripts/validate-governed-runtime.mjs';

test('delegated identity cannot exceed human principal', () => {
  assert.throws(() => createDelegatedSession({
    principalId: 'user-1',
    principalScopes: ['repository.read'],
    requestedScopes: ['repository.read', 'production.write']
  }), /exceeds principal/);
});

test('session is short lived and branch constrained', () => {
  const session = createDelegatedSession({
    principalId: 'user-1',
    principalScopes: ['repository.read', 'repository.branch.create'],
    requestedScopes: ['repository.read'],
    ttlSeconds: 600
  });
  assert.equal(session.productionWrite, false);
  assert.equal(session.selfMerge, false);
  assert.equal(session.ephemeralWorkspaceRequired, true);
});

test('production and merge actions are always denied', () => {
  for (const action of ['production.write', 'deployment.production.execute', 'github.pull_request.merge']) {
    assert.deepEqual(authorizeAction({ action, branch: 'agent/test', workspaceEphemeral: true, telemetryReady: true, contextReady: true }), {
      allowed: false,
      reason: 'explicitly-denied'
    });
  }
});

test('missing telemetry, context, workspace, or safe branch fails closed', () => {
  assert.equal(authorizeAction({ action: 'repository.file.propose', branch: 'agent/test', workspaceEphemeral: true, telemetryReady: false, contextReady: true }).allowed, false);
  assert.equal(authorizeAction({ action: 'repository.file.propose', branch: 'agent/test', workspaceEphemeral: true, telemetryReady: true, contextReady: false }).allowed, false);
  assert.equal(authorizeAction({ action: 'repository.file.propose', branch: 'agent/test', workspaceEphemeral: false, telemetryReady: true, contextReady: true }).allowed, false);
  assert.equal(authorizeAction({ action: 'repository.file.propose', branch: 'main', workspaceEphemeral: true, telemetryReady: true, contextReady: true }).allowed, false);
});

test('bounded proposal can be authorized but Level 3 remains inactive', () => {
  const result = authorizeAction({ action: 'repository.file.propose', branch: 'agent/test', workspaceEphemeral: true, telemetryReady: true, contextReady: true });
  assert.equal(result.allowed, true);
  const evidence = buildEvidencePackage({
    intent: 'test change', files: [], sources: [], tests: ['node --test'], security: [], cost: { usd: 0 }, risk: 'low', rollback: 'discard branch', approvals: ['human-required'], traceId: 'trace-1'
  });
  assert.equal(evidence.level3Active, false);
  assert.equal(evidence.level4Enabled, false);
});
