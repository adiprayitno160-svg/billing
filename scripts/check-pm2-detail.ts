import { NodeSSH } from 'node-ssh';

async function checkPm2Detail() {
  const ssh = new NodeSSH();
  
  try {
    console.log('Connecting...');
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });

    console.log('PM2 Describe billing:');
    const result = await ssh.execCommand('pm2 describe billing', { cwd: '/var/www/billing' });
    console.log(result.stdout);
    
    console.log('PM2 List (adi user):');
    const result2 = await ssh.execCommand('pm2 list', { cwd: '/var/www/billing' });
    console.log(result2.stdout);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    ssh.dispose();
  }
}

checkPm2Detail();
