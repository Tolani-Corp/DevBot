# RBAC Source of Truth - DevBot (funbot)

This document explains how DevBot (funbot) is the authoritative source of truth for all RBAC operations on freakme.fun.

## Overview

**DevBot (funbot)** maintains the canonical RBAC configuration in [`rbac-config.json`](rbac-config.json). The freakme.fun application automatically syncs this configuration to stay in sync with the source of truth.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 DevBot (funbot)                          │
│        📋 rbac-config.json (Source of Truth)             │
│   - Role definitions                                     │
│   - Permission mappings                                  │
│   - Hierarchy rules                                      │
│   - Enforcement policies                                 │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ Sync (Sync-RBAC.ps1 / sync-rbac.sh)
                 │
┌────────────────▼────────────────────────────────────────┐
│            freakme.fun Application                       │
│     🔄 app/src/config/rbac.config.json (Synced)         │
│   - Generated TypeScript types                           │
│   - Runtime permission checking                          │
│   - UI role-based rendering                              │
└─────────────────────────────────────────────────────────┘
```

## How to Update RBAC

### 1. Modify Configuration in DevBot

Edit [`rbac-config.json`](rbac-config.json) in the DevBot project:

```json
{
  "roles": {
    "newRole": {
      "displayName": "New Role",
      "description": "Description",
      "tier": "standard",
      "permissions": ["permission:action"],
      "entraIdRole": "newRole"
    }
  },
  "permissions": {
    "permission:action": {
      "description": "Action description",
      "level": "high",
      "requiredRoles": ["newRole"]
    }
  }
}
```

### 2. Run Sync Script

**On Windows (PowerShell):**
```powershell
PS> .\scripts\Sync-RBAC.ps1
```

**On macOS/Linux (Bash):**
```bash
$ ./scripts/sync-rbac.sh
```

### 3. Verify Sync

The script will:
- ✅ Copy `rbac-config.json` to freakme.fun
- ✅ Generate TypeScript types
- ✅ Update RBAC library loader
- ✅ Commit changes with proper messages

### 4. Changes Apply Automatically

On next app reload, the new RBAC configuration is active:

```typescript
import { rbacConfig, getRolePermissions } from '@/config/load-rbac-config';

// Use the synced config
const permissions = getRolePermissions('admin');
console.log(rbacConfig.version); // Updated version from DevBot
```

## Key Principles

1. **Single Source of Truth**: All RBAC definitions originate in DevBot
2. **No Manual Edits in App**: Don't edit RBAC in freakme.fun; changes will be overwritten
3. **Automated Sync**: One-command sync keeps app in perfect sync
4. **Audit Trail**: Every change is committed with DevBot as the author
5. **Type Safety**: TypeScript types auto-generated from config
6. **Versioning**: Config version tracks changes

## Configuration Structure

### Roles

Each role defines:
- **displayName**: Human-readable name
- **description**: Role purpose
- **tier**: enterprise/pro/standard/basic
- **permissions**: Array of allowed permissions
- **entraIdRole**: Azure Entra ID role name

### Permissions

Each permission specifies:
- **description**: What the permission allows
- **level**: critical/high/medium/low severity
- **requiredRoles**: Which roles have this permission
- **note**: Optional metadata

### Hierarchy Rules

Define role precedence and inheritance:
```json
"admin": {
  "precedence": 4,
  "inherits": ["moderator", "creator", "user"],
  "canAssign": ["admin", "moderator", "creator", "user"]
}
```

### Enforcement Rules

Platform-wide RBAC enforcement:
```json
{
  "rule": "No user can assign higher-tier roles than their own",
  "enforced": true
}
```

## Adding a New Role

1. Edit `rbac-config.json` in DevBot:

```json
{
  "roles": {
    "analyst": {
      "displayName": "Data Analyst",
      "description": "View analytics and reports",
      "tier": "standard",
      "permissions": [
        "view:analytics",
        "view:reports",
        "export:data"
      ],
      "entraIdRole": "analyst"
    }
  },
  "permissions": {
    "export:data": {
      "description": "Export platform data",
      "level": "medium",
      "requiredRoles": ["analyst", "admin"]
    }
  }
}
```

2. Run sync script

3. Create app pages using ProtectedRoute:

```typescript
<ProtectedRoute requiredRoles={['analyst']}>
  <AnalyticsDashboard />
</ProtectedRoute>
```

## Updating Permissions

1. Modify permission definitions in DevBot's config
2. Update role permissions arrays
3. Run sync script
4. App automatically uses new permissions

## Emergency Role Changes

If immediate changes are needed outside of the normal sync process:

1. Edit directly in DevBot's `rbac-config.json`
2. Run sync script: `Sync-RBAC.ps1 -NoCommit` (for testing first)
3. Test changes locally
4. Run without `-NoCommit` to commit

## Audit & Compliance

All changes are tracked:

- **changeLog**: Records all RBAC updates
- **auditLog**: Tracks all enforcement actions
- **Entra ID Integration**: Changes sync to Azure AD
- **Retention**: 2-year audit history

Sample audit entry:
```json
{
  "timestamp": "2026-02-13T14:30:00Z",
  "action": "role_assignment",
  "userId": "user@example.com",
  "role": "creator",
  "assignedBy": "admin@example.com",
  "auditId": "audit_12847"
}
```

## Rollback Procedures

If a sync introduces issues:

```powershell
# Revert to previous config
git revert <commit-hash>

# Update app
Sync-RBAC.ps1
```

## Integration Points

RBAC config is used in:
- **React Components**: `useRBAC()` hook
- **ProtectedRoute**: Role-based access
- **API Calls**: Permission validation
- **Azure Entra ID**: Role synchronization
- **Audit Logs**: All changes tracked

## Testing RBAC Changes

Before syncing to production:

1. Make Config changes locally in DevBot
2. Run sync with `-NoCommit`
3. Test in local app
4. Verify permissions work as expected
5. Run without `-NoCommit` to commit

## Troubleshooting

**Config not syncing?**
```powershell
# Force sync
Sync-RBAC.ps1 -Force
```

**Changes not reflecting?**
- Clear browser cache
- Restart dev server
- Check console for errors

**JSON validation errors?**
- Use JSON linter: `jq empty rbac-config.json`
- Check for duplicate keys
- Verify syntax

## Best Practices

1. ✅ Always make changes in DevBot only
2. ✅ Run sync script after every RBAC change
3. ✅ Test changes in local environment first
4. ✅ Commit changes with descriptive messages
5. ✅ Review audit logs regularly
6. ✅ Keep permissions minimal (principle of least privilege)
7. ✅ Document new roles in `rbac-config.json` metadata

## Contact & Support

- **RBAC Source of Truth**: DevBot (funbot) - [`@freakme.fun DevBot`](../../DevBot)
- **Configuration File**: [`rbac-config.json`](rbac-config.json)
- **Sync Scripts**: [`scripts/Sync-RBAC.ps1`](scripts/Sync-RBAC.ps1) | [`scripts/sync-rbac.sh`](scripts/sync-rbac.sh)
