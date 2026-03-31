import { NodeSSH } from 'node-ssh';

async function searchErrorLogs() {
  const ssh = new NodeSSH();
  
  try {
    console.log('Connecting...');
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });

    console.log('Searching for "Failed to save company settings" in logs...');
    const result = await ssh.execCommand('pm2 logs billing --lines 1000 --nostream | grep "Failed to save company settings"', { cwd: '/var/www/billing' });
    console.log(result.stdout);
    if (result.stderr) console.error(result.stderr);

    console.log('Searching for "[DEBUG]" in logs...');
    const result2 = await ssh.execCommand('pm2 logs billing --lines 1000 --nostream | grep "\[DEBUG\]"', { cwd: '/var/www/billing' });
    console.log(result2.stdout);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    ssh.dispose();
  }
}

searchErrorLogs();
