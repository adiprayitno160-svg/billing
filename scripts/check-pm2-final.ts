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

    console.log('PM2 List:');
    const result = await ssh.execCommand('pm2 list', { cwd: '/var/www/billing' });
    console.log(result.stdout);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    ssh.dispose();
  }
}

checkPm2();
