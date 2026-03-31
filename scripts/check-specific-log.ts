import { NodeSSH } from 'node-ssh';

async function checkSpecificLog() {
  const ssh = new NodeSSH();
  
  try {
    console.log('Connecting...');
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });

    console.log('Checking full log for requestId req-1773426296794-5l57nucx6:');
    const result = await ssh.execCommand('mysql -u root -padi billing -e "SELECT * FROM system_logs WHERE request_id = \'req-1773426296794-5l57nucx6\';"', { cwd: '/var/www/billing' });
    console.log(result.stdout);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    ssh.dispose();
  }
}

checkSpecificLog();
