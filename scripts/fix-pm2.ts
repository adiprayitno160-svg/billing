import { NodeSSH } from 'node-ssh';

async function fixPm2() {
  const ssh = new NodeSSH();
  
  try {
    console.log('Connecting...');
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });

    console.log('Stopping rogue node processes...');
    await ssh.execCommand('pkill -f "dist/server.js"', { cwd: '/var/www/billing' });

    console.log('Registering with PM2 using ecosystem.config.js...');
    const result = await ssh.execCommand('pm2 start ecosystem.config.js', { cwd: '/var/www/billing' });
    console.log(result.stdout);
    if (result.stderr) console.error(result.stderr);

    console.log('PM2 List:');
    const result2 = await ssh.execCommand('pm2 list', { cwd: '/var/www/billing' });
    console.log(result2.stdout);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    ssh.dispose();
  }
}

fixPm2();
