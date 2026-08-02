#!/usr/bin/env bash
# Deploy Lunar Security web (Next.js) to Zaam Hostinger VPS.
#
# Portal: https://dashboard.lunarsecurityltd.co.uk
# API:    https://api.lunarsecurityltd.co.uk/api/v1
#
# Edge: Traefik (:80/:443) → PM2 Next.js on :4002
# Auth: ~/.ssh/id_ed25519_hostinger (no password)
#
# Usage (from lunar_security_web/):
#   ./deploy_web.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

ssh_user="${SSH_USER:-root}"
ssh_host="${SSH_HOST:-153.92.209.187}"
ssh_key="${SSH_KEY:-$HOME/.ssh/id_ed25519_hostinger}"
app_dir="${APP_DIR:-/var/www/lunar-web}"
git_repo="${GIT_REPO:-git@github.com:ImAadarsh/lunar-web.git}"
branch="${BRANCH:-main}"
process_name="${PROCESS_NAME:-lunar-web}"
api_port="${PORT:-4002}"
domain="${WEB_DOMAIN:-dashboard.lunarsecurityltd.co.uk}"
traefik_dir="${TRAEFIK_DIR:-/docker/traefik-xtyj}"
backend_api_base="${BACKEND_API_BASE:-https://api.lunarsecurityltd.co.uk/api/v1}"
google_maps_api_key="${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:-AIzaSyAg9eHoFx4kW3MBy2FLazMJQa6UPdKqj_A}"
guard_recharge_hours="${NEXT_PUBLIC_GUARD_RECHARGE_HOURS:-8}"
portal_origin="https://${domain}"

ssh_target="${ssh_user}@${ssh_host}"
ssh_base_opts=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 -i "$ssh_key" -o IdentitiesOnly=yes -o BatchMode=yes)

