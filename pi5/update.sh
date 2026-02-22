#!/usr/bin/env bash
# =============================================================================
# update.sh — Atomic DevBot Self-Update Script
#
# Spawned by DevBot as a **detached** background process so it survives the
# systemctl restart that kills the parent Node.js process.
#
# Flow:
#   1. Redirect all output to /mnt/nvme/logs/devbot/update.log
#   2. git fetch + fast-forward pull
#   3. Backup current dist/
#   4. pnpm install (locked)
#   5. pnpm build
#   6. DB migrations
#   7. sudo systemctl restart (3 services)
#   8. Health-check (port 3101 /health, 5×2s retries)
#   9. Post Slack result via curl
#   -- On failure at any step: restore dist.backup/ + restart + notify
#
# Environment variables (injected by self-updater.ts → spawn env):
#   DEVBOT_DIR            — absolute path to DevBot project root
#   UPDATE_SHA            — target commit SHA (for logging only)
#   UPDATE_SLACK_CHANNEL  — Slack channel ID to post result into
#   UPDATE_TRIGGERED_BY   — "github-push" | "scheduled" | "manual"
#   UPDATE_PUSHER         — GitHub username who pushed
#   UPDATE_COMMIT_MESSAGE — first line of the commit message
#   SLACK_BOT_TOKEN       — Slack Bot Token for curl API calls
#   WEBHOOK_PORT          — port to healthcheck (default 3101)
# =============================================================================

set -euo pipefail

# ── Paths ──────────────────────────────────────────────────────────────────────
DEVBOT_DIR="${DEVBOT_DIR:-/opt/devbot}"
LOG_DIR="${LOG_DIR:-/mnt/nvme/logs/devbot}"
LOG_FILE="$LOG_DIR/update.log"
UPDATE_SCRIPT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/$(basename "$0")"

HEALTH_PORT="${WEBHOOK_PORT:-3101}"
HEALTH_URL="http://localhost:$HEALTH_PORT/health"

# ── Slack vars ──────────────────────────────────────────────────────────────────
SLACK_TOKEN="${SLACK_BOT_TOKEN:-}"
SLACK_CHANNEL="${UPDATE_SLACK_CHANNEL:-}"
SHA="${UPDATE_SHA:-unknown}"
SHORT_SHA="${SHA:0:7}"
TRIGGERED_BY="${UPDATE_TRIGGERED_BY:-unknown}"
PUSHER="${UPDATE_PUSHER:-unknown}"
COMMIT_MSG="${UPDATE_COMMIT_MESSAGE:-}"

# ── Ensure log dir ─────────────────────────────────────────────────────────────
mkdir -p "$LOG_DIR"
exec >> "$LOG_FILE" 2>&1

echo ""
echo "============================================================"
echo " DevBot Self-Update — $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo " Trigger : $TRIGGERED_BY"
echo " Pusher  : $PUSHER"
echo " SHA     : $SHORT_SHA"
echo " Message : $COMMIT_MSG"
echo "============================================================"

# ── Slack helpers ──────────────────────────────────────────────────────────────
slack_post() {
  local text="$1"
  [[ -z "$SLACK_TOKEN" || -z "$SLACK_CHANNEL" ]] && return 0
  curl -sf -X POST https://slack.com/api/chat.postMessage \
    -H "Authorization: Bearer $SLACK_TOKEN" \
    -H "Content-Type: application/json" \
    --data "$(jq -nc --arg ch "$SLACK_CHANNEL" --arg txt "$text" \
      '{ channel: $ch, text: $txt }')" > /dev/null || true
}

