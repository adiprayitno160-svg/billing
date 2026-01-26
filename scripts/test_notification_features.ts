#!/usr/bin/env node
/**
 * Comprehensive test script for notification features
 * Tests broadcast messaging, blocking/unblocking notifications, 
 * automatic billing notifications, and due date notifications
 */

import { databasePool } from '../src/db/pool';
import { UnifiedNotificationService } from '../src/services/notification/UnifiedNotificationService';
import { whatsappService } from '../src/services/whatsapp';

async function testBroadcastMessaging() {
  console.log('📢 Testing broadcast messaging functionality...');
  
  try {
    // Test sending a broadcast message to all admins/operators
    const message = `📢 *TEST NOTIFICATION*

This is a test broadcast message sent at ${new Date().toLocaleString('id-ID')}

Testing the broadcast functionality of the system.`;
    
    await UnifiedNotificationService.broadcastToAdmins(message);
    console.log('✅ Broadcast message sent to all admins/operators');
    
    // Test queue-based broadcast to all customers
    const broadcastNotification = {
      customer_id: null, // null means broadcast to all
      notification_type: 'broadcast',
      channels: ['whatsapp'],
      variables: {
        custom_message: message,
        title: 'System Broadcast Test'
      },
      priority: 'normal'
    };
    
    const notificationIds = await UnifiedNotificationService.queueNotification(broadcastNotification);
    console.log(`✅ Broadcast notification queued with IDs: ${notificationIds.join(', ')}`);
    
    // Process the queue to send immediately
    const result = await UnifiedNotificationService.sendPendingNotifications(50);
    console.log(`✅ Broadcast processing complete: ${result.sent} sent, ${result.failed} failed`);
    
  } catch (error) {
    console.error('❌ Error in broadcast messaging:', error);
  }
}

async function testBlockingUnblockingNotifications() {
  console.log('\n🔒 Testing blocking/unblocking notifications...');
  
  try {
    // Get a sample customer to test with
    const [customers] = await databasePool.query(`
      SELECT id, name, phone, customer_code 
      FROM customers 
      WHERE phone IS NOT NULL 
      LIMIT 1
    `);
    
    if (customers.length === 0) {
      console.log('⚠️ No customers with phone numbers found for testing');
      return;
    }
    
    const customer = customers[0];
    console.log(`Using customer: ${customer.name} (${customer.phone})`);
    
    // Test service blocked notification
    const blockedNotification = {
      customer_id: customer.id,
      notification_type: 'service_blocked',
      channels: ['whatsapp'],
      variables: {
        customer_name: customer.name,
        customer_code: customer.customer_code,
        reason: 'Test: Automatic isolation due to overdue payment',
        details: 'Testing blocked notification functionality'
      },
      priority: 'high'
    };
    
    const blockedIds = await UnifiedNotificationService.queueNotification(blockedNotification);
    console.log(`✅ Blocked notification queued with ID: ${blockedIds.join(', ')}`);
    
    // Process the queue to send immediately
    const blockedResult = await UnifiedNotificationService.sendPendingNotifications(10);
    console.log(`✅ Blocked notification processing: ${blockedResult.sent} sent, ${blockedResult.failed} failed`);
    
    // Test service unblocked notification
    const unblockedNotification = {
      customer_id: customer.id,
      notification_type: 'service_unblocked',
      channels: ['whatsapp'],
      variables: {
        customer_name: customer.name,
        customer_code: customer.customer_code,
        details: 'Testing unblocked notification functionality'
      },
      priority: 'normal'
    };
    
    const unblockedIds = await UnifiedNotificationService.queueNotification(unblockedNotification);
    console.log(`✅ Unblocked notification queued with ID: ${unblockedIds.join(', ')}`);
    
    // Process the queue to send immediately
    const unblockedResult = await UnifiedNotificationService.sendPendingNotifications(10);
    console.log(`✅ Unblocked notification processing: ${unblockedResult.sent} sent, ${unblockedResult.failed} failed`);
    
  } catch (error) {
    console.error('❌ Error in blocking/unblocking notifications:', error);
  }
}

async function testAutomaticBillingNotifications() {
  console.log('\n💰 Testing automatic billing notifications...');
  
  try {
    // Get a sample customer to test with
    const [customers] = await databasePool.query(`
      SELECT id, name, phone, customer_code 
      FROM customers 
      WHERE phone IS NOT NULL 
      LIMIT 1
    `);
    
    if (customers.length === 0) {
      console.log('⚠️ No customers with phone numbers found for testing');
      return;
    }
    
    const customer = customers[0];
    console.log(`Using customer: ${customer.name} (${customer.phone})`);
    
    // Test invoice created notification (simulating automatic billing)
    const invoiceNotification = {
      customer_id: customer.id,
      notification_type: 'invoice_created',
      channels: ['whatsapp'],
      variables: {
        customer_name: customer.name,
        customer_code: customer.customer_code,
        invoice_number: 'TEST-001',
        amount: 'Rp 500,000',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('id-ID'), // 7 days from now
        period: '2026-01'
      },
      priority: 'normal'
    };
    
    const invoiceIds = await UnifiedNotificationService.queueNotification(invoiceNotification);
    console.log(`✅ Invoice created notification queued with ID: ${invoiceIds.join(', ')}`);
    
    // Process the queue to send immediately
    const invoiceResult = await UnifiedNotificationService.sendPendingNotifications(10);
    console.log(`✅ Invoice notification processing: ${invoiceResult.sent} sent, ${invoiceResult.failed} failed`);
    
  } catch (error) {
    console.error('❌ Error in automatic billing notifications:', error);
  }
}

