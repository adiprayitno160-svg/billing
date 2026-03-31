import { NodeSSH } from 'node-ssh';

async function debug() {
  const ssh = new NodeSSH();
  
  try {
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });

    console.log('--- DEBUG CUSTOMER 90 (LALAK) ---');
    
    const runQuery = async (query: string) => {
      const result = await ssh.execCommand(`mysql -u root -padi billing -e "${query}" --json`);
      try {
        return JSON.parse(result.stdout);
      } catch (e) {
        // Fallback if --json is not supported or fails
        const textResult = await ssh.execCommand(`mysql -u root -padi billing -e "${query}"`);
        return textResult.stdout;
      }
    };

    const customer = await runQuery('SELECT * FROM customers WHERE id = 90');
    console.log('Customer:', customer);

    const pendingNotifs = await runQuery('SELECT id, notification_type, status, invoice_id, SUBSTRING(message, 1, 50) as msg_preview, created_at FROM unified_notifications_queue WHERE customer_id = 90 AND status = "pending"');
    console.log('Pending Notifications:', pendingNotifs);

    const invoices = await runQuery('SELECT id, invoice_number, status, period FROM invoices WHERE customer_id = 90');
    console.log('Invoices:', invoices);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    ssh.dispose();
  }
}

debug();