# ── Rollback + emergency restart ───────────────────────────────────────────────
rollback() {
  echo "[update] ⚠️  Rollback triggered: $1"
  if [[ -d "$DEVBOT_DIR/dist.backup" ]]; then
    echo "[update] Restoring dist.backup/..."
    rm -rf "$DEVBOT_DIR/dist"
    cp -r "$DEVBOT_DIR/dist.backup" "$DEVBOT_DIR/dist"
    echo "[update] dist.backup/ restored"
    sudo systemctl restart devbot devbot-worker devbot-natt-cron || true
    sleep 10
    if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
      slack_post "⚠️ *DevBot rollback succeeded* | reverted \`$SHORT_SHA\` | reason: $1 | running on previous build"
    else
      slack_post "🚨 *DevBot CRITICAL* | rollback also FAILED | manual intervention required | reason: $1 | check \`$LOG_FILE\`"
    fi
  else
    slack_post "🚨 *DevBot CRITICAL* | no dist.backup to rollback to | reason: $1 | check \`$LOG_FILE\`"
  fi
  exit 1
}

# ── Step 1: git pull ───────────────────────────────────────────────────────────
echo "[update] Step 1/6 — git pull"
cd "$DEVBOT_DIR"
git fetch origin 2>&1
if ! git pull --ff-only origin master 2>&1; then
  echo "[update] Fast-forward pull failed — trying rebase"
  git pull --rebase origin master 2>&1 || rollback "git pull failed — conflicts?"
fi
ACTUAL_SHA="$(git rev-parse --short HEAD)"
echo "[update] HEAD is now: $ACTUAL_SHA"

# ── Step 2: backup dist/ ───────────────────────────────────────────────────────
echo "[update] Step 2/6 — backup dist/"
if [[ -d "$DEVBOT_DIR/dist" ]]; then
  rm -rf "$DEVBOT_DIR/dist.backup"
  cp -r "$DEVBOT_DIR/dist" "$DEVBOT_DIR/dist.backup"
  echo "[update] dist/ backed up to dist.backup/"
else
  echo "[update] No dist/ to backup (first build?)"
fi

# ── Step 3: pnpm install ───────────────────────────────────────────────────────
echo "[update] Step 3/6 — pnpm install"
export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
export PATH="$PNPM_HOME:$PATH"
pnpm install --frozen-lockfile 2>&1 || rollback "pnpm install failed"

# ── Step 4: pnpm build ────────────────────────────────────────────────────────
echo "[update] Step 4/6 — pnpm build"
pnpm build 2>&1 || rollback "pnpm build failed"

# ── Step 5: DB migrations ─────────────────────────────────────────────────────
echo "[update] Step 5/6 — DB migrations"
if [[ -f "$DEVBOT_DIR/dist/db/migrate.js" ]]; then
  node "$DEVBOT_DIR/dist/db/migrate.js" 2>&1 || rollback "DB migration failed"
else
  echo "[update] No migration script found — skipping"
fi

# ── Step 6: restart services ──────────────────────────────────────────────────
echo "[update] Step 6/6 — restart services"
sudo systemctl restart devbot devbot-worker devbot-natt-cron 2>&1 || rollback "systemctl restart failed"
echo "[update] Services restarted — waiting 15s for startup..."
sleep 15

# ── Healthcheck (5 × 3s retries) ──────────────────────────────────────────────
echo "[update] Healthcheck: $HEALTH_URL"
HEALTH_OK=false
for i in 1 2 3 4 5; do
  if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
    HEALTH_OK=true
    echo "[update] Healthcheck passed (attempt $i)"
    break
  fi
  echo "[update] Healthcheck attempt $i failed — retrying in 3s..."
  sleep 3
done

if [[ "$HEALTH_OK" == "false" ]]; then
  rollback "healthcheck failed after restart"
fi

# ── Success notification ───────────────────────────────────────────────────────
echo "[update] ✅ Update complete — $ACTUAL_SHA"
slack_post "✅ *DevBot updated* | \`$ACTUAL_SHA\` | $COMMIT_MSG | pushed by: $PUSHER"

# ── Cleanup backup (keep for 1 more cycle) ────────────────────────────────────
# Don't remove dist.backup yet — keep it for the next update cycle's safety net
echo "[update] Done at $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
