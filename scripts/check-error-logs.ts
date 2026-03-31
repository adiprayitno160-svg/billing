import { NodeSSH } from 'node-ssh';

async function checkErrorLogs() {
  const ssh = new NodeSSH();
  
  try {
    console.log('Connecting...');
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });

    console.log('Checking pm2-error.log content:');
    const result = await ssh.execCommand('tail -n 100 logs/pm2-error.log', { cwd: '/var/www/billing' });
    console.log(result.stdout);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    ssh.dispose();
  }
}

checkErrorLogs();
