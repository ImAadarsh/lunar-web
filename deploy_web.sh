#!/usr/bin/env bash
# Deploy Lunar Security web (Next.js) to EC2.
#
# Default: DEPLOY_MODE=rsync — build locally, rsync to server (web host has no reliable GitHub/npm egress).
# Optional: DEPLOY_MODE=git — git pull + build on server (only if outbound HTTPS works there).
#
# Portal URL: https://lunar-web.endeavourdigital.cloud
# API (public): https://lunar.endeavourdigital.cloud/api/v1
# Server-side login calls BACKEND_API_BASE (VPC private IP by default, not the public API hostname).
#
# Usage (from lunar_security_web/):
#   ./deploy_web.sh
#   BACKEND_API_BASE=http://172.31.12.134:4000/api/v1 ./deploy_web.sh
#   DEPLOY_MODE=git ./deploy_web.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

deploy_mode="${DEPLOY_MODE:-rsync}"
ssh_key="${SSH_KEY:-/Applications/XAMPP/xamppfiles/htdocs/zaam/zaam-api/zaam-erp.pem}"
ssh_user="${SSH_USER:-ubuntu}"
ssh_host="${SSH_HOST:-ec2-13-206-209-4.ap-south-1.compute.amazonaws.com}"
backend_ssh_host="${BACKEND_SSH_HOST:-ec2-13-203-67-189.ap-south-1.compute.amazonaws.com}"
app_dir="${APP_DIR:-/var/www/lunar-web}"
repo_url="${REPO_URL:-https://github.com/ImAadarsh/lunar-web.git}"
branch="${BRANCH:-main}"
process_name="${PROCESS_NAME:-lunar-web}"
port="${PORT:-3000}"
google_maps_api_key="${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:-AIzaSyAg9eHoFx4kW3MBy2FLazMJQa6UPdKqj_A}"
portal_origin="${PORTAL_ORIGIN:-https://lunar-web.endeavourdigital.cloud}"
rsync_excludes=(
  --exclude .git
  --exclude .env.local
  --exclude .env.development
  --exclude .DS_Store
)

ssh_target="${ssh_user}@${ssh_host}"
ssh_backend="${ssh_user}@${backend_ssh_host}"
ssh_opts=(-i "$ssh_key" -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20)

