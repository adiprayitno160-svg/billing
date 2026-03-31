import { NodeSSH } from 'node-ssh';

async function checkPidPath() {
  const ssh = new NodeSSH();
  
  try {
    console.log('Connecting...');
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });

    console.log('Checking PID 136729 location:');
    const result = await ssh.execCommand('ls -l /proc/136729/cwd', { cwd: '/var/www/billing' });
    console.log(result.stdout);
    
    console.log('Checking process command:');
    const result2 = await ssh.execCommand('ps -p 136729 -o args', { cwd: '/var/www/billing' });
    console.log(result2.stdout);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    ssh.dispose();
  }
}

checkPidPath();
