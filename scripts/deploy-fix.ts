import { NodeSSH } from 'node-ssh';

async function deploy() {
  const ssh = new NodeSSH();
  
  try {
    console.log('Connecting to server...');
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });
    
    console.log('Pushing local changes (simulation via git on server)...');
    // Assuming we use git to deploy
    const result = await ssh.execCommand('cd /home/adi/billing && git pull origin main && npm install && npm run build && pm2 restart billing-app');
    
    console.log('STDOUT:', result.stdout);
    console.log('STDERR:', result.stderr);
    
    if (result.code === 0) {
      console.log('Deployment successful!');
    } else {
      console.error('Deployment failed with code:', result.code);
    }
    
  } catch (error) {
    console.error('Error during deployment:', error);
  } finally {
    ssh.dispose();
  }
}

deploy();
