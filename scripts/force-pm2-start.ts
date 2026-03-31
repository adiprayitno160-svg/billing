import { NodeSSH } from 'node-ssh';

async function forcePm2Start() {
  const ssh = new NodeSSH();
  
  try {
    console.log('Connecting...');
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });

    console.log('Cleaning up PM2 and node processes...');
    await ssh.execCommand('pkill -f "dist/server.js"'); // Kill any orphans
    await ssh.execCommand('pm2 delete all'); // Clear PM2 state

    console.log('Starting with ecosystem.config.js...');
    const result = await ssh.execCommand('pm2 start ecosystem.config.js', { cwd: '/var/www/billing' });
    console.log('STDOUT:', result.stdout);
    console.log('STDERR:', result.stderr);

    console.log('PM2 List final:');
    const result2 = await ssh.execCommand('pm2 list');
    console.log(result2.stdout);

    console.log('Checking logs directory:');
    const result3 = await ssh.execCommand('mkdir -p logs && ls -la logs', { cwd: '/var/www/billing' });
    console.log(result3.stdout);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    ssh.dispose();
  }
}

forcePm2Start();
