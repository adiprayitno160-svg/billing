module.exports = {
  apps: [{
    name: "billing-app",
    script: "./dist/server.js",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "1G",
    exp_backoff_restart_delay: 100,
    env: {
      NODE_ENV: "production",
      PORT: 3011,
      PUPPETEER_EXECUTABLE_PATH: "/home/adi/.cache/puppeteer/chrome/linux-144.0.7559.96/chrome-linux64/chrome"
    },

    PORT: 3011,
    error_file: "./logs/pm2-error.log",
    out_file: "./logs/pm2-out.log"
  }]
};
