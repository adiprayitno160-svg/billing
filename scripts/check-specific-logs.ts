import { NodeSSH } from 'node-ssh';

async function checkSpecificLogs() {
  const ssh = new NodeSSH();
  
  try {
    console.log('Connecting...');
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });

    console.log('Tailing logs for PM2 ID 14 (billing):');
    const result = await ssh.execCommand('pm2 logs 14 --lines 100 --nostream', { cwd: '/var/www/billing' });
    console.log(result.stdout);
    if (result.stderr) console.error(result.stderr);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    ssh.dispose();
  }
}

checkSpecificLogs();