log() { printf '==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[[ -f "$ssh_key" ]] || die "SSH key not found: ${ssh_key}"

remote() {
  ssh "${ssh_base_opts[@]}" "$ssh_target" "$@"
}

ensure_traefik_proxy() {
  log "Ensuring Traefik routes https://${domain} → 127.0.0.1:${api_port}…"
  remote "set -euo pipefail
mkdir -p '${traefik_dir}/dynamic'
cat > '${traefik_dir}/dynamic/lunar-web.yml' <<'YAML'
http:
  routers:
    lunar-web:
      rule: Host(\`${domain}\`)
      entryPoints:
        - websecure
      tls:
        certResolver: letsencrypt
      service: lunar-web
      priority: 10
  services:
    lunar-web:
      loadBalancer:
        servers:
          - url: http://127.0.0.1:${api_port}
YAML
cd '${traefik_dir}'
docker compose up -d
"
}

ensure_git_checkout() {
  log "Ensuring ${app_dir} is a git clone of ${git_repo} (${branch})…"
  remote "set -euo pipefail
export GIT_TERMINAL_PROMPT=0
if [ -d '${app_dir}/.git' ]; then
  cd '${app_dir}'
  git remote set-url origin '${git_repo}' || true
  git fetch --prune origin
  git checkout '${branch}'
  git reset --hard \"origin/${branch}\"
  echo \"Updated to \$(git rev-parse --short HEAD)\"
  exit 0
fi
ts=\$(date +%Y%m%d%H%M%S)
tmp=\"${app_dir}.git-new.\$ts\"
bak=\"${app_dir}.pre-git.\$ts\"
git clone --branch '${branch}' --single-branch '${git_repo}' \"\$tmp\"
if [ -d '${app_dir}' ]; then
  [ -f '${app_dir}/.env' ] && cp -a '${app_dir}/.env' \"\$tmp/.env\" || true
  [ -d '${app_dir}/.next' ] && mv '${app_dir}/.next' \"\$tmp/.next\" || true
  [ -d '${app_dir}/node_modules' ] && mv '${app_dir}/node_modules' \"\$tmp/node_modules\" || true
  mv '${app_dir}' \"\$bak\"
fi
mv \"\$tmp\" '${app_dir}'
echo \"Cloned fresh at ${app_dir}\"
"
}

ensure_server_env() {
  log "Writing production .env on server…"
  remote "set -euo pipefail
cat > '${app_dir}/.env' <<EOF
BACKEND_API_BASE=${backend_api_base}
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${google_maps_api_key}
NEXT_PUBLIC_GUARD_RECHARGE_HOURS=${guard_recharge_hours}
PORT=${api_port}
HOSTNAME=0.0.0.0
EOF
# Also materialize .env.production for next build
cp -a '${app_dir}/.env' '${app_dir}/.env.production'
grep -E '^(BACKEND_API_BASE|PORT|HOSTNAME|NEXT_PUBLIC_GUARD_RECHARGE_HOURS)=' '${app_dir}/.env'
"
}

ensure_backend_cors() {
  log "Ensuring backend CORS allows ${portal_origin}…"
  remote "set -euo pipefail
ENVF=/var/www/lunar-backend/.env
test -f \"\$ENVF\" || exit 0
if grep -q '^CORS_ORIGINS=' \"\$ENVF\"; then
  if ! grep -q '${portal_origin}' \"\$ENVF\"; then
    sed -i 's|^CORS_ORIGINS=\\(.*\\)|CORS_ORIGINS=\\1,${portal_origin}|' \"\$ENVF\"
  fi
else
  echo 'CORS_ORIGINS=${portal_origin}' >> \"\$ENVF\"
fi
grep '^CORS_ORIGINS=' \"\$ENVF\"
pm2 restart lunar-backend --update-env >/dev/null || true
"
}

build_and_restart() {
  log "Building Next.js and restarting PM2 (${process_name})…"
  remote "set -euo pipefail
cd '${app_dir}'
npm ci
npm run build
mkdir -p logs

if pm2 describe '${process_name}' >/dev/null 2>&1; then
  pm2 delete '${process_name}' >/dev/null || true
fi
# next start reads PORT from env / .env via PM2 ecosystem-less start
PORT='${api_port}' HOSTNAME=0.0.0.0 pm2 start npm --name '${process_name}' --time -- start
pm2 save
"
}

health_checks() {
  log "Waiting for local health on :${api_port}…"
  remote "set -e
for i in \$(seq 1 45); do
  # Next.js has no /health — treat HTTP 200/307/308 from / as up
  code=\$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 2 'http://127.0.0.1:${api_port}/' || echo 000)
  case \"\$code\" in
    200|301|302|307|308) echo \"Local OK (HTTP \$code)\"; exit 0 ;;
  esac
  sleep 1
done
echo 'Local web failed to become ready' >&2
pm2 logs '${process_name}' --lines 40 --nostream || true
exit 1
"

  log "Checking public HTTPS https://${domain}/ …"
  sleep 3
  code="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 20 "https://${domain}/" || echo 000)"
  case "$code" in
    200|301|302|307|308) log "Public HTTPS OK (HTTP ${code})." ;;
    *) log "WARN: public HTTPS returned HTTP ${code} (cert may still be issuing)." ;;
  esac

  log "Checking API login reachable from web host…"
  remote "code=\$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 12 -X POST '${backend_api_base}/auth/login' -H 'Content-Type: application/json' -d '{\"email\":\"deploy-probe@invalid.local\",\"password\":\"invalid\"}' || echo 000); echo \"API login probe HTTP \$code\"; test \"\$code\" = '401' -o \"\$code\" = '400'"

  log "Web deploy complete."
  log "Portal: https://${domain}"
  log "API:    ${backend_api_base}"
}

[[ "${1:-}" == "--help" ]] && { sed -n '2,16p' "$0"; exit 0; }

ensure_traefik_proxy
ensure_git_checkout
ensure_server_env
ensure_backend_cors
build_and_restart
health_checks
