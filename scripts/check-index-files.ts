import { NodeSSH } from 'node-ssh';

async function checkIndexFiles() {
  const ssh = new NodeSSH();
  
  try {
    console.log('Connecting...');
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });

    console.log('Checking dist content:');
    const result = await ssh.execCommand('ls -R dist', { cwd: '/var/www/billing' });
    console.log(result.stdout);
    
    console.log('Checking pm2 status with port info?');
    const result2 = await ssh.execCommand('pm2 jlist', { cwd: '/var/www/billing' });
    console.log(result2.stdout);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    ssh.dispose();
  }
}

checkIndexFiles();
