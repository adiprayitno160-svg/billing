module.exports = {
  apps: [{
    name: 'billing-app',
    script: 'src/server.ts',
    interpreter: 'node',
    interpreter_args: '--loader ts-node/esm --no-warnings',
    instances: 1,
    autorestart: true,
    watch: ['src', 'views'],
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
