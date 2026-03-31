import { NodeSSH } from 'node-ssh';

async function checkFile() {
  const ssh = new NodeSSH();
  
  try {
    console.log('Connecting...');
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });

    console.log('Checking companyController.ts content...');
    const result = await ssh.execCommand('grep -n "[DEBUG] saveSettings" src/controllers/settings/companyController.ts', { cwd: '/var/www/billing' });
    console.log(result.stdout);
    if (result.stderr) console.error(result.stderr);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    ssh.dispose();
  }
}

checkFile();