async function testDueDateNotifications() {
  console.log('\n📅 Testing due date notifications...');
  
  try {
    // Get a sample customer to test with
    const [customers] = await databasePool.query(`
      SELECT id, name, phone, customer_code 
      FROM customers 
      WHERE phone IS NOT NULL 
      LIMIT 1
    `);
    
    if (customers.length === 0) {
      console.log('⚠️ No customers with phone numbers found for testing');
      return;
    }
    
    const customer = customers[0];
    console.log(`Using customer: ${customer.name} (${customer.phone})`);
    
    // Test reminder before due date (3 days before)
    const preDueNotification = {
      customer_id: customer.id,
      notification_type: 'invoice_reminder',
      channels: ['whatsapp'],
      variables: {
        customer_name: customer.name,
        customer_code: customer.customer_code,
        invoice_number: 'TEST-002',
        amount: 'Rp 750,000',
        due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('id-ID'), // 3 days from now
        days_until_due: 3
      },
      priority: 'normal'
    };
    
    const preDueIds = await UnifiedNotificationService.queueNotification(preDueNotification);
    console.log(`✅ Pre-due reminder notification queued with ID: ${preDueIds.join(', ')}`);
    
    // Test overdue notification
    const overdueNotification = {
      customer_id: customer.id,
      notification_type: 'invoice_overdue',
      channels: ['whatsapp'],
      variables: {
        customer_name: customer.name,
        customer_code: customer.customer_code,
        invoice_number: 'TEST-003',
        amount: 'Rp 600,000',
        due_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toLocaleDateString('id-ID'), // 2 days ago
        days_overdue: 2
      },
      priority: 'high'
    };
    
    const overdueIds = await UnifiedNotificationService.queueNotification(overdueNotification);
    console.log(`✅ Overdue notification queued with ID: ${overdueIds.join(', ')}`);
    
    // Process the queues to send immediately
    const dueResult = await UnifiedNotificationService.sendPendingNotifications(20);
    console.log(`✅ Due date notifications processing: ${dueResult.sent} sent, ${dueResult.failed} failed`);
    
  } catch (error) {
    console.error('❌ Error in due date notifications:', error);
  }
}

async function testPaymentReceivedNotifications() {
  console.log('\n💳 Testing payment received notifications...');
  
  try {
    // Get a sample customer to test with
    const [customers] = await databasePool.query(`
      SELECT id, name, phone, customer_code 
      FROM customers 
      WHERE phone IS NOT NULL 
      LIMIT 1
    `);
    
    if (customers.length === 0) {
      console.log('⚠️ No customers with phone numbers found for testing');
      return;
    }
    
    const customer = customers[0];
    console.log(`Using customer: ${customer.name} (${customer.phone})`);
    
    // Test payment received notification
    const paymentNotification = {
      customer_id: customer.id,
      notification_type: 'payment_received',
      channels: ['whatsapp'],
      variables: {
        customer_name: customer.name,
        customer_code: customer.customer_code,
        invoice_number: 'TEST-PAY-001',
        amount: 'Rp 500,000',
        payment_method: 'Cash',
        payment_date: new Date().toLocaleDateString('id-ID'),
        status: 'LUNAS'
      },
      priority: 'normal'
    };
    
    const paymentIds = await UnifiedNotificationService.queueNotification(paymentNotification);
    console.log(`✅ Payment received notification queued with ID: ${paymentIds.join(', ')}`);
    
    // Process the queue to send immediately
    const paymentResult = await UnifiedNotificationService.sendPendingNotifications(10);
    console.log(`✅ Payment notification processing: ${paymentResult.sent} sent, ${paymentResult.failed} failed`);
    
  } catch (error) {
    console.error('❌ Error in payment received notifications:', error);
  }
}

async function runAllTests() {
  console.log('🚀 Starting comprehensive notification functionality tests...\n');
  
  await testBroadcastMessaging();
  await testBlockingUnblockingNotifications();
  await testAutomaticBillingNotifications();
  await testDueDateNotifications();
  await testPaymentReceivedNotifications();
  
  console.log('\n🎉 All notification tests completed!');
  
  // Check notification queue statistics
  try {
    const stats = await UnifiedNotificationService.getStatistics(7);
    console.log('\n📊 Notification Statistics (last 7 days):');
    console.log(`Total: ${stats.total}, Sent: ${stats.sent}, Failed: ${stats.failed}, Pending: ${stats.pending}`);
    console.log('By type:', stats.by_type);
    console.log('By channel:', stats.by_channel);
  } catch (error) {
    console.error('⚠️ Error getting statistics:', error);
  }
  
  console.log('\n✅ Comprehensive notification testing completed successfully!');
  process.exit(0);
}

// Run the tests
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('💥 Error running tests:', error);
    process.exit(1);
  });
}

export { 
  testBroadcastMessaging, 
  testBlockingUnblockingNotifications, 
  testAutomaticBillingNotifications, 
  testDueDateNotifications, 
  testPaymentReceivedNotifications,
  runAllTests 
};