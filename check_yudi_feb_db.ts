import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();
async function run() {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
        const sql = "SELECT i.id, i.invoice_number, i.total_amount, i.remaining_amount, i.status, (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = i.id) as items_count FROM invoices i JOIN customers c ON i.customer_id = c.id WHERE c.name LIKE '%Yudi%Santoso%' AND i.period = '2026-02';";
        const res = await ssh.execCommand(`mysql -u adi -padi billing -e "${sql}"`);
        console.log('--- REMOTE DB CHECK (Yudi Feb 2026) ---');
        console.log(res.stdout || 'NOT FOUND: ' + res.stderr);
        ssh.dispose();
    } catch (err: any) {
        console.error('Error:', err.message);
    }
}
run();
