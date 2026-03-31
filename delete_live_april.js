const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function deleteInvoices() {
  try {
    console.log('Connecting to SSH...');
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });
    console.log('Connected to Live Server via SSH.');

    // Step 1: Query the IDs
    const fetchCmd = `mysql -u root -padi billing -e "SELECT id FROM invoices WHERE period LIKE '%-04';" -B -N`;
    console.log('Fetching April invoice IDs...');
    const result = await ssh.execCommand(fetchCmd);
    
    if (result.stderr && !result.stderr.includes('Warning')) {
        console.error('STDERR:', result.stderr);
    }
    
    const ids = result.stdout.split('\n').map(id => id.trim()).filter(id => id !== '');
    
    if (ids.length === 0) {
        console.log('No April invoices found!');
        ssh.dispose();
        return;
    }
    
    console.log(`Found ${ids.length} April invoices: `, ids.join(', '));
    
    // Construct DELETE queries
    const idList = ids.join(',');
    
    const deleteQueries = `
      SET FOREIGN_KEY_CHECKS=0;
      DELETE FROM payments WHERE invoice_id IN (${idList});
      DELETE FROM invoice_items WHERE invoice_id IN (${idList});
      DELETE FROM discounts WHERE invoice_id IN (${idList});
      DELETE FROM debt_tracking WHERE invoice_id IN (${idList});
      DELETE FROM unified_notifications_queue WHERE invoice_id IN (${idList});
      DELETE FROM invoices WHERE id IN (${idList});
      SET FOREIGN_KEY_CHECKS=1;
    `;
    
    console.log('Executing deletion queries...');
    const deleteCmd = `mysql -u root -padi billing -e "${deleteQueries.replace(/\n/g, ' ')}"`;
    const deleteResult = await ssh.execCommand(deleteCmd);
    
    if(deleteResult.stderr && !deleteResult.stderr.includes('Warning')) {
        console.error('Delete STDERR:', deleteResult.stderr);
    }
    
    console.log('Checking remaining April invoices...');
    const check = await ssh.execCommand(`mysql -u root -padi billing -e "SELECT COUNT(*) as april_count FROM invoices WHERE period LIKE '%-04';" -B -N`);
    console.log('Remaining count:', check.stdout);

    ssh.dispose();
    console.log('Done.');
  } catch (err) {
    console.error('Error:', err);
    ssh.dispose();
  }
}

deleteInvoices();
