#!/usr/bin/env bash
# Deploy Lunar Security web (Next.js) to EC2.
#
# Default: DEPLOY_MODE=rsync — build locally, rsync to server (web host has no reliable GitHub/npm egress).
# Optional: DEPLOY_MODE=git — git pull + build on server (only if outbound HTTPS works there).
#
# Portal URL: https://lunar-web.endeavourdigital.cloud
# API (public): https://lunar.endeavourdigital.cloud/api/v1
# Server-side API calls use BACKEND_API_BASE. The web EC2 host often has NO outbound HTTPS (443);
# use the backend VPC private IP (auto-detected). Public https://lunar.endeavourdigital.cloud
# only works from your laptop, not from the web server — do not set it unless 443 egress works.
#
# Usage (from lunar_security_web/):
#   ./deploy_web.sh
#   BACKEND_API_BASE=https://lunar.endeavourdigital.cloud/api/v1 ./deploy_web.sh
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
backend_api_public="${BACKEND_API_PUBLIC:-https://lunar.endeavourdigital.cloud/api/v1}"
rsync_excludes=(
  --exclude .git
  --exclude .env
  --exclude .env.local
  --exclude .env.development
  --exclude .DS_Store
)

ssh_target="${ssh_user}@${ssh_host}"
ssh_backend="${ssh_user}@${backend_ssh_host}"
ssh_opts=(-i "$ssh_key" -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20)

