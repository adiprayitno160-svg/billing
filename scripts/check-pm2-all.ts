import { NodeSSH } from 'node-ssh';

async function checkPm2() {
  const ssh = new NodeSSH();
  
  try {
    console.log('Connecting...');
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });

    console.log('PM2 List (all):');
    const result = await ssh.execCommand('pm2 list', { cwd: '/var/www/billing' });
    console.log(result.stdout);
    
    console.log('PS aux | grep node:');
    const result2 = await ssh.execCommand('ps aux | grep node', { cwd: '/var/www/billing' });
    console.log(result2.stdout);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    ssh.dispose();
  }
}

checkPm2();
