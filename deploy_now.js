const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
async function deploy() {
  try {
    await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
    console.log('Connected to live server!');
    const res = await ssh.execCommand('cd /var/www/billing && git fetch && git reset --hard origin/main && npm install --omit=dev && npm run build && pm2 restart billing-app');
    console.log(res.stdout);
    if(res.stderr) console.error(res.stderr);
  } catch(e) {
    console.error(e);
  } finally {
    ssh.dispose();
  }
}
deploy();
