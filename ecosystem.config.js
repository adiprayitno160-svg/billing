module.exports = {
  apps: [{
    name: "billing-app",
    // interpreter removed
    script: "npm", // Use npm to run dev script
    args: "run dev", // Executes ts-node-dev for live TS execution
    instances: 1,
    autorestart: true, // AUTO RESTART JIKE CRASH
    watch: false, // Jangan restart tiap ada file berubah (hemat resource)
    max_memory_restart: "1G", // Restart jika memory bocor
    exp_backoff_restart_delay: 100, // Delay pintar jika crash berulang
    env: {
      NODE_ENV: "production",
      PORT: 3001
    },
    error_file: "./logs/pm2-error.log",
    out_file: "./logs/pm2-out.log"
  }]
};
