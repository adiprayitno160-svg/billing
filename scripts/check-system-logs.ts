import { NodeSSH } from 'node-ssh';

async function checkSystemLogs() {
  const ssh = new NodeSSH();
  
  try {
    console.log('Connecting...');
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });

    console.log('Checking recent system_logs for /settings/company:');
    // Query system_logs table
    const result = await ssh.execCommand('mysql -u root -padi billing -e "SELECT id, log_level, message, context, created_at FROM system_logs WHERE message LIKE \'%/settings/company%\' ORDER BY created_at DESC LIMIT 10;"', { cwd: '/var/www/billing' });
    console.log(result.stdout);
    if (result.stderr) console.error(result.stderr);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    ssh.dispose();
  }
}

checkSystemLogs();