log() { printf '==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

remote() {
  ssh "${ssh_opts[@]}" "$ssh_target" "$@"
}

remote_backend() {
  ssh "${ssh_opts[@]}" "$ssh_backend" "$@"
}

resolve_backend_api_base() {
  if [[ -n "${BACKEND_API_BASE:-}" ]]; then
    printf '%s' "$BACKEND_API_BASE"
    return
  fi
  log "Resolving backend private IP from ${backend_ssh_host}…"
  local ip
  ip="$(remote_backend "hostname -I | awk '{print \$1}'")" || die "Could not resolve backend private IP. Set BACKEND_API_BASE."
  [[ -n "$ip" ]] || die "Backend private IP was empty. Set BACKEND_API_BASE."
  printf 'http://%s:4000/api/v1' "$ip"
}

write_local_env_production() {
  local base="$1"
  cat > .env.production <<ENV
BACKEND_API_BASE=${base}
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${google_maps_api_key}
ENV
  log "Wrote .env.production (BACKEND_API_BASE=${base})"
}

next_version() {
  node -p "require('./node_modules/next/package.json').version" 2>/dev/null \
    || node -p "require('next/package.json').version" 2>/dev/null \
    || echo "15.2.4"
}

install_linux_swc_on_server() {
  local ver="$1"
  local tmp
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' RETURN
  log "Packaging @next/swc-linux-x64-gnu@${ver} for Linux server…"
  (cd "$tmp" && npm pack "@next/swc-linux-x64-gnu@${ver}" >/dev/null)
  local tgz
  tgz="$(ls "$tmp"/next-swc-linux-x64-gnu-*.tgz | head -1)"
  remote "mkdir -p '${app_dir}/node_modules/@next'"
  scp "${ssh_opts[@]}" "$tgz" "${ssh_target}:/tmp/next-swc-linux.tgz"
  remote "rm -rf '${app_dir}/node_modules/@next/swc-linux-x64-gnu' && mkdir -p '${app_dir}/node_modules/@next/swc-linux-x64-gnu' && tar -xzf /tmp/next-swc-linux.tgz -C '${app_dir}/node_modules/@next/swc-linux-x64-gnu' --strip-components=1 && rm -f /tmp/next-swc-linux.tgz"
  log "Installed Linux SWC on server."
}

remote_has_npm_registry() {
  remote "curl -fsS --connect-timeout 8 https://registry.npmjs.org >/dev/null 2>&1"
}

local_build() {
  local base="$1"
  write_local_env_production "$base"
  if [[ ! -d node_modules ]]; then
    log "Running npm ci locally…"
    npm ci
  fi
  log "Running npm run build locally…"
  npm run build
}

rsync_to_server() {
  local sync_node_modules="${1:-0}"
  log "Rsyncing app to ${ssh_target}:${app_dir}…"
  remote "sudo mkdir -p '${app_dir}' && sudo chown -R \"\$USER\":\"\$USER\" '${app_dir}'"
  local -a excludes=("${rsync_excludes[@]}")
  if [[ "$sync_node_modules" != "1" ]]; then
    excludes+=(--exclude node_modules)
  fi
  rsync -az --delete "${excludes[@]}" -e "ssh ${ssh_opts[*]}" ./ "${ssh_target}:${app_dir}/"
}

remote_finish() {
  local base="$1"
  remote "cat > '${app_dir}/.env.production' <<ENV
BACKEND_API_BASE=${base}
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${google_maps_api_key}
ENV
cp '${app_dir}/.env.production' '${app_dir}/.env'
cd '${app_dir}'
if pm2 describe '${process_name}' >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save
sleep 3
curl -fsS --connect-timeout 10 \"http://127.0.0.1:${port}/api/health\" | grep -q '\"ok\":true' || { echo 'Health check failed'; pm2 logs '${process_name}' --lines 40 --nostream; exit 1; }
code=\$(curl -sS -o /tmp/login_probe.json -w '%{http_code}' --connect-timeout 15 -X POST \"http://127.0.0.1:${port}/api/auth/login\" -H 'Content-Type: application/json' -d '{\"email\":\"deploy-probe@invalid.local\",\"password\":\"invalid\"}')
if [ \"\$code\" != '401' ]; then
  echo \"Login proxy check failed (expected 401, got \$code): \$(cat /tmp/login_probe.json)\"
  pm2 logs '${process_name}' --lines 40 --nostream
  exit 1
fi
echo 'Post-deploy checks OK (health + login proxy → backend).'
pm2 status
df -h / | tail -1"
}

deploy_rsync() {
  local base
  base="$(resolve_backend_api_base)"
  chmod 400 "$ssh_key"
  local_build "$base"
  local swc_ver
  swc_ver="$(next_version)"

  if remote_has_npm_registry; then
    log "Server can reach npm registry — rsync without node_modules, npm ci on server."
    rsync_to_server 0
    remote "cd '${app_dir}' && npm ci --omit=dev" || {
      log "Remote npm ci failed; falling back to syncing local node_modules."
      rsync_to_server 1
    }
  else
    log "Server cannot reach npm registry — rsync including node_modules from local machine."
    rsync_to_server 1
  fi

  install_linux_swc_on_server "$swc_ver"
  remote_finish "$base"
  log "Deploy complete. Portal: ${portal_origin}"
}

deploy_git() {
  local base
  base="$(resolve_backend_api_base)"
  chmod 400 "$ssh_key"
  log "DEPLOY_MODE=git — deploying via git pull on server (requires GitHub + npm egress)."
  ssh \
    "${ssh_opts[@]}" \
    "$ssh_target" \
    "APP_DIR='$app_dir' REPO_URL='$repo_url' BRANCH='$branch' PROCESS_NAME='$process_name' PORT='$port' BACKEND_API_BASE='$base' NEXT_PUBLIC_GOOGLE_MAPS_API_KEY='$google_maps_api_key' bash -s" <<'REMOTE_GIT'
set -euo pipefail
export GIT_TERMINAL_PROMPT=0

if ! command -v git >/dev/null 2>&1; then
  sudo apt-get update
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y git curl
fi
if ! command -v npm >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
fi
if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi

sudo mkdir -p "$APP_DIR"
sudo chown -R "$USER":"$USER" "$APP_DIR"

if [ ! -d "$APP_DIR/.git" ]; then
  sudo rm -rf "$APP_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  sudo chown -R "$USER":"$USER" "$APP_DIR"
fi

cd "$APP_DIR"
if [ -e deploy_web.sh ] && ! git ls-files --error-unmatch deploy_web.sh >/dev/null 2>&1; then
  rm -f deploy_web.sh
fi
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

cat > .env.production <<ENV
BACKEND_API_BASE=$BACKEND_API_BASE
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ENV
cp .env.production .env

npm ci
npm run build

if pm2 describe "$PROCESS_NAME" >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save
sleep 3
curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null
REMOTE_GIT
  log "Git deploy finished. If Next fails to start, re-run with DEPLOY_MODE=rsync (default)."
  log "Portal: ${portal_origin}"
}

case "$deploy_mode" in
  rsync) deploy_rsync ;;
  git) deploy_git ;;
  *) die "Unknown DEPLOY_MODE=${deploy_mode} (use rsync or git)" ;;
esac
