const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

const script = `
const { getMikrotikConfig } = require('/var/www/billing/dist/utils/mikrotikConfigHelper');
const { updatePppoeSecret, removeActivePppConnection } = require('/var/www/billing/dist/services/mikrotikService');
const { databasePool } = require('/var/www/billing/dist/db/pool');

async function run() {
    const [customers] = await databasePool.query('SELECT pppoe_username FROM customers WHERE name LIKE "%lalak%" LIMIT 1');
    if (customers.length > 0) {
        const username = customers[0].pppoe_username;
        console.log('Disabling PPPoE for:', username);
        const config = await getMikrotikConfig();
        await updatePppoeSecret(config, username, { disabled: 'yes' });
        await removeActivePppConnection(config, username);
        console.log('Disabled successfully');
    } else {
        console.log('Customer not found');
    }
    process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
`;

async function main() {
  await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
  await ssh.execCommand(`cat << 'EOF' > /var/www/billing/disable_lalak.js\n${script}\nEOF`);
  const r = await ssh.execCommand('node /var/www/billing/disable_lalak.js');
  console.log(r.stdout);
  console.log(r.stderr);
  ssh.dispose();
}

main();
