import { NodeSSH } from 'node-ssh';

async function checkBillingProcess() {
  const ssh = new NodeSSH();
  
  try {
    console.log('Connecting...');
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });

    console.log('Searching for billing process:');
    const result = await ssh.execCommand('ps aux | grep billing', { cwd: '/var/www/billing' });
    console.log(result.stdout);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    ssh.dispose();
  }
}

checkBillingProcess();
