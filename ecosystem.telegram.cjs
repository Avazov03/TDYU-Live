module.exports = {
  apps: [
    {
      name: "lexify-telegram",
      cwd: "/var/www/tdyu-live",
      script: "npm",
      args: "run bot:telegram",
      interpreter: "none",
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "200M",
      autorestart: true,
    },
  ],
};
