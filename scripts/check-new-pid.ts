import { NodeSSH } from 'node-ssh';

async function checkSpecificPid() {
  const ssh = new NodeSSH();
  
  try {
    console.log('Connecting...');
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });

    console.log('Checking PID 225867 Details:');
    const result = await ssh.execCommand('ps -fp 225867', { cwd: '/var/www/billing' });
    console.log(result.stdout);

    console.log('Checking all node processes:');
    const result2 = await ssh.execCommand('ps aux | grep node', { cwd: '/var/www/billing' });
    console.log(result2.stdout);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    ssh.dispose();
  }
}

checkSpecificPid();
