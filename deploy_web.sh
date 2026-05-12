#!/usr/bin/env bash
set -euo pipefail

ssh_key="${SSH_KEY:-/Applications/XAMPP/xamppfiles/htdocs/zaam/zaam-api/zaam-erp.pem}"
ssh_user="${SSH_USER:-ubuntu}"
ssh_host="${SSH_HOST:-ec2-13-206-209-4.ap-south-1.compute.amazonaws.com}"
app_dir="${APP_DIR:-/var/www/lunar-web}"
repo_url="${REPO_URL:-https://github.com/ImAadarsh/lunar-web.git}"
branch="${BRANCH:-main}"
process_name="${PROCESS_NAME:-lunar-web}"
port="${PORT:-3000}"
backend_api_base="${BACKEND_API_BASE:-https://lunar.endeavourdigital.cloud/api/v1}"
google_maps_api_key="${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:-AIzaSyAg9eHoFx4kW3MBy2FLazMJQa6UPdKqj_A}"

chmod 400 "$ssh_key"

ssh \
  -i "$ssh_key" \
  -o BatchMode=yes \
  -o StrictHostKeyChecking=accept-new \
  -o ConnectTimeout=20 \
  "${ssh_user}@${ssh_host}" \
  "APP_DIR='$app_dir' REPO_URL='$repo_url' BRANCH='$branch' PROCESS_NAME='$process_name' PORT='$port' BACKEND_API_BASE='$backend_api_base' NEXT_PUBLIC_GOOGLE_MAPS_API_KEY='$google_maps_api_key' bash -s" <<'REMOTE_DEPLOY'
set -euo pipefail

export GIT_TERMINAL_PROMPT=0

if ! command -v git >/dev/null 2>&1; then
  sudo apt-get update
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y git
fi

if ! command -v curl >/dev/null 2>&1; then
  sudo apt-get update
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y curl
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
  sudo mkdir -p "$APP_DIR"
  sudo chown -R "$USER":"$USER" "$APP_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  sudo chown -R "$USER":"$USER" "$APP_DIR"
fi

cd "$APP_DIR"

# This script may be copied to the server manually. If the repo tracks it later,
# remove any stale untracked copy so git pull can fast-forward cleanly.
if [ -e deploy_web.sh ] && ! git ls-files --error-unmatch deploy_web.sh >/dev/null 2>&1; then
  rm -f deploy_web.sh
fi

# Logo fallback was hotfixed directly on the first server deploy. If GitHub now
# tracks the same files, discard only that server-side hotfix so pull can apply
# the canonical repo version.
if ! git diff --quiet -- src/app/api/assets/logo/route.ts; then
  git checkout -- src/app/api/assets/logo/route.ts
fi
if [ -e public/lunar-logo.svg ] && ! git ls-files --error-unmatch public/lunar-logo.svg >/dev/null 2>&1; then
  rm -f public/lunar-logo.svg
fi

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

cat > .env.production <<ENV
BACKEND_API_BASE=$BACKEND_API_BASE
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ENV

npm ci
npm run build

export APP_DIR PORT PROCESS_NAME

# Run Next under PM2 directly (not via npm) so crashes/OOM are detected and the process is supervised reliably.
if pm2 describe "$PROCESS_NAME" >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi

pm2 save

if ! systemctl is-enabled "pm2-${USER}.service" >/dev/null 2>&1; then
  echo "WARNING: PM2 is not registered with systemd — the app will not come back after a server reboot (502 until manual start)." >&2
  echo "Fix once on the server: sudo env PATH=\"\$PATH\" \"\$(command -v pm2)\" startup systemd -u \"\$USER\" --hp \"\$HOME\"" >&2
fi

sleep 2
if ! curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null; then
  echo "ERROR: post-deploy health check failed for http://127.0.0.1:${PORT}/api/health" >&2
  pm2 logs "$PROCESS_NAME" --lines 80 --nostream || true
  exit 1
fi

pm2 status
REMOTE_DEPLOY
