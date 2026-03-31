import { NodeSSH } from 'node-ssh';

async function checkRemoteDb() {
  const ssh = new NodeSSH();
  
  try {
    console.log('Connecting...');
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });

    console.log('Checking remote company_settings table:');
    // Run mysql command on the server
    const result = await ssh.execCommand('mysql -u root -padi billing -e "SELECT id, company_name, updated_at FROM company_settings;"', { cwd: '/var/www/billing' });
    console.log(result.stdout);
    if (result.stderr) console.error(result.stderr);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    ssh.dispose();
  }
}

checkRemoteDb();
