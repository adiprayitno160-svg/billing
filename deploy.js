const { NodeSSH } = require('node-ssh');

const ssh = new NodeSSH();

async function deploy() {
  try {
    console.log('Connecting to server...');
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });
    console.log('Connected!');

    // Find the billing folder
    console.log('Searching for billing directory...');
    const findResult = await ssh.execCommand('find /home /var/www /opt -maxdepth 3 -type d -name "billing" -print 2>/dev/null');
    
    let targetDir = '';
    if (findResult.stdout) {
      const paths = findResult.stdout.split('\n').filter(p => p.trim() !== '');
      if (paths.length > 0) {
        targetDir = paths[0];
      }
    }

    if (!targetDir) {
      console.error('Could not find billing directory on the server.');
      process.exit(1);
    }

    console.log(`Found billing directory at: ${targetDir}`);

    // Run deployment commands
    console.log('Running git pull...');
    const pullResult = await ssh.execCommand('git pull origin main', { cwd: targetDir });
    console.log(pullResult.stdout);
    if (pullResult.stderr) console.log(pullResult.stderr);

    console.log('Running npm run build...');
    const buildResult = await ssh.execCommand('npm run build', { cwd: targetDir });
    console.log(buildResult.stdout);
    if (buildResult.stderr) console.log(buildResult.stderr);

    console.log('Restarting PM2...');
    const restartResult = await ssh.execCommand('npm run pm2:restart', { cwd: targetDir });
    console.log(restartResult.stdout);
    if (restartResult.stderr) console.log(restartResult.stderr);

    console.log('Deployment completed successfully!');
  } catch (error) {
    console.error('Deployment failed:', error);
  } finally {
    ssh.dispose();
  }
}

deploy();
