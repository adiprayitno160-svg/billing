const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function fixMarchInvoices() {
  try {
    console.log('Connecting to SSH...');
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });
    console.log('Connected to Live Server via SSH.');

    // Step 1: Cari invoice Maret yang statusnya berubah jadi 'paid' karena carry-over ke April
    console.log('\n=== Step 1: Cari invoice Maret yang terkena carry-over ===');
    const findCmd = `mysql -u root -padi billing -e "SELECT id, invoice_number, customer_id, period, status, total_amount, paid_amount, remaining_amount, notes FROM invoices WHERE notes LIKE '%CARRIED OVER%' AND period = '2026-03';" -B -N`;
    const findResult = await ssh.execCommand(findCmd);
    
    if (findResult.stderr && !findResult.stderr.includes('Warning')) {
      console.error('STDERR:', findResult.stderr);
    }
    
    const lines = findResult.stdout.split('\n').filter(l => l.trim() !== '');
    console.log(`Ditemukan ${lines.length} invoice Maret yang terkena carry-over`);
    
    if (lines.length > 0) {
      // Parse the IDs
      const ids = lines.map(line => line.split('\t')[0]);
      console.log('IDs:', ids.join(', '));
      
      // Step 2: Kembalikan status invoice tersebut ke status aslinya
      console.log('\n=== Step 2: Kembalikan status invoice Maret ===');
      const idList = ids.join(',');
      
      // Update: kembalikan status ke 'sent' (terkirim/belum bayar) dan kembalikan remaining_amount = total_amount - paid_amount
      const fixQuery = `
        UPDATE invoices 
        SET status = CASE 
          WHEN paid_amount > 0 AND paid_amount < total_amount THEN 'partial'
          WHEN paid_amount >= total_amount THEN 'paid'
          ELSE 'sent'
        END,
        remaining_amount = GREATEST(0, total_amount - paid_amount),
        notes = REPLACE(notes, SUBSTRING(notes, LOCATE('[CARRIED OVER', notes)), '')
        WHERE id IN (${idList});
      `;
      
      const fixCmd = `mysql -u root -padi billing -e "${fixQuery.replace(/\n/g, ' ')}"`;
      const fixResult = await ssh.execCommand(fixCmd);
      
      if (fixResult.stderr && !fixResult.stderr.includes('Warning')) {
        console.error('Fix STDERR:', fixResult.stderr);
      }
      console.log('Fix STDOUT:', fixResult.stdout);
    }

    // Step 3: Cari SEMUA invoice yang punya catatan carry-over (bukan hanya Maret)
    console.log('\n=== Step 3: Cari semua invoice dengan catatan carry-over ke April ===');
    const findAllCmd = `mysql -u root -padi billing -e "SELECT id, invoice_number, period, status, total_amount, paid_amount, remaining_amount FROM invoices WHERE notes LIKE '%CARRIED OVER to Period 2026-04%';" -B -N`;
    const findAllResult = await ssh.execCommand(findAllCmd);
    
    if (findAllResult.stderr && !findAllResult.stderr.includes('Warning')) {
      console.error('STDERR:', findAllResult.stderr);
    }
    
    const allLines = findAllResult.stdout.split('\n').filter(l => l.trim() !== '');
    console.log(`Ditemukan ${allLines.length} invoice lain yang carry-over ke April`);
    
    if (allLines.length > 0) {
      const allIds = allLines.map(line => line.split('\t')[0]);
      console.log('IDs:', allIds.join(', '));
      
      const allIdList = allIds.join(',');
      const fixAllQuery = `
        UPDATE invoices 
        SET status = CASE 
          WHEN paid_amount > 0 AND paid_amount < total_amount THEN 'partial'
          WHEN paid_amount >= total_amount THEN 'paid'
          ELSE 'sent'
        END,
        remaining_amount = GREATEST(0, total_amount - paid_amount),
        notes = REPLACE(notes, SUBSTRING(notes, LOCATE('[CARRIED OVER', notes)), '')
        WHERE id IN (${allIdList});
      `;
      
      const fixAllCmd = `mysql -u root -padi billing -e "${fixAllQuery.replace(/\n/g, ' ')}"`;
      const fixAllResult = await ssh.execCommand(fixAllCmd);
      
      if (fixAllResult.stderr && !fixAllResult.stderr.includes('Warning')) {
        console.error('Fix All STDERR:', fixAllResult.stderr);
      }
      console.log('Fix All STDOUT:', fixAllResult.stdout);
    }

    // Step 4: Juga perbaiki debt_tracking yang statusnya diubah jadi 'applied' karena April
    console.log('\n=== Step 4: Perbaiki debt_tracking ===');
    const fixDebtCmd = `mysql -u root -padi billing -e "UPDATE debt_tracking SET status = 'active' WHERE status = 'applied' AND invoice_id IN (SELECT id FROM invoices WHERE period = '2026-03' AND status != 'paid');" 2>&1 | grep -v Warning`;
    const fixDebtResult = await ssh.execCommand(fixDebtCmd);
    console.log('Debt fix result:', fixDebtResult.stdout);

    // Step 5: Juga perbaiki carry_over_invoices
    console.log('\n=== Step 5: Perbaiki carry_over_invoices ===');
    const fixCarryCmd = `mysql -u root -padi billing -e "UPDATE carry_over_invoices SET status = 'pending' WHERE status = 'applied' AND target_period = '2026-04';" 2>&1 | grep -v Warning`;
    const fixCarryResult = await ssh.execCommand(fixCarryCmd);
    console.log('Carry-over fix result:', fixCarryResult.stdout);

    // Step 6: Verifikasi - Cek status invoice Maret sekarang
    console.log('\n=== Step 6: Verifikasi - Status invoice Maret ===');
    const verifyCmd = `mysql -u root -padi billing -e "SELECT status, COUNT(*) as jumlah FROM invoices WHERE period = '2026-03' GROUP BY status;" -B -N`;
    const verifyResult = await ssh.execCommand(verifyCmd);
    console.log('Status invoice Maret saat ini:');
    console.log(verifyResult.stdout);

    // Step 7: Cek khusus Teo Ady
    console.log('\n=== Step 7: Cek invoice Teo Ady (customer_id = 131) ===');
    const teoCmd = `mysql -u root -padi billing -e "SELECT i.id, i.invoice_number, i.period, i.status, i.total_amount, i.paid_amount, i.remaining_amount, i.notes FROM invoices i WHERE i.customer_id = 131 ORDER BY i.period DESC;" -B -N`;
    const teoResult = await ssh.execCommand(teoCmd);
    console.log('Invoice Teo Ady:');
    console.log(teoResult.stdout);

    // Step 8: Cek payment Teo Ady
    console.log('\n=== Step 8: Cek payments Teo Ady ===');
    const teoPmtCmd = `mysql -u root -padi billing -e "SELECT p.id, p.invoice_id, p.amount, p.payment_method, p.payment_date, p.notes FROM payments p JOIN invoices i ON p.invoice_id = i.id WHERE i.customer_id = 131 ORDER BY p.payment_date DESC;" -B -N`;
    const teoPmtResult = await ssh.execCommand(teoPmtCmd);
    console.log('Payments Teo Ady:');
    console.log(teoPmtResult.stdout);

    ssh.dispose();
    console.log('\n✅ Selesai!');
  } catch (err) {
    console.error('Error:', err);
    ssh.dispose();
  }
}

fixMarchInvoices();
