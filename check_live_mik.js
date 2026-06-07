const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
async function check() {
  try {
    await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
    const res = await ssh.execCommand('cd /var/www/billing && node -e "const mk = require(\'./dist/services/mikrotikService\'); const p = require(\'./dist/services/pppoeService\'); p.getMikrotikConfig().then(c => mk.getPppoeActiveConnections(c)).then(act => console.log(\'Active Sessions:\', act.length, act.slice(0,5))).catch(console.error);"');
    console.log(res.stdout);
    if(res.stderr) console.error(res.stderr);
  } catch(e) {
    console.error(e);
  } finally {
    ssh.dispose();
  }
}
check();
