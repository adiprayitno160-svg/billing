const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
(async () => {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi', port: 22 });

        console.log("--- Checking customer Sudarmamik invoices ---");
        const dbResult = await ssh.execCommand(`echo "adi" | sudo -S mysql -e "SELECT c.id, c.name, i.id as inv_id, i.invoice_number, i.total_amount, i.remaining_amount, i.discount_amount, i.status, i.period, i.due_date FROM customers c JOIN invoices i ON c.id = i.customer_id WHERE c.name LIKE '%sudarma%' ORDER BY i.created_at DESC LIMIT 10;" billing`);
        console.log(dbResult.stdout);
        if (dbResult.stderr) console.error(dbResult.stderr);

        console.log("\n--- Checking late_payment_tracking for Sudarmamik ---");
        const lptResult = await ssh.execCommand(`echo "adi" | sudo -S mysql -e "SELECT lpt.* FROM late_payment_tracking lpt JOIN customers c ON lpt.customer_id = c.id WHERE c.name LIKE '%sudarma%' ORDER BY lpt.created_at DESC LIMIT 5;" billing`);
        console.log(lptResult.stdout);

        console.log("\n--- Checking discounts applied ---");
        const discResult = await ssh.execCommand(`echo "adi" | sudo -S mysql -e "SELECT d.*, i.invoice_number FROM discounts d JOIN invoices i ON d.invoice_id = i.id JOIN customers c ON i.customer_id = c.id WHERE c.name LIKE '%sudarma%' ORDER BY d.created_at DESC LIMIT 5;" billing`);
        console.log(discResult.stdout);

        ssh.dispose();
    } catch (e) {
        console.error(e);
    }
})();
