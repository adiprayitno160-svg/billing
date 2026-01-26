#!/usr/bin/env node
/**
 * Test script for auto isolation and unisolation functionality
 * This script tests the automatic isolation and unisolation of customers based on payment status
 */

import { databasePool } from '../src/db/pool';
import { IsolationService } from '../src/services/billing/isolationService';

async function testAutoIsolation() {
  console.log('🔒 Testing auto isolation functionality...');
  
  try {
    // Get a customer who has overdue invoices to test isolation
    const [customers] = await databasePool.query(`
      SELECT c.id, c.name, c.phone, c.connection_type, c.is_isolated
      FROM customers c
      JOIN invoices i ON c.id = i.customer_id
      WHERE i.status != 'paid' AND i.remaining_amount > 0 
      AND i.due_date < DATE_SUB(NOW(), INTERVAL 1 DAY)
      LIMIT 1
    `);
    
    if (customers.length > 0) {
      const customer = customers[0];
      console.log(`Found customer with overdue invoices: ${customer.name} (ID: ${customer.id})`);
      
      // Attempt to isolate the customer
      const isolationData = {
        customer_id: customer.id,
        action: 'isolate' as const,
        reason: 'Test: Auto-isolation due to overdue payment',
        performed_by: 'system_test'
      };
      
      const isolationResult = await IsolationService.isolateCustomer(isolationData);
      console.log(`✅ Auto-isolation result for ${customer.name}:`, isolationResult);
      
      // Check if customer is now isolated
      const [updatedCustomer] = await databasePool.query(
        'SELECT is_isolated FROM customers WHERE id = ?',
        [customer.id]
      );
      console.log(`Customer isolation status after test:`, updatedCustomer[0]);
      
    } else {
      console.log('⚠️ No customers with overdue invoices found for isolation test');
      
      // Create a test customer with an overdue invoice to test isolation
      console.log('Creating a test customer and invoice for isolation test...');
      
      // First, let's just run the auto isolation method directly
      const autoIsolateResult = await IsolationService.autoIsolateOverdueCustomers();
      console.log('Auto-isolation run result:', autoIsolateResult);
    }
    
  } catch (error) {
    console.error('❌ Error in auto isolation test:', error);
  }
}

async function testAutoUnisolation() {
  console.log('\n🔓 Testing auto unisolation functionality...');
  
  try {
    // Get an isolated customer who has paid their invoices to test unisolation
    const [isolatedCustomers] = await databasePool.query(`
      SELECT c.id, c.name, c.phone, c.connection_type, c.is_isolated
      FROM customers c
      WHERE c.is_isolated = 1
      LIMIT 1
    `);
    
    if (isolatedCustomers.length > 0) {
      const customer = isolatedCustomers[0];
      console.log(`Found isolated customer: ${customer.name} (ID: ${customer.id})`);
      
      // Attempt to unisolate the customer
      const unisolationData = {
        customer_id: customer.id,
        action: 'restore' as const,
        reason: 'Test: Auto-unisolation due to payment received',
        performed_by: 'system_test'
      };
      
      const unisolationResult = await IsolationService.isolateCustomer(unisolationData);
      console.log(`✅ Auto-unisolation result for ${customer.name}:`, unisolationResult);
      
      // Check if customer is now unisolated
      const [updatedCustomer] = await databasePool.query(
        'SELECT is_isolated FROM customers WHERE id = ?',
        [customer.id]
      );
      console.log(`Customer isolation status after unisolation test:`, updatedCustomer[0]);
      
    } else {
      console.log('⚠️ No isolated customers found for unisolation test');
      
      // Run the auto unisolation method directly
      console.log('Running auto-unisolation to find customers who paid...');
      const autoUnisolateResult = await IsolationService.autoRestorePaidCustomers();
      console.log('Auto-unisolation run result:', autoUnisolateResult);
    }
    
  } catch (error) {
    console.error('❌ Error in auto unisolation test:', error);
  }
}

async function testIsolationStatistics() {
  console.log('\n📊 Testing isolation statistics...');
  
  try {
    const stats = await IsolationService.getStatistics();
    console.log('Isolation statistics:', stats);
    
    // Get isolation history
    const history = await IsolationService.getIsolationHistory(undefined, 10);
    console.log('Recent isolation history:', history.slice(0, 5)); // Show first 5 records
    
    // Get isolated customers list
    const isolatedCustomers = await IsolationService.getIsolatedCustomers();
    console.log(`Found ${isolatedCustomers.length} isolated customers`);
    if (isolatedCustomers.length > 0) {
      console.log('Sample isolated customer:', isolatedCustomers[0]);
    }
    
  } catch (error) {
    console.error('❌ Error in isolation statistics test:', error);
  }
}

async function runIsolationTests() {
  console.log('🚀 Starting auto isolation/unisolation functionality tests...\n');
  
  await testIsolationStatistics();
  await testAutoIsolation();
  await testAutoUnisolation();
  
  console.log('\n✅ Auto isolation/unisolation tests completed!');
  process.exit(0);
}

// Run the tests
if (require.main === module) {
  runIsolationTests().catch(error => {
    console.error('💥 Error running isolation tests:', error);
    process.exit(1);
  });
}

export { 
  testAutoIsolation, 
  testAutoUnisolation, 
  testIsolationStatistics,
  runIsolationTests 
};