import { NodeSSH } from 'node-ssh';

async function readRemoteDist() {
  const ssh = new NodeSSH();
  
  try {
    console.log('Connecting...');
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });

    console.log('Reading dist file for saveSettings logic...');
    // Use grep to find the location in the compiled JS
    const result = await ssh.execCommand('grep -n "saveSettings" dist/controllers/settings/companyController.js', { cwd: '/var/www/billing' });
    console.log(result.stdout);
    
    // Read around where it looks like saveSettings is
    const result2 = await ssh.execCommand('grep -C 10 "\[DEBUG\] saveSettings" dist/controllers/settings/companyController.js', { cwd: '/var/www/billing' });
    console.log(result2.stdout);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    ssh.dispose();
  }
}

readRemoteDist();
