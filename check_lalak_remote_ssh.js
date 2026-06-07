const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

const script = `
require('dotenv').config({ path: '/var/www/billing/.env' });
const { databasePool } = require('/var/www/billing/dist/db/pool');

async function run() {
    const [customers] = await databasePool.query('SELECT id, name, pppoe_username, is_isolated, status FROM customers WHERE name LIKE "%lalak%" OR name LIKE "%eva%"');
    console.log(customers);
    process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
`;

async function main() {
  await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
  await ssh.execCommand(`cat << 'EOF' > /var/www/billing/check_lalak_remote.js\n${script}\nEOF`);
  const r = await ssh.execCommand('node /var/www/billing/check_lalak_remote.js', { cwd: '/var/www/billing' });
  console.log(r.stdout);
  console.log(r.stderr);
  ssh.dispose();
}

main();
