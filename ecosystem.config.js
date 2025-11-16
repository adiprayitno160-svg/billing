module.exports = {
  apps: [{
    name: 'billing-app',
    script: 'src/server.ts',
    interpreter: 'node_modules/.bin/ts-node-dev',
    interpreter_args: '--respawn --transpile-only',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};









