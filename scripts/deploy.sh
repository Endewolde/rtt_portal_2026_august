#!/usr/bin/env bash
#
# Deploy the working tree to production in one step:
#   1. build the front end
#   2. copy the code (same rsync as before, plus bootstrap/cache left alone)
#   3. on the server: run new migrations, clear stale caches, restart queue workers
#
# Usage:
#   scripts/deploy.sh            deploy
#   scripts/deploy.sh --dry-run  show what would be copied and which migrations would run
#
# One SSH connection is shared by every step, so the password is asked for once.

set -euo pipefail

HOST="${DEPLOY_HOST:-rtt@197.156.124.59}"
DIR="${DEPLOY_DIR:-/var/www/rtt}"
DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

cd "$(dirname "$0")/.."

SOCKET="$(mktemp -u /tmp/rtt-deploy.XXXXXX)"
SSH_OPTS=(-o ControlMaster=auto -o ControlPath="$SOCKET" -o ControlPersist=120)
cleanup() { ssh "${SSH_OPTS[@]}" -O exit "$HOST" 2>/dev/null || true; }
trap cleanup EXIT

remote() { ssh "${SSH_OPTS[@]}" "$HOST" "cd '$DIR' && $*"; }

echo "▸ Connecting to $HOST…"
ssh "${SSH_OPTS[@]}" -fN "$HOST"

if [[ -n "$(git status --porcelain)" ]]; then
    echo "⚠ The working tree has uncommitted changes — they will be deployed too."
    $DRY_RUN || { read -r -p "  Continue? [y/N] " ok; [[ "$ok" == [yY] ]] || exit 1; }
fi

if ! $DRY_RUN; then
    echo "▸ Building the front end…"
    npm run build --silent
fi

echo "▸ Copying files…"
RSYNC_FLAGS=(-avz --checksum --delete)
$DRY_RUN && RSYNC_FLAGS+=(--dry-run)
rsync "${RSYNC_FLAGS[@]}" -e "ssh ${SSH_OPTS[*]}" \
    --exclude='.git' --exclude='node_modules' --exclude='resources/js/' --exclude='tests/' \
    --exclude='.env' --exclude='storage/' \
    --exclude='bootstrap/cache/*.php' \
    --exclude='dump.rdb' --exclude='scripts/node_modules' \
    ./ "$HOST:$DIR/" | tail -n 5

if $DRY_RUN; then
    echo "▸ Migrations that would run:"
    remote "php artisan migrate:status --pending 2>/dev/null || php artisan migrate --pretend"
    exit 0
fi

echo "▸ Running migrations…"
remote "php artisan migrate --force"

echo "▸ Clearing caches and restarting queue workers…"
remote "php artisan optimize:clear && php artisan queue:restart"

echo "▸ Checking the site answers…"
remote "php artisan about --only=environment | head -n 8"

echo "✓ Deployed $(git rev-parse --short HEAD) to $HOST:$DIR"
