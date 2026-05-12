/**
 * PM2 process definition for production. Run from the app root (same directory as this file).
 * Do not use `pm2 start npm -- run start` — PM2 must supervise the Node process directly.
 */
const path = require("path");

const appDir = __dirname;
const name = process.env.PROCESS_NAME || "lunar-web";
const port = String(process.env.PORT || "3000");

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
      },
    },
  ],
};
