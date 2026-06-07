const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
async function check() {
  try {
    await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
    const res = await ssh.execCommand('pm2 logs billing-app --lines 200 --nostream | grep -i "Failed to get PPPoE sessions"');
    console.log("PPPoE Errors:", res.stdout);
    
    const res2 = await ssh.execCommand('pm2 logs billing-app --lines 200 --nostream | grep -i "Error"');
    console.log("All Errors:", res2.stdout);
    if(res.stderr) console.error(res.stderr);
  } catch(e) {
    console.error(e);
  } finally {
    ssh.dispose();
  }
}
check();
