const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

const script = `
require('dotenv').config({ path: '/var/www/billing/.env' });
const { getMikrotikConfig } = require('/var/www/billing/dist/utils/mikrotikConfigHelper');
const { getPppoeSecrets } = require('/var/www/billing/dist/services/mikrotikService');

async function run() {
    const config = await getMikrotikConfig();
    const secrets = await getPppoeSecrets(config);
    const target = secrets.find(s => s.name === "20250316135634@id.net" || s.name === "042200424012@id.net");
    console.log(secrets.filter(s => s.name === "20250316135634@id.net" || s.name === "042200424012@id.net"));
    process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
`;

async function main() {
  await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
  await ssh.execCommand(`cat << 'EOF' > /var/www/billing/check_mik_lalak.js\n${script}\nEOF`);
  const r = await ssh.execCommand('node /var/www/billing/check_mik_lalak.js', { cwd: '/var/www/billing' });
  console.log(r.stdout);
  console.log(r.stderr);
  ssh.dispose();
}

main();
