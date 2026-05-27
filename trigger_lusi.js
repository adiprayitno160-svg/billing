const { Client } = require('ssh2'); 

const conn = new Client(); 

const code = `
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/billing/.env' });

async function run() {
  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: process.env.DB_PASSWORD || 'BillingRoot123',
      database: 'billing'
    });

    const [rows] = await conn.query("SELECT i.id as inv_id, i.due_date as inv_due, i.remaining_amount, c.name, c.phone, c.id as customer_id FROM invoices i JOIN customers c ON i.customer_id = c.id WHERE c.name LIKE '%Lusi%' ORDER BY i.id DESC LIMIT 1;");
    
    if (rows.length === 0) {
        console.log("Customer Lusi not found or no invoice");
        process.exit();
    }
    
    const invoice = rows[0];
    console.log("Found Lusi invoice:", invoice.inv_id);
    
    const [confirms] = await conn.query("SELECT * FROM payment_confirmations WHERE customer_id = ? AND invoice_id = ? ORDER BY id DESC LIMIT 1", [invoice.customer_id, invoice.inv_id]);
    
    let reqDueDate = null;
    let confAmount = invoice.remaining_amount;
    let typeName = 'Hutang';
    if (confirms.length > 0) {
        reqDueDate = confirms[0].due_date;
        confAmount = confirms[0].amount;
        typeName = confirms[0].type === 'janji_bayar' ? 'Janji Bayar' : 'Hutang';
    }

    const { WhatsAppService } = require('/var/www/billing/dist/services/whatsapp/index');
    const waService = WhatsAppService.getInstance();
    
    if (invoice.phone) {
        let phone = invoice.phone.replace(/^0/, '62').replace(/\\D/g, '');
        
        const requestedDueTxt = reqDueDate ? "\\n\\nTanggal Janji Bayar yang diminta: *" + new Date(reqDueDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + "*" : "";
        
        let isolirTxt = 'sesuai jadwal tunggakan awal';
        if (invoice.inv_due) {
            const isoDate = new Date(invoice.inv_due);
            isoDate.setDate(isoDate.getDate() + 1);
            isolirTxt = "pada tanggal *" + isoDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + "* (karena batas akhir tagihan awal adalah " + new Date(invoice.inv_due).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) + ")";
        }

        const confirmMsg = "Halo *" + invoice.name + "*,\\n\\nAdmin kami telah mencatat permohonan *" + typeName + "* Anda untuk tagihan internet sebesar *Rp " + Number(confAmount).toLocaleString('id-ID') + "*." + requestedDueTxt + "\\n\\n*PENTING (MOHON DIBACA):*\\nUntuk menyetujui kesepakatan ini dan mencegah pemblokiran/isolir koneksi internet Anda, silakan balas pesan ini dengan mengetik:\\n\\n*SETUJU*\\n\\n_(Jika Anda tidak membalas SETUJU, maka permohonan tidak akan aktif dan koneksi Anda akan diisolir " + isolirTxt + ")_.";
        
        await waService.sendMessage(phone + '@s.whatsapp.net', confirmMsg);
        console.log("Sent WA confirmation message to Lusi at", phone);
    } else {
        console.log("Lusi does not have a phone number");
    }
    conn.end();
    setTimeout(() => process.exit(0), 2000);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
`;

conn.on('ready', () => { 
  console.log('SSH Ready');
  const sftp = conn.sftp((err, sftp) => {
    if (err) throw err;
    const writeStream = sftp.createWriteStream('/var/www/billing/run_lusi.js');
    writeStream.on('close', () => {
      conn.exec('cd /var/www/billing && node run_lusi.js', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => conn.end())
              .on('data', d => process.stdout.write(d))
              .stderr.on('data', d => process.stderr.write(d));
      });
    });
    writeStream.write(code);
    writeStream.end();
  });
}).connect({host: '192.168.239.154', port: 22, username: 'adi', password: 'adi'});
