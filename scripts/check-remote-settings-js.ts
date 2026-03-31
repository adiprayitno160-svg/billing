import { NodeSSH } from 'node-ssh';

async function checkRemoteSettingsJs() {
  const ssh = new NodeSSH();
  
  try {
    console.log('Connecting...');
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });

    console.log('Checking dist/routes/settings.js content for companyStorage:');
    const result = await ssh.execCommand('grep -C 20 "companyStorage" dist/routes/settings.js', { cwd: '/var/www/billing' });
    console.log(result.stdout);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    ssh.dispose();
  }
}

checkRemoteSettingsJs();
