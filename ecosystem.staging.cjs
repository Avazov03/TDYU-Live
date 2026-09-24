/**
 * Lexify staging PM2 app (port 3101).
 * Does NOT manage production `tdyu-live`.
 * Flags come from `/var/www/tdyu-live-staging/.env` via start-staging.sh.
 *
 * Preferred start (avoids PM2 treating this file as a script):
 *   pm2 start ./start-staging.sh --name tdyu-live-staging --interpreter bash
 *
 * Or ecosystem:
 *   pm2 start ecosystem.staging.cjs --only tdyu-live-staging
 */
module.exports = {
  apps: [
    {
      name: "tdyu-live-staging",
      cwd: "/var/www/tdyu-live-staging",
      script: "./start-staging.sh",
      interpreter: "bash",
      env: {
        NODE_ENV: "production",
        PORT: "3101",
      },
      max_memory_restart: "400M",
      autorestart: true,
    },
  ],
};
