import { NodeSSH } from 'node-ssh';

async function checkPorts() {
  const ssh = new NodeSSH();
  
  try {
    console.log('Connecting...');
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });

    console.log('Ports listening:');
    const result = await ssh.execCommand('netstat -tpln | grep 3002', { cwd: '/var/www/billing' });
    console.log(result.stdout);
    
    console.log('Processes listening on 3002:');
    const result2 = await ssh.execCommand('lsof -i :3002', { cwd: '/var/www/billing' });
    console.log(result2.stdout);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    ssh.dispose();
  }
}

checkPorts();
