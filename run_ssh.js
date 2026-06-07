const { NodeSSH } = require('node-ssh');

const ssh = new NodeSSH();
const cmd = process.argv.slice(2).join(' ');

async function run() {
  try {
    await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
    const findResult = await ssh.execCommand('find /home /var/www /opt -maxdepth 3 -type d -name "billing" -print 2>/dev/null');
    const paths = findResult.stdout.split('\n').filter(p => p.trim() !== '');
    if (paths.length === 0) { console.error('No billing dir'); process.exit(1); }
    const targetDir = paths[0];

    console.log(`Running in ${targetDir}: ${cmd}`);
    const result = await ssh.execCommand(cmd, { cwd: targetDir });
    console.log('STDOUT:\n', result.stdout);
    if (result.stderr) console.log('STDERR:\n', result.stderr);
  } catch (error) {
    console.error(error);
  } finally {
    ssh.dispose();
  }
}

if (!cmd) {
  console.error("Usage: node run_ssh.js <command>");
  process.exit(1);
}

run();
