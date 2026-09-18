module.exports = {
  apps: [
    {
      name: "lexify-telegram",
      cwd: "/var/www/tdyu-live",
      script: "npx",
      args: "tsx scripts/telegram-poll.ts",
      interpreter: "none",
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "200M",
      autorestart: true,
    },
  ],
};
