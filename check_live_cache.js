const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
async function check() {
  try {
    await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
    const res = await ssh.execCommand('cd /var/www/billing && node -e "const AMS = require(\'./dist/services/monitoring/AdvancedMonitoringService\').default; console.log(AMS.getCacheStats()); setTimeout(()=>process.exit(0), 1000);"');
    console.log(res.stdout);
    if(res.stderr) console.error(res.stderr);
  } catch(e) {
    console.error(e);
  } finally {
    ssh.dispose();
  }
}
check();
