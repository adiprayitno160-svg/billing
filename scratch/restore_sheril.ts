
import { NodeSSH } from 'node-ssh';

const ssh = new NodeSSH();
const config = {
    host: '192.168.239.154',
    username: 'adi',
    password: 'adi'
};

async function restoreSheril() {
    try {
        await ssh.connect(config);
        
        console.log('--- Step 1: Locating Data ---');
        // Invoice 875, Payment 295
        const check = await ssh.execCommand('mysql -u root -padi billing -e "SELECT id, status, total_amount FROM invoices WHERE id = 875"');
        console.log('Invoice Info:', check.stdout);
        
        const checkP = await ssh.execCommand('mysql -u root -padi billing -e "SELECT id, amount FROM payments WHERE invoice_id = 875"');
        console.log('Payment Info:', checkP.stdout);

        console.log('\n--- Step 2: Deleting Payment Record ---');
        // We delete payment 295
        const delP = await ssh.execCommand('mysql -u root -padi billing -e "DELETE FROM payments WHERE invoice_id = 875"');
        console.log('Delete Payment Result:', delP.stdout || 'OK');

        console.log('\n--- Step 3: Reverting Invoice Status ---');
        // Update status to 'hutang' (as used for other unpaid April bills) and reset amounts
        const updI = await ssh.execCommand('mysql -u root -padi billing -e "UPDATE invoices SET status = \'hutang\', paid_amount = 0, remaining_amount = total_amount, paid_at = NULL, last_payment_date = NULL WHERE id = 875"');
        console.log('Update Invoice Result:', updI.stdout || 'OK');

        console.log('\n--- Step 4: Verification ---');
        const final = await ssh.execCommand('mysql -u root -padi billing -e "SELECT id, status, total_amount, paid_amount, remaining_amount FROM invoices WHERE id = 875"');
        console.log('Final Invoice State:', final.stdout);

        ssh.dispose();
    } catch (e) {
        console.error(e);
    }
}

restoreSheril();
