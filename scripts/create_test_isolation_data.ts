#!/usr/bin/env node
/**
 * Script to create test data for isolation functionality
 * This creates customers with overdue invoices to test auto isolation
 */

import { databasePool } from '../src/db/pool';
import { IsolationService } from '../src/services/billing/isolationService';

async function createTestData() {
  console.log('📝 Creating test data for isolation functionality...');
  
  try {
    // Create a test customer with overdue invoices
    const customerName = `Test Customer ${Date.now()}`;
    const customerCode = `TEST${Math.floor(1000 + Math.random() * 9000)}`;
    
    // Insert test customer
    const [customerResult]: any = await databasePool.execute(`
      INSERT INTO customers (
        name, customer_code, phone, email, address, 
        connection_type, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      customerName,
      customerCode,
      '+6281234567890',  // Test phone number
      'test@example.com',
      'Test Address 123',
      'pppoe',  // Connection type
      'active',
    ]);
    
    const customerId = customerResult.insertId;
    console.log(`✅ Created test customer: ${customerName} (ID: ${customerId})`);
    
    // Create two overdue invoices for this customer to trigger auto isolation
    const [invoiceResult1]: any = await databasePool.execute(`
      INSERT INTO invoices (
        customer_id, invoice_number, period, due_date, 
        total_amount, remaining_amount, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      customerId,
      `INV-${Date.now()}-1`,
      '2024-12',  // Past period
      '2024-12-01',  // Past due date
      500000,  // Amount
      500000,  // Remaining amount (not paid)
      'overdue'  // Status
    ]);
    
    const [invoiceResult2]: any = await databasePool.execute(`
      INSERT INTO invoices (
        customer_id, invoice_number, period, due_date, 
        total_amount, remaining_amount, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      customerId,
      `INV-${Date.now()}-2`,
      '2024-11',  // Past period
      '2024-11-01',  // Past due date
      500000,  // Amount
      500000,  // Remaining amount (not paid)
      'overdue'  // Status
    ]);
    
    console.log(`✅ Created two overdue invoices for customer ${customerName}`);
    
    // Test auto isolation
    console.log('\n🔒 Testing auto isolation...');
    const autoIsolateResult = await IsolationService.autoIsolateOverdueCustomers();
    console.log('Auto-isolation result:', autoIsolateResult);
    
    // Check if customer is now isolated
    const [checkCustomer] = await databasePool.execute(
      'SELECT is_isolated FROM customers WHERE id = ?',
      [customerId]
    );
    
    console.log('Customer isolation status after auto isolation:', checkCustomer[0]);
    
    // Mark invoices as paid to test unisolation
    console.log('\n💰 Marking invoices as paid to test unisolation...');
    await databasePool.execute(
      'UPDATE invoices SET status = "paid", remaining_amount = 0, last_payment_date = NOW() WHERE customer_id = ?',
      [customerId]
    );
    
    // Test auto unisolation
    console.log('🔓 Testing auto unisolation...');
    const autoUnisolateResult = await IsolationService.autoRestorePaidCustomers();
    console.log('Auto-unisolation result:', autoUnisolateResult);
    
    // Check if customer is now unisolated
    const [checkCustomerAfterUnisolation] = await databasePool.execute(
      'SELECT is_isolated FROM customers WHERE id = ?',
      [customerId]
    );
    
    console.log('Customer isolation status after auto unisolation:', checkCustomerAfterUnisolation[0]);
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error creating test data:', error);
  }
}

// Run the test
if (require.main === module) {
  createTestData()
    .then(() => {
      console.log('🎉 Test data creation completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error:', error);
      process.exit(1);
    });
}

export { createTestData };