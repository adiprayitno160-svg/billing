import { NodeSSH } from 'node-ssh';

async function checkLogSchema() {
  const ssh = new NodeSSH();
  
  try {
    console.log('Connecting...');
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });

    console.log('Checking system_logs columns:');
    const result = await ssh.execCommand('mysql -u root -padi billing -e "SHOW COLUMNS FROM system_logs;"', { cwd: '/var/www/billing' });
    console.log(result.stdout);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    ssh.dispose();
  }
}

checkLogSchema();
