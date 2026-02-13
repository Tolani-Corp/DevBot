#!/bin/bash
# RBAC Sync Script - Syncs RBAC config from DevBot to freakme.fun app
# Run this after DevBot updates rbac-config.json

set -e

echo "🔐 Starting RBAC Sync from DevBot..."

# Paths
DEVBOT_RBAC="$PWD/rbac-config.json"
APP_RBAC_DIR="../freakme.fun/app/src/config"
APP_RBAC_FILE="$APP_RBAC_DIR/rbac.config.json"

# Check if DevBot RBAC config exists
if [ ! -f "$DEVBOT_RBAC" ]; then
    echo "❌ DevBot RBAC config not found at $DEVBOT_RBAC"
    exit 1
fi

# Create app config directory if it doesn't exist
mkdir -p "$APP_RBAC_DIR"

# Copy and validate RBAC config
echo "📋 Copying RBAC configuration..."
cp "$DEVBOT_RBAC" "$APP_RBAC_FILE"

# Validate JSON
if ! jq empty "$APP_RBAC_FILE" 2>/dev/null; then
    echo "❌ Invalid JSON in copied config"
    exit 1
fi

echo "✅ RBAC config synced successfully"
echo "📍 Location: $APP_RBAC_FILE"

# Generate TypeScript types from JSON config
echo "🔧 Generating TypeScript types..."
cat > "${APP_RBAC_DIR}/rbac.types.ts" << 'EOF'
// AUTO-GENERATED - DO NOT EDIT
// This file is generated from rbac-config.json
// Update the config in DevBot and run sync-rbac.sh

export interface RoleConfig {
  displayName: string;
  description: string;
  tier: 'enterprise' | 'pro' | 'standard' | 'basic';
  permissions: string[];
  entraIdRole: string;
}

export interface PermissionConfig {
  description: string;
  level: 'critical' | 'high' | 'medium' | 'low';
  requiredRoles: string[];
  note?: string;
}

export interface RBACConfig {
  version: string;
  lastUpdated: string;
  source: string;
  roles: Record<string, RoleConfig>;
  permissions: Record<string, PermissionConfig>;
}
EOF

echo "✅ TypeScript types generated"

# Update app's RBAC library
echo "🔄 Updating app RBAC library..."
cat > "${APP_RBAC_DIR}/load-rbac-config.ts" << 'EOF'
import rbacConfigJson from './rbac.config.json';

export const rbacConfig = rbacConfigJson;

export function getRolePermissions(role: string): string[] {
  return rbacConfig.roles[role]?.permissions || [];
}

export function getPermissionInfo(permission: string) {
  return rbacConfig.permissions[permission];
}

export function validateRoleAssignment(assignerRole: string, targetRole: string): boolean {
  const hierarchy = rbacConfig.roles[assignerRole]?.canAssign || [];
  return hierarchy.includes(targetRole);
}
EOF

echo "✅ RBAC library updated"

# Commit changes
echo "📝 Committing changes..."
cd ../freakme.fun
git add app/src/config/rbac.config.json app/src/config/rbac.types.ts app/src/config/load-rbac-config.ts
git commit -m "chore: Sync RBAC config from DevBot

Generated from rbac-config.json in DevBot (source of truth)
- Updated role definitions
- Updated permission mappings
- Regenerated TypeScript types" || echo "⚠️  No changes to commit"

echo "✅ RBAC Sync Complete!"
echo "📊 Config Version: $(jq -r '.version' $APP_RBAC_FILE)"
echo "🤖 Maintained by: DevBot (funbot)"
