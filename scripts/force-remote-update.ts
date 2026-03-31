import { NodeSSH } from 'node-ssh';

async function forceUpdate() {
  const ssh = new NodeSSH();
  
  try {
    console.log('Connecting...');
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });

    console.log('Forcing update of company_name to "DOM TEST":');
    const result = await ssh.execCommand('mysql -u root -padi billing -e "UPDATE company_settings SET company_name = \'DOM TEST\', updated_at = CURRENT_TIMESTAMP WHERE id = 1;"', { cwd: '/var/www/billing' });
    console.log(result.stdout);
    if (result.stderr) console.error(result.stderr);

    console.log('Verifying update:');
    const result2 = await ssh.execCommand('mysql -u root -padi billing -e "SELECT id, company_name, updated_at FROM company_settings WHERE id = 1;"', { cwd: '/var/www/billing' });
    console.log(result2.stdout);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    ssh.dispose();
  }
}

forceUpdate();