# Logs must go to stderr so $(resolve_backend_api_base) capture stays clean.
log() { printf '==> %s\n' "$*" >&2; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

validate_backend_api_base() {
  local base="$1"
  [[ "$base" =~ ^https?://[^[:space:]]+/api/v1$ ]] || return 1
}

remote() {
  ssh "${ssh_opts[@]}" "$ssh_target" "$@"
}

remote_backend() {
  ssh "${ssh_opts[@]}" "$ssh_backend" "$@"
}

backend_health_ok() {
  local health_url="$1"
  remote "curl -fsS --connect-timeout 8 '${health_url}' 2>/dev/null | grep -q '\"status\":\"ok\"'"
}

# Confirms the web host can reach the API (not only /health through a proxy).
backend_login_reachable() {
  local api_base="$1"
  local code
  code="$(remote "curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 12 -X POST '${api_base}/auth/login' -H 'Content-Type: application/json' -d '{\"email\":\"deploy-probe@invalid.local\",\"password\":\"invalid\"}'" 2>/dev/null || echo "000")"
  [[ "$code" == "401" || "$code" == "400" ]]
}

assert_backend_reachable_from_web() {
  local base="$1"
  local health="${base%/api/v1}/health"
  if ! backend_health_ok "$health"; then
    die "BACKEND_API_BASE not reachable from web host (${health}). Use private IP http://<backend-private-ip>:4000/api/v1 — public HTTPS often times out on the web EC2."
  fi
  if ! backend_login_reachable "$base"; then
    die "BACKEND_API_BASE login probe failed from web host (${base}/auth/login)."
  fi
}

resolve_backend_api_base() {
  if [[ -n "${BACKEND_API_BASE:-}" ]]; then
    log "Using BACKEND_API_BASE from environment (will verify from web host)."
    assert_backend_reachable_from_web "$BACKEND_API_BASE"
    printf '%s' "$BACKEND_API_BASE"
    return
  fi

  local ip private_base public_base public_health
  public_base="${backend_api_public}"
  public_health="${public_base%/api/v1}/health"

  log "Resolving backend private IP from ${backend_ssh_host}…"
  ip="$(remote_backend "hostname -I | awk '{print \$1}'" 2>/dev/null || true)"
  if [[ -n "$ip" ]]; then
    private_base="http://${ip}:4000/api/v1"
    log "Probing private API from web host (http://${ip}:4000)…"
    if backend_health_ok "http://${ip}:4000/health" && backend_login_reachable "$private_base"; then
      log "Using private backend: ${private_base}"
      printf '%s' "$private_base"
      return
    fi
    log "Private backend not reachable from web host (ETIMEDOUT or blocked SG) — trying public API."
  else
    log "Could not read backend private IP — trying public API."
  fi

  log "Probing public API from web host (${public_base})…"
  if backend_health_ok "$public_health" && backend_login_reachable "$public_base"; then
    log "Using public backend: ${public_base}"
    printf '%s' "$public_base"
    return
  fi

  die "Backend unreachable from web host. Open SG: web → backend TCP 4000, then set BACKEND_API_BASE=http://<private-ip>:4000/api/v1 (public ${public_base} requires outbound 443 on web EC2)."
}

write_local_env_production() {
  local base="$1"
  validate_backend_api_base "$base" || die "Invalid BACKEND_API_BASE (check deploy script output): ${base}"
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
  log "Packaging @next/swc-linux-x64-gnu@${ver} for Linux server…"
  (cd "$tmp" && npm pack "@next/swc-linux-x64-gnu@${ver}" >/dev/null)
  local tgz
  tgz="$(ls "$tmp"/next-swc-linux-x64-gnu-*.tgz | head -1)"
  remote "mkdir -p '${app_dir}/node_modules/@next'"
  scp "${ssh_opts[@]}" "$tgz" "${ssh_target}:/tmp/next-swc-linux.tgz"
  remote "rm -rf '${app_dir}/node_modules/@next/swc-linux-x64-gnu' && mkdir -p '${app_dir}/node_modules/@next/swc-linux-x64-gnu' && tar -xzf /tmp/next-swc-linux.tgz -C '${app_dir}/node_modules/@next/swc-linux-x64-gnu' --strip-components=1 && rm -f /tmp/next-swc-linux.tgz"
  rm -rf "$tmp"
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
echo '--- server .env.production ---'
grep BACKEND_API_BASE '${app_dir}/.env.production' || true
cd '${app_dir}'
# Restart (not reload) so PM2 drops stale env from dump.pm2 and re-reads ecosystem + .env files.
if pm2 describe '${process_name}' >/dev/null 2>&1; then
  pm2 delete '${process_name}' || true
fi
pm2 start ecosystem.config.cjs
pm2 save

wait_portal_login_probe() {
  local i=1 code
  while [ \"\$i\" -le 20 ]; do
    curl -fsS --connect-timeout 10 \"http://127.0.0.1:${port}/api/health\" 2>/dev/null | grep -q '\"ok\":true' || { sleep 1; i=\$((i + 1)); continue; }
    code=\$(curl -sS -o /tmp/login_probe.json -w '%{http_code}' --connect-timeout 20 -X POST \"http://127.0.0.1:${port}/api/auth/login\" -H 'Content-Type: application/json' -d '{\"email\":\"deploy-probe@invalid.local\",\"password\":\"invalid\"}')
    if [ \"\$code\" = '401' ]; then
      return 0
    fi
    sleep 1
    i=\$((i + 1))
  done
  echo \"Login proxy check failed (expected 401, got \${code:-none}): \$(cat /tmp/login_probe.json 2>/dev/null)\"
  echo \"BACKEND_API_BASE in .env:\"
  grep BACKEND_API_BASE .env 2>/dev/null || true
  pm2 logs '${process_name}' --lines 40 --nostream
  return 1
}

wait_portal_login_probe || exit 1
echo 'Post-deploy checks OK (health + login proxy → backend).'
pm2 status
df -h / | tail -1"
}

deploy_rsync() {
  local base
  base="$(resolve_backend_api_base)"
  validate_backend_api_base "$base" || die "Resolved invalid BACKEND_API_BASE. Re-run with BACKEND_API_BASE=${backend_api_public}"
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
  validate_backend_api_base "$base" || die "Resolved invalid BACKEND_API_BASE. Re-run with BACKEND_API_BASE=${backend_api_public}"
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
  pm2 delete "$PROCESS_NAME" || true
fi
pm2 start ecosystem.config.cjs
pm2 save
sleep 3
curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null
REMOTE_GIT
  log "Git deploy finished. If Next fails to start, re-run with DEPLOY_MODE=rsync (default)."
  log "Portal: ${portal_origin}"
}

deploy_env_only() {
  local base
  if [[ -n "${BACKEND_API_BASE:-}" ]]; then
    base="$BACKEND_API_BASE"
  else
    base="$(resolve_backend_api_base)"
  fi
  validate_backend_api_base "$base" || die "Invalid BACKEND_API_BASE"
  chmod 400 "$ssh_key"
  log "Updating server env + PM2 (no build): BACKEND_API_BASE=${base}"
  scp "${ssh_opts[@]}" "${SCRIPT_DIR}/ecosystem.config.cjs" "${ssh_target}:${app_dir}/ecosystem.config.cjs"
  remote_finish "$base"
  log "Env-only deploy complete. Portal: ${portal_origin}"
}

case "$deploy_mode" in
  rsync)
    if [[ "${DEPLOY_ENV_ONLY:-}" == "1" ]]; then
      deploy_env_only
    else
      deploy_rsync
    fi
    ;;
  git) deploy_git ;;
  *) die "Unknown DEPLOY_MODE=${deploy_mode} (use rsync or git)" ;;
esac
