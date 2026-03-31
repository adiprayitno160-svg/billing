#!/usr/bin/env node
/**
 * Script to check and send PDF invoices for paid invoices that haven't been sent yet
 * This ensures all "LUNAS" invoices get their PDFs delivered to customers automatically
 */

import { databasePool } from '../src/db/pool';
import { InvoicePdfService } from '../src/services/invoice/InvoicePdfService';
import { whatsappService } from '../src/services/whatsapp';

interface InvoiceData {
  id: number;
  invoice_number: string;
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  remaining_amount: number;
  total_amount: number;
  paid_amount: number;
  status: string;
  period: string;
  due_date: string;
}

async function checkAndSendPaidInvoicePdfs() {
  console.log('🔍 Checking for paid invoices that need PDF delivery...');

  try {
    // Connect to database
    const connection = await databasePool.getConnection();

    try {
      // Find all paid invoices that might not have been sent
      const query = `
        SELECT 
          i.id,
          i.invoice_number,
          i.customer_id,
          i.remaining_amount,
          i.total_amount,
          i.paid_amount,
          i.status,
          i.period,
          i.due_date,
          c.name as customer_name,
          c.phone as customer_phone
        FROM invoices i
        JOIN customers c ON i.customer_id = c.id
        WHERE i.status = 'paid' 
          AND c.phone IS NOT NULL
          AND i.customer_id IS NOT NULL
        ORDER BY i.updated_at DESC
        LIMIT 100
      `;

      const [results] = await connection.query(query);
      const invoices = results as InvoiceData[];

      console.log(`📋 Found ${invoices.length} paid invoices to process`);

      let sentCount = 0;
      let failedCount = 0;

      for (const invoice of invoices) {
        try {
          console.log(`\n📄 Processing invoice: ${invoice.invoice_number} for ${invoice.customer_name}`);

          // Check if invoice is truly paid (remaining amount <= 0)
          if (parseFloat(invoice.remaining_amount as any) > 0) {
            console.log(`⚠️  Invoice ${invoice.invoice_number} has remaining balance: ${invoice.remaining_amount}. Skipping.`);
            continue;
          }

          // Generate PDF
          console.log(`⚡ Generating PDF for invoice ${invoice.invoice_number}...`);
          const pdfPath = await InvoicePdfService.generateInvoicePdf(invoice.id);

          // Prepare message
          const amount = new Intl.NumberFormat('id-ID').format(parseFloat(invoice.total_amount as any));
          const caption = `✅ *PEMBAYARAN LUNAS*

Halo Kak *${invoice.customer_name}*,
Terima kasih, pembayaran tagihan *${invoice.invoice_number}* telah berhasil kami verifikasi LUNAS.

Nominal: *Rp ${amount}*
Periode: *${invoice.period}*
Jatuh Tempo: *${new Date(invoice.due_date).toLocaleDateString('id-ID')}*

Berikut terlampir e-invoice (Lunas) sebagai bukti pembayaran yang sah.

Terima kasih telah berlangganan! 🙏`;

          // Send PDF via WhatsApp
          console.log(`📱 Sending PDF to ${invoice.customer_name} (${invoice.customer_phone})...`);
          await whatsappService.sendDocument(
            invoice.customer_phone, 
            pdfPath, 
            `Invoice-${invoice.invoice_number}-LUNAS.pdf`, 
            caption
          );

          console.log(`✅ Successfully sent invoice ${invoice.invoice_number} PDF to ${invoice.customer_name}`);
          sentCount++;

        } catch (error: any) {
          console.error(`❌ Failed to process invoice ${invoice.invoice_number}:`, error.message);
          failedCount++;
          
          // Continue with next invoice instead of stopping the entire process
          continue;
        }
      }

      console.log(`\n📊 Summary:`);
      console.log(`✅ Successfully sent: ${sentCount} invoices`);
      console.log(`❌ Failed: ${failedCount} invoices`);
      console.log(`📈 Total processed: ${invoices.length} invoices`);

    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error('💥 Critical error in sendPaidInvoicePdfs:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  checkAndSendPaidInvoicePdfs()
    .then(() => {
      console.log('\n🎉 Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

export { checkAndSendPaidInvoicePdfs };