import { NodeSSH } from 'node-ssh';

async function checkPidOwner() {
  const ssh = new NodeSSH();
  
  try {
    console.log('Connecting...');
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });

    console.log('Checking PID 136729 parent and owner:');
    const result = await ssh.execCommand('ps -f -p 136729', { cwd: '/var/www/billing' });
    console.log(result.stdout);
    
    console.log('Checking all processes for "server.js":');
    const result2 = await ssh.execCommand('ps -ef | grep server.js', { cwd: '/var/www/billing' });
    console.log(result2.stdout);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    ssh.dispose();
  }
}

checkPidOwner();
