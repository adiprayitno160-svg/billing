import { NodeSSH } from 'node-ssh';

async function checkResponseLogs() {
  const ssh = new NodeSSH();
  
  try {
    console.log('Connecting...');
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });

    console.log('Checking logs for response entries:');
    const result = await ssh.execCommand('mysql -u root -padi billing -e "SELECT id, log_level, message, context, created_at FROM system_logs WHERE id >= 1507149 ORDER BY id ASC LIMIT 20;"', { cwd: '/var/www/billing' });
    console.log(result.stdout);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    ssh.dispose();
  }
}

checkResponseLogs();
