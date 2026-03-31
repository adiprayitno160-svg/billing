import { NodeSSH } from 'node-ssh';

async function checkRemoteControllerJs() {
  const ssh = new NodeSSH();
  
  try {
    console.log('Connecting...');
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });

    console.log('Checking dist/controllers/settings/companyController.js content:');
    const result = await ssh.execCommand('grep "saveSettings" dist/controllers/settings/companyController.js -C 5', { cwd: '/var/www/billing' });
    console.log(result.stdout);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    ssh.dispose();
  }
}

checkRemoteControllerJs();
