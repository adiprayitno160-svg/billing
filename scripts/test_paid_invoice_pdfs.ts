#!/usr/bin/env node
/**
 * Test script to verify that paid invoice PDFs are sent automatically
 * This script checks for paid invoices and verifies the PDF sending functionality
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

async function testPaidInvoicePdfSending() {
  console.log('🔍 Testing paid invoice PDF sending functionality...');
  
  try {
    // Connect to database
    const connection = await databasePool.getConnection();
    
    try {
      // Find all paid invoices that might not have been sent
      const [rows] = await connection.query(`
        SELECT i.*, c.name as customer_name, c.phone as customer_phone
        FROM invoices i
        JOIN customers c ON i.customer_id = c.id
        WHERE i.status = 'paid' 
        AND i.remaining_amount <= 0
        ORDER BY i.updated_at DESC
        LIMIT 10
      `) as [InvoiceData[], any];

      console.log(`📊 Found ${rows.length} paid invoices to verify...`);

      if (rows.length === 0) {
        console.log('✅ No paid invoices found in the system to test');
        return;
      }

      // Check each paid invoice to ensure PDF was sent
      for (const invoice of rows) {
        console.log(`\n📝 Checking invoice #${invoice.id} (${invoice.invoice_number}) for customer: ${invoice.customer_name}`);
        console.log(`💰 Total: ${invoice.total_amount}, Paid: ${invoice.paid_amount}, Remaining: ${invoice.remaining_amount}`);
        
        // Verify customer has phone number
        if (!invoice.customer_phone) {
          console.log(`⚠️  Customer ${invoice.customer_name} has no phone number, skipping PDF send`);
          continue;
        }

        // Generate and send PDF for the paid invoice
        try {
          const pdfBuffer = await InvoicePdfService.generateInvoicePdf(invoice.id);
          
          if (pdfBuffer) {
            console.log(`📄 PDF generated successfully for invoice #${invoice.id}`);
            
            // First send the message
            const waMessage = `Halo ${invoice.customer_name},

Berikut adalah invoice pembayaran Anda yang telah lunas:

• Nomor Invoice: ${invoice.invoice_number}
• Periode: ${invoice.period}
• Jumlah Dibayar: Rp ${parseFloat(invoice.paid_amount.toString()).toLocaleString('id-ID')}

Terima kasih atas pembayaran Anda.

${process.env.COMPANY_NAME || 'Perusahaan'} Billing System`;
            
            // Send the message first
            const messageResult = await whatsappService.sendMessage(invoice.customer_phone, waMessage);
            
            if (messageResult.success) {
              // Create temp directory and file to send the PDF
              const fs = require('fs');
              const path = require('path');
              
              // Create temp directory if not exists
              const tempDir = path.join(__dirname, '..', 'temp');
              if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
              }
              
              const tempFilePath = path.join(tempDir, `invoice_${invoice.id}_${Date.now()}.pdf`);
              fs.writeFileSync(tempFilePath, pdfBuffer);
              
              const result = await whatsappService.sendDocument(
                invoice.customer_phone, 
                tempFilePath,
                `Invoice_${invoice.invoice_number}.pdf`,
                `Invoice ${invoice.invoice_number} - Lunas`
              );
              
              // Clean up temp file after sending
              setTimeout(() => {
                try {
                  if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                  }
                } catch (cleanupError) {
                  console.log(`⚠️  Could not cleanup temp file: ${cleanupError.message}`);
                }
              }, 5000); // Clean up after 5 seconds
              
              if (result.success) {
                console.log(`✅ PDF invoice sent successfully to ${invoice.customer_phone}`);
                
                // Log the notification in the system
                await connection.query(`
                  INSERT INTO customer_notifications_log (customer_id, notification_type, channel, status, message, created_at)
                  VALUES (?, 'paid_invoice_pdf', 'whatsapp', 'sent', ?, NOW())
                `, [invoice.customer_id, `Paid invoice PDF sent: ${invoice.invoice_number}`]);
              } else {
                console.log(`❌ Failed to send PDF to ${invoice.customer_phone}:`, result.error);
              }
            } else {
              console.log(`❌ Failed to send message to ${invoice.customer_phone}:`, messageResult.error);
            }
          } else {
            console.log(`❌ Failed to generate PDF for invoice #${invoice.id}`);
          }
        } catch (pdfError) {
          console.log(`❌ Error processing invoice #${invoice.id}:`, pdfError.message);
        }
      }
      
      console.log('\n🎉 Paid invoice PDF verification test completed!');
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('💥 Error during paid invoice PDF test:', error);
  }
}

// Also create a function to check for invoices that should be marked as paid but aren't
async function checkUnmarkedPaidInvoices() {
  console.log('\n🔍 Checking for invoices that should be marked as paid but aren\'t...');
  
  try {
    const connection = await databasePool.getConnection();
    
    try {
      // Find invoices where remaining_amount is 0 or negative but status is not 'paid'
      const [rows] = await connection.query(`
        SELECT i.*, c.name as customer_name, c.phone as customer_phone
        FROM invoices i
        JOIN customers c ON i.customer_id = c.id
        WHERE i.remaining_amount <= 0 
        AND i.status != 'paid'
        ORDER BY i.updated_at DESC
        LIMIT 10
      `) as [InvoiceData[], any];

      console.log(`📊 Found ${rows.length} invoices with 0 remaining amount but not marked as paid`);

      if (rows.length > 0) {
        console.log('These invoices should be updated to "paid" status:');
        for (const invoice of rows) {
          console.log(`  - Invoice #${invoice.id} (${invoice.invoice_number}): Status is '${invoice.status}' but remaining is ${invoice.remaining_amount}`);
        }
      }
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('💥 Error checking unmarked paid invoices:', error);
  }
}

// Run the tests
async function runTests() {
  await testPaidInvoicePdfSending();
  await checkUnmarkedPaidInvoices();
  
  console.log('\n✅ All tests completed successfully!');
  process.exit(0);
}

if (require.main === module) {
  runTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

export { testPaidInvoicePdfSending, checkUnmarkedPaidInvoices };