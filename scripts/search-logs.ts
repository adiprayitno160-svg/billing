import { NodeSSH } from 'node-ssh';

async function searchLogs() {
  const ssh = new NodeSSH();
  
  try {
    console.log('Connecting...');
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });

    console.log('Searching for saveSettings in logs...');
    // Search for the debug string in PM2 logs
    const result = await ssh.execCommand('pm2 logs billing --lines 1000 --nostream | grep "saveSettings"', { cwd: '/var/www/billing' });
    console.log(result.stdout);
    if (result.stderr) console.error(result.stderr);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    ssh.dispose();
  }
}

searchLogs();
