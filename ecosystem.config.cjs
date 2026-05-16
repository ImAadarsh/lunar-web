/**
 * PM2 process definition for production. Run from the app root (same directory as this file).
 * Do not use `pm2 start npm -- run start` — PM2 must supervise the Node process directly.
 */
const fs = require("fs");
const path = require("path");

const appDir = __dirname;
const name = process.env.PROCESS_NAME || "lunar-web";
const port = String(process.env.PORT || "3000");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const fileEnv = {
  ...loadEnvFile(path.join(appDir, ".env.production")),
  ...loadEnvFile(path.join(appDir, ".env")),
};

module.exports = {
  apps: [
    {
      name,
      cwd: appDir,
      script: path.join(appDir, "node_modules/next/dist/bin/next"),
      args: ["start", "-H", "0.0.0.0", "-p", port],
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 15,
      min_uptime: "10s",
      exp_backoff_restart_delay: 200,
      kill_timeout: 8000,
      max_memory_restart: "900M",
      time: true,
      merge_logs: true,
      env: {
        NODE_ENV: "production",
        PORT: port,
        ...fileEnv,
      },
    },
  ],
};
