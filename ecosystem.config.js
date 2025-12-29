module.exports = {
  apps: [{
    name: 'billing-app',
    script: 'dist/server.js',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
      PORT: 3001
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001,
      // Chromium path for Ubuntu server
      PUPPETEER_EXECUTABLE_PATH: '/usr/bin/chromium-browser'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    // Increased to prevent crash loop restart
    max_restarts: 5,
    // Minimum uptime before considering app stable (prevents rapid restart cycles)
    min_uptime: '30s',
    // Restart delay to avoid immediate restart on crash
    restart_delay: 5000,
    // Kill timeout before forcing process termination
    kill_timeout: 5000,
    // Wait for app to be ready before considering it started
    wait_ready: true,
    // Listen timeout
    listen_timeout: 10000,
    // Exponential backoff restart delay
    exp_backoff_restart_delay: 100
  }]
};










