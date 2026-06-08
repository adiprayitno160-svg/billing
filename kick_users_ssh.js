const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

const script = `
require('dotenv').config({ path: '/var/www/billing/.env' });
const { getMikrotikConfig } = require('/var/www/billing/dist/utils/mikrotikConfigHelper');
const { removeActivePppConnection } = require('/var/www/billing/dist/services/mikrotikService');

async function run() {
    const config = await getMikrotikConfig();
    console.log('Kicking Lalak...');
    await removeActivePppConnection(config, "20250316135634@id.net");
    console.log('Kicking Eva...');
    await removeActivePppConnection(config, "042200424012@id.net");
    console.log('Done.');
    process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
`;

async function main() {
  await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
  await ssh.execCommand(`cat << 'EOF' > /var/www/billing/kick_users.js\n${script}\nEOF`);
  const r = await ssh.execCommand('node /var/www/billing/kick_users.js', { cwd: '/var/www/billing' });
  console.log(r.stdout);
  console.log(r.stderr);
  ssh.dispose();
}

main();
