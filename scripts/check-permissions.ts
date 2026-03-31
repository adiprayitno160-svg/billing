import { NodeSSH } from 'node-ssh';

async function checkPermissions() {
  const ssh = new NodeSSH();
  
  try {
    console.log('Connecting...');
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });

    console.log('Checking uploads directory permissions:');
    const result = await ssh.execCommand('ls -ld public/uploads/company', { cwd: '/var/www/billing' });
    console.log(result.stdout);
    if (result.stderr) console.error(result.stderr);

    console.log('Checking whoami:');
    const result2 = await ssh.execCommand('whoami', { cwd: '/var/www/billing' });
    console.log(result2.stdout);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    ssh.dispose();
  }
}

checkPermissions();
