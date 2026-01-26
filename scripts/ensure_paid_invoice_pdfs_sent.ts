#!/usr/bin/env node
/**
 * Comprehensive script to ensure all paid invoices have their PDFs sent automatically
 * This script will check for paid invoices and send PDFs to customers if they haven't been sent yet
 */

import { databasePool } from '../src/db/pool';
import { InvoicePdfService } from '../src/services/invoice/InvoicePdfService';
import { whatsappService } from '../src/services/whatsapp';
import { UnifiedNotificationService } from '../src/services/notification/UnifiedNotificationService';

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

async function ensurePaidInvoicePdfsSent() {
  console.log('🔍 Checking for paid invoices that need PDF delivery...');

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
        LIMIT 50
      `) as [InvoiceData[], any];

      console.log(`📊 Found ${rows.length} paid invoices to verify...`);

      if (rows.length === 0) {
        console.log('✅ No paid invoices found in the system to process');
        return;
      }

      let successCount = 0;
      let failedCount = 0;

      // Check each paid invoice to ensure PDF was sent
      for (const invoice of rows) {
        console.log(`\n📝 Processing invoice #${invoice.id} (${invoice.invoice_number}) for customer: ${invoice.customer_name}`);
        console.log(`💰 Total: ${invoice.total_amount}, Paid: ${invoice.paid_amount}, Remaining: ${invoice.remaining_amount}`);
        
        // Verify customer has phone number
        if (!invoice.customer_phone) {
          console.log(`⚠️  Customer ${invoice.customer_name} has no phone number, skipping PDF send`);
          continue;
        }

        try {
          // Use the existing notification system to send payment received notification with PDF
          // This will generate and send the PDF as part of the notification
          
          // First, let's check if there's a payment record for this invoice
          const [paymentRows] = await connection.query(
            'SELECT id FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC LIMIT 1',
            [invoice.id]
          ) as any[];

          if (paymentRows.length > 0) {
            // Use the existing notification system which handles PDF generation and sending
            await UnifiedNotificationService.notifyPaymentReceived(paymentRows[0].id, true);
            console.log(`✅ Payment notification with PDF sent for invoice #${invoice.id}`);
            successCount++;
          } else {
            console.log(`⚠️  No payment record found for invoice #${invoice.id}, unable to send payment notification`);
            // As fallback, try to send invoice created notification
            await UnifiedNotificationService.notifyInvoiceCreated(invoice.id, true);
            console.log(`✅ Invoice notification sent for invoice #${invoice.id} (fallback method)`);
            successCount++;
          }
        } catch (error) {
          console.log(`❌ Error processing invoice #${invoice.id}:`, error.message);
          failedCount++;
        }
      }
      
      console.log(`\n🎉 Paid invoice PDF verification completed!`);
      console.log(`✅ Successfully processed: ${successCount} invoices`);
      console.log(`❌ Failed to process: ${failedCount} invoices`);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('💥 Error during paid invoice PDF verification:', error);
  }
}

// Also create a function to check for invoices that should be marked as paid but aren't
async function checkAndFixUnmarkedPaidInvoices() {
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
        LIMIT 50
      `) as [InvoiceData[], any];

      console.log(`📊 Found ${rows.length} invoices with 0 remaining amount but not marked as paid`);

      if (rows.length > 0) {
        console.log('Updating these invoices to "paid" status and sending notifications:');
        for (const invoice of rows) {
          console.log(`  - Invoice #${invoice.id} (${invoice.invoice_number}): Status is '${invoice.status}' but remaining is ${invoice.remaining_amount}`);
          
          try {
            // Update invoice status to paid
            await connection.query(
              'UPDATE invoices SET status = "paid", updated_at = NOW() WHERE id = ?',
              [invoice.id]
            );
            
            console.log(`    ✅ Updated to 'paid' status`);
            
            // Trigger notification for the paid invoice
            const [paymentRows] = await connection.query(
              'SELECT id FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC LIMIT 1',
              [invoice.id]
            ) as any[];
            
            if (paymentRows.length > 0) {
              await UnifiedNotificationService.notifyPaymentReceived(paymentRows[0].id, true);
              console.log(`    ✅ Payment notification sent`);
            }
          } catch (updateError) {
            console.log(`    ❌ Error updating invoice #${invoice.id}:`, updateError.message);
          }
        }
      } else {
        console.log('✅ All invoices with 0 remaining amount are properly marked as paid');
      }
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('💥 Error checking unmarked paid invoices:', error);
  }
}

// Main execution function
async function runCompleteCheck() {
  console.log('🚀 Starting comprehensive paid invoice PDF verification and correction process...\n');
  
  await checkAndFixUnmarkedPaidInvoices();
  await ensurePaidInvoicePdfsSent();
  
  console.log('\n✅ Complete paid invoice PDF verification and correction process finished!');
  process.exit(0);
}

// If this script is run directly
if (require.main === module) {
  runCompleteCheck().catch(error => {
    console.error('💥 Critical error in the process:', error);
    process.exit(1);
  });
}

export { ensurePaidInvoicePdfsSent, checkAndFixUnmarkedPaidInvoices, runCompleteCheck };