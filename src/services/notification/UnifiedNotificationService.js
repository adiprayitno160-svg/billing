"use strict";
/**
 * Unified Notification Service
 * Centralized notification service for all billing events
 * Integrated with WhatsApp and other channels
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnifiedNotificationService = void 0;
const pool_1 = require("../../db/pool");
const NotificationTemplateService_1 = require("./NotificationTemplateService");
const whatsapp_1 = require("../whatsapp");
class UnifiedNotificationService {
    /**
     * Queue notification for sending
     */
    static async queueNotification(data) {
        var _a;
        // Basic validation for broadcast type
        if (data.notification_type === 'broadcast') {
            if (!((_a = data.variables) === null || _a === void 0 ? void 0 : _a.custom_message)) {
                console.warn('[UnifiedNotification] Broadcast missing custom_message');
                // We still allow it to queue, but logic might fail if template expects it.
            }
        }
        console.log(`[UnifiedNotification] 📥 Queueing notification:`, {
            customer_id: data.customer_id,
            notification_type: data.notification_type,
            channels: data.channels || ['whatsapp']
        });
        const connection = await pool_1.databasePool.getConnection();
        const notificationIds = [];
        try {
            // Determine channels
            const channels = data.channels || ['whatsapp'];
            // Get customer info with potential WhatsApp LID
            const [customerRows] = await connection.query(`SELECT c.name, c.phone, c.email, cl.lid as wa_lid 
         FROM customers c 
         LEFT JOIN customer_wa_lids cl ON c.id = cl.customer_id 
         WHERE c.id = ?`, [data.customer_id]);
            if (customerRows.length === 0) {
                console.error(`[UnifiedNotification] ❌ Customer with ID ${data.customer_id} not found in database. Type: ${typeof data.customer_id}`);
                throw new Error(`Customer ${data.customer_id} not found`);
            }
            const customer = customerRows[0];
            // Prepare variables with customer info
            const allVariables = Object.assign({ customer_name: customer.name || 'Pelanggan', customer_phone: customer.phone || '', customer_email: customer.email || '' }, data.variables);
            // Process each channel
            for (const channel of channels) {
                // Get template for this notification type and channel
                const template = await NotificationTemplateService_1.NotificationTemplateService.getTemplate(data.notification_type, channel);
                if (!template) {
                    // Check if template exists but is inactive
                    const [inactiveRows] = await connection.query(`SELECT template_code, is_active FROM notification_templates 
             WHERE notification_type = ? AND channel = ?`, [data.notification_type, channel]);
                    if (inactiveRows.length > 0 && !inactiveRows[0].is_active) {
                        console.error(`[UnifiedNotification] ❌ Template found but is INACTIVE: ${inactiveRows[0].template_code} for ${data.notification_type} on ${channel}. Please activate it in the notification templates page.`);
                        throw new Error(`Template ${inactiveRows[0].template_code} exists but is inactive. Please activate it in the notification templates page.`);
                    }
                    else {
                        console.error(`[UnifiedNotification] ❌ No template found for ${data.notification_type} on ${channel}. Please create a template in the notification templates page.`);
                        throw new Error(`No template found for ${data.notification_type} on ${channel}. Please create a template in the notification templates page.`);
                    }
                }
                // Replace variables in template
                let title = NotificationTemplateService_1.NotificationTemplateService.replaceVariables(template.title_template, allVariables);
                let message = NotificationTemplateService_1.NotificationTemplateService.replaceVariables(template.message_template, allVariables);
                // Insert into queue
                const [result] = await connection.query(`INSERT INTO unified_notifications_queue 
           (customer_id, subscription_id, invoice_id, payment_id, notification_type,
            template_code, channel, title, message, attachment_path, status, priority, scheduled_for)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`, [
                    data.customer_id,
                    data.subscription_id || null,
                    data.invoice_id || null,
                    data.payment_id || null,
                    data.notification_type,
                    template.template_code,
                    channel,
                    title,
                    message,
                    data.attachment_path || null,
                    data.priority || template.priority,
                    data.scheduled_for || null
                ]);
                notificationIds.push(result.insertId);
                console.log(`[UnifiedNotification] ✅ Notification queued (ID: ${result.insertId}) for ${channel}`, {
                    customer_id: data.customer_id,
                    notification_type: data.notification_type,
                    template_code: template.template_code
                });
            }
            console.log(`[UnifiedNotification] 📊 Total notifications queued: ${notificationIds.length}`, {
                notification_ids: notificationIds
            });
            return notificationIds;
        }
        catch (error) {
            console.error(`[UnifiedNotification] ❌ Fatal error in queueNotification:`, {
                error: error.message,
                stack: error.stack,
                customer_id: data.customer_id,
                notification_type: data.notification_type
            });
            throw error;
        }
        finally {
            connection.release();
            // Trigger immediate send if requested and we have items
            if (data.send_immediately && notificationIds.length > 0) {
                console.log('[UnifiedNotification] ⚡ Triggering immediate dispatch for', notificationIds);
                // Fire and forget, don't await to avoid blocking response
                this.sendPendingNotifications(50, notificationIds).catch(err => console.error('[UnifiedNotification] Immediate dispatch error:', err));
            }
        }
    }
    /**
     * Send pending notifications
     */
    static async sendPendingNotifications(limit = 50, specificIds) {
        console.log(`[UnifiedNotification] 🔄 Processing pending notifications (limit: ${limit}, specific: ${(specificIds === null || specificIds === void 0 ? void 0 : specificIds.length) || 0})...`);
        const connection = await pool_1.databasePool.getConnection();
        // Check WhatsApp status first to prevent mass failures
        const waStatus = whatsapp_1.whatsappService.getStatus();
        if (!waStatus.ready) {
            console.log(`[UnifiedNotification] ⚠️ WhatsApp not ready (Reconnecting: ${waStatus.reconnectAttempts}). Pausing queue processing.`);
            try {
                await whatsapp_1.whatsappService.waitForReady(5000); // Try waiting briefly
            }
            catch (e) {
                console.log(`[UnifiedNotification] ⏳ WhatsApp still not ready. Skipping queue processing this turn.`);
                return { sent: 0, failed: 0, skipped: 0 };
            }
        }
        let sent = 0;
        let failed = 0;
        let skipped = 0;
        try {
            // 1. First, cleanup any stuck processing notifications (those that have been in processing status for > 15 mins)
            // This handles cases where a worker crashed or was restarted mid-process
            await connection.query(`UPDATE unified_notifications_queue 
         SET status = 'pending', 
             error_message = 'Process timed out or worker restarted',
             updated_at = NOW() 
         WHERE status = 'processing' 
         AND updated_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE)`);
            // Build query for pending notifications
            let query = `SELECT * FROM unified_notifications_queue 
                   WHERE status = 'pending' 
                   AND (scheduled_for IS NULL OR scheduled_for <= NOW())`;
            const params = [];
            if (specificIds && specificIds.length > 0) {
                query += ` AND id IN (?)`;
                params.push(specificIds);
            }
            query += ` ORDER BY 
                 CASE priority 
                   WHEN 'high' THEN 1 
                   WHEN 'normal' THEN 2 
                   WHEN 'low' THEN 3 
                 END,
                 created_at ASC
               LIMIT ?`;
            params.push(limit);
            const [notifications] = await connection.query(query, params);
            console.log(`[UnifiedNotification] 📋 Found ${notifications.length} pending notifications to process`);
            if (notifications.length === 0) {
                return { sent: 0, failed: 0, skipped: 0 };
            }
            // Mark these notifications as 'processing' to prevent race conditions with Cron/Other threads
            const processingIds = notifications.map(n => n.id);
            if (processingIds.length > 0) {
                await connection.query(`UPDATE unified_notifications_queue SET status = 'processing' WHERE id IN (?)`, [processingIds]);
            }
            for (const notif of notifications) {
                console.log(`[UnifiedNotification] 🔍 Processing notification ID: ${notif.id}`, {
                    customer_id: notif.customer_id,
                    notification_type: notif.notification_type,
                    channel: notif.channel,
                    status: notif.status
                });
                try {
                    // Check if customer has required contact info for channel
                    // Get customer info with potential WhatsApp LID
                    const [customerRows] = await connection.query(`SELECT c.name, c.phone, c.email, cl.lid as wa_lid 
             FROM customers c 
             LEFT JOIN customer_wa_lids cl ON c.id = cl.customer_id 
             WHERE c.id = ?`, [notif.customer_id]);
                    if (customerRows.length === 0) {
                        console.error(`[UnifiedNotification] ❌ Notification ID ${notif.id}: Customer ${notif.customer_id} not found in database`);
                        await this.markAsFailed(notif.id, `Customer ID ${notif.customer_id} not found in database`);
                        failed++;
                        continue;
                    }
                    const customer = customerRows[0];
                    // Check channel requirements
                    if (notif.channel === 'whatsapp' && !customer.phone) {
                        await this.markAsSkipped(notif.id, 'No phone number');
                        skipped++;
                        continue;
                    }
                    if (notif.channel === 'email' && !customer.email) {
                        await this.markAsSkipped(notif.id, 'No email address');
                        skipped++;
                        continue;
                    }
                    // Send notification
                    console.log(`[UnifiedNotification] 🚀 Attempting to send notification ID: ${notif.id}`);
                    // Try to send - this will throw error if fails
                    await this.sendNotification(notif, customer);
                    // Only mark as sent if sendNotification completed without error
                    // This means WhatsApp/email/etc actually sent successfully
                    await connection.query(`UPDATE unified_notifications_queue 
             SET status = 'sent', sent_at = NOW(), error_message = NULL
             WHERE id = ?`, [notif.id]);
                    console.log(`[UnifiedNotification] ✅ Notification ID: ${notif.id} marked as sent (actually sent successfully)`);
                    sent++;
                }
                catch (error) {
                    const errorMessage = error.message || 'Unknown error';
                    // Check if error is connection related
                    const isConnectionError = errorMessage.includes('WhatsApp not ready') ||
                        errorMessage.includes('QR code') ||
                        errorMessage.includes('Session conflict') ||
                        errorMessage.includes('Stream Errored') ||
                        errorMessage.includes('Connection Closed') ||
                        errorMessage.includes('Timeout'); // Added Timeout as per instruction snippet
                    console.error(`[UnifiedNotification] ❌ Error processing notification ID: ${notif.id}:`, {
                        error: errorMessage,
                        stack: error.stack,
                        customer_id: notif.customer_id,
                        notification_type: notif.notification_type,
                        channel: notif.channel,
                        is_connection_error: isConnectionError
                    });
                    if (isConnectionError) {
                        // If connection error, DO NOT increment retry count, just delay it
                        // This prevents "Failed" status when WA is down
                        console.log(`[UnifiedNotification] ⏳ Connection error for ID ${notif.id}. Preserving retry count. Rescheduling...`);
                        await connection.query(`UPDATE unified_notifications_queue 
                SET scheduled_for = DATE_ADD(NOW(), INTERVAL 5 MINUTE), status = 'pending', error_message = ?
                WHERE id = ?`, [`Connection issue: ${errorMessage}`, notif.id]);
                        skipped++; // Mark as skipped for this run, will be re-queued
                    }
                    else {
                        // Normal error (invalid number, template error, etc) - Increment retry
                        const retryCount = (notif.retry_count || 0) + 1;
                        const maxRetries = notif.max_retries || 3;
                        if (retryCount < maxRetries) {
                            console.log(`[UnifiedNotification] 🔄 Retrying notification ID: ${notif.id} (attempt ${retryCount}/${maxRetries})`);
                            await connection.query(`UPDATE unified_notifications_queue 
                  SET retry_count = ?, error_message = ?, status = 'pending'
                  WHERE id = ?`, [retryCount, errorMessage, notif.id]);
                        }
                        else {
                            console.error(`[UnifiedNotification] ❌ Notification ID: ${notif.id} failed after ${maxRetries} attempts`);
                            await this.markAsFailed(notif.id, errorMessage);
                            failed++;
                        }
                    }
                }
            }
            console.log(`[UnifiedNotification] 📊 Processing complete: ${sent} sent, ${failed} failed, ${skipped} skipped`);
            return { sent, failed, skipped };
        }
        catch (error) {
            console.error(`[UnifiedNotification] ❌ Fatal error in sendPendingNotifications:`, {
                error: error.message,
                stack: error.stack
            });
            // Attempt to reset 'processing' items back to 'pending' if crash occurs
            // This is a best-effort recovery
            try {
                await connection.query(`UPDATE unified_notifications_queue SET status = 'pending' WHERE status = 'processing' AND TIMESTAMPDIFF(MINUTE, updated_at, NOW()) > 5`);
            }
            catch (e) { /* ignore */ }
            throw error;
        }
        finally {
            connection.release();
        }
    }
    /**
     * Send notification via appropriate channel
     */
    static async sendNotification(notification, customer) {
        const fullMessage = `${notification.title}\n\n${notification.message}`;
        console.log(`[UnifiedNotification] 📤 Sending ${notification.channel} notification to customer ${notification.customer_id}...`);
        console.log(`[UnifiedNotification] 📋 Details:`, {
            notification_id: notification.id,
            template_code: notification.template_code,
            notification_type: notification.notification_type,
            customer_phone: customer.phone ? `${customer.phone.substring(0, 3)}***` : 'N/A',
            message_length: fullMessage.length
        });
        switch (notification.channel) {
            case 'whatsapp':
                if (!customer.phone) {
                    console.error(`[UnifiedNotification] ❌ No phone number for customer ${notification.customer_id}`);
                    throw new Error('Customer phone number not found');
                }
                // Check WhatsApp client status before sending
                const waClient = whatsapp_1.whatsappService;
                const whatsappStatus = waClient.getStatus();
                console.log(`[UnifiedNotification] 📱 WhatsApp Status:`, whatsappStatus);
                if (!whatsappStatus.ready) {
                    console.warn(`[UnifiedNotification] ⚠️ WhatsApp not ready, waiting for connection...`);
                    try {
                        // Wait up to 15 seconds for WhatsApp to become ready
                        await whatsapp_1.whatsappService.waitForReady(15000);
                        console.log(`[UnifiedNotification] ✅ WhatsApp is now ready.`);
                    }
                    catch (err) {
                        console.error(`[UnifiedNotification] ❌ WhatsApp wait failed: ${err.message}`);
                        if (err.message.includes('QR code')) {
                            throw new Error(`WhatsApp memerlukan scan QR code. Silakan buka menu WhatsApp Bisnis.`);
                        }
                        throw new Error(`WhatsApp belum siap. Pastikan sudah login di menu WhatsApp Bisnis. (${err.message})`);
                    }
                }
                const recipient = customer.wa_lid || customer.phone;
                console.log(`[UnifiedNotification] 📱 Sending WhatsApp to ${recipient}...`);
                console.log(`[UnifiedNotification] 📝 Message preview (first 100 chars):`, fullMessage.substring(0, 100));
                try {
                    let whatsappResult;
                    if (notification.attachment_path) {
                        // Verify file exists
                        const fs = await Promise.resolve().then(() => __importStar(require('fs')));
                        if (fs.existsSync(notification.attachment_path)) {
                            console.log(`[UnifiedNotification] 📄 Sending PDF attachment with caption: ${notification.attachment_path}`);
                            // Send document with the full message as caption
                            whatsappResult = await waClient.sendDocument(recipient, notification.attachment_path, `Invois-${notification.invoice_id || 'Tagihan'}.pdf`, fullMessage // Use the full message as caption
                            );
                        }
                        else {
                            console.warn(`[UnifiedNotification] ⚠️ Attachment path provided but file not found: ${notification.attachment_path}. Sending text only.`);
                            whatsappResult = await waClient.sendMessage(recipient, fullMessage);
                        }
                    }
                    else {
                        whatsappResult = await waClient.sendMessage(recipient, fullMessage);
                    }
                    console.log(`[UnifiedNotification] ✅ WhatsApp sent successfully to ${customer.phone}`, {
                        messageId: (whatsappResult === null || whatsappResult === void 0 ? void 0 : whatsappResult.messageId) || 'unknown',
                        notification_id: notification.id
                    });
                }
                catch (sendError) {
                    const errorMsg = sendError.message || 'WhatsApp send failed';
                    console.error(`[UnifiedNotification] ❌ WhatsApp send failed:`, {
                        error: errorMsg,
                        phone: customer.phone,
                        notification_id: notification.id,
                        template_code: notification.template_code,
                        customer_id: notification.customer_id
                    });
                    throw new Error(errorMsg);
                }
                break;
            case 'email':
                // TODO: Implement email sending
                console.log(`[Email] Would send to ${customer.email}: ${notification.title}`);
                break;
            case 'sms':
                // TODO: Implement SMS sending
                console.log(`[SMS] Would send to ${customer.phone}: ${notification.title}`);
                break;
            case 'push':
                // TODO: Implement push notification
                console.log(`[Push] Would send to customer ${notification.customer_id}: ${notification.title}`);
                break;
            default:
                throw new Error(`Unsupported channel: ${notification.channel}`);
        }
    }
    /**
     * Mark notification as failed
     */
    static async markAsFailed(notificationId, errorMessage) {
        const connection = await pool_1.databasePool.getConnection();
        try {
            await connection.query(`UPDATE unified_notifications_queue 
         SET status = 'failed', error_message = ? 
         WHERE id = ?`, [errorMessage, notificationId]);
        }
        finally {
            connection.release();
        }
    }
    /**
     * Mark notification as skipped
     */
    static async markAsSkipped(notificationId, reason) {
        const connection = await pool_1.databasePool.getConnection();
        try {
            await connection.query(`UPDATE unified_notifications_queue 
         SET status = 'skipped', error_message = ? 
         WHERE id = ?`, [reason, notificationId]);
        }
        finally {
            connection.release();
        }
    }
    /**
     * Send invoice created notification
     */
    static async notifyInvoiceCreated(invoiceId, sendImmediately = false) {
        const connection = await pool_1.databasePool.getConnection();
        try {
            const [invoiceRows] = await connection.query(`SELECT i.*, c.name as customer_name, c.phone, c.email
         FROM invoices i
         JOIN customers c ON i.customer_id = c.id
         WHERE i.id = ?`, [invoiceId]);
            if (invoiceRows.length === 0) {
                return;
            }
            const invoice = invoiceRows[0];
            const dueDate = new Date(invoice.due_date);
            const bank = await this.getBankSettings();
            await this.queueNotification({
                customer_id: invoice.customer_id,
                invoice_id: invoiceId,
                notification_type: 'invoice_created',
                variables: {
                    invoice_number: invoice.invoice_number,
                    amount: NotificationTemplateService_1.NotificationTemplateService.formatCurrency(parseFloat(invoice.total_amount)),
                    due_date: NotificationTemplateService_1.NotificationTemplateService.formatDate(dueDate),
                    period: invoice.period,
                    bank_name: bank.bankName,
                    bank_account_number: bank.accountNumber,
                    bank_account_name: bank.accountName,
                    bank_list: bank.bankListText,
                    notes: invoice.notes || ''
                },
                attachment_path: await this.generateInvoicePdf(invoiceId),
                send_immediately: sendImmediately
            });
        }
        finally {
            connection.release();
        }
    }
    /**
     * Helper to generate invoice PDF
     */
    static async generateInvoicePdf(invoiceId) {
        try {
            const { InvoicePdfService } = await Promise.resolve().then(() => __importStar(require('../invoice/InvoicePdfService')));
            const attachmentPath = await InvoicePdfService.generateInvoicePdf(invoiceId);
            console.log(`[UnifiedNotification] 📄 Generated PDF for invoice ${invoiceId}: ${attachmentPath}`);
            return attachmentPath;
        }
        catch (pdfError) {
            console.error(`[UnifiedNotification] ❌ Failed to generate PDF for invoice:`, pdfError);
            return undefined;
        }
    }
    /**
     * Send invoice overdue notification
     */
    static async notifyInvoiceOverdue(invoiceId) {
        const connection = await pool_1.databasePool.getConnection();
        try {
            const [invoiceRows] = await connection.query(`SELECT i.*, c.name as customer_name
         FROM invoices i
         JOIN customers c ON i.customer_id = c.id
         WHERE i.id = ?`, [invoiceId]);
            if (invoiceRows.length === 0) {
                return;
            }
            const invoice = invoiceRows[0];
            const dueDate = new Date(invoice.due_date);
            const now = new Date();
            const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
            const bank = await this.getBankSettings();
            await this.queueNotification({
                customer_id: invoice.customer_id,
                invoice_id: invoiceId,
                notification_type: 'invoice_overdue',
                priority: 'high',
                variables: {
                    invoice_number: invoice.invoice_number,
                    amount: NotificationTemplateService_1.NotificationTemplateService.formatCurrency(parseFloat(invoice.remaining_amount)),
                    due_date: NotificationTemplateService_1.NotificationTemplateService.formatDate(dueDate),
                    days_overdue: daysOverdue,
                    bank_name: bank.bankName,
                    bank_account_number: bank.accountNumber,
                    bank_account_name: bank.accountName,
                    bank_list: bank.bankListText,
                    notes: invoice.notes || ''
                }
            });
        }
        finally {
            connection.release();
        }
    }
    /**
     * Send invoice reminder (Monthly 20th)
     */
    static async notifyInvoiceReminder(invoiceId) {
        const connection = await pool_1.databasePool.getConnection();
        try {
            const [invoiceRows] = await connection.query(`SELECT i.*, c.name as customer_name
         FROM invoices i
         JOIN customers c ON i.customer_id = c.id
         WHERE i.id = ?`, [invoiceId]);
            if (invoiceRows.length === 0)
                return;
            const invoice = invoiceRows[0];
            const dueDate = new Date(invoice.due_date);
            const bank = await this.getBankSettings();
            await this.queueNotification({
                customer_id: invoice.customer_id,
                invoice_id: invoiceId,
                notification_type: 'invoice_reminder',
                priority: 'normal',
                variables: {
                    invoice_number: invoice.invoice_number,
                    amount: NotificationTemplateService_1.NotificationTemplateService.formatCurrency(parseFloat(invoice.remaining_amount)),
                    due_date: NotificationTemplateService_1.NotificationTemplateService.formatDate(dueDate),
                    period: invoice.period || '-',
                    bank_name: bank.bankName,
                    bank_account_number: bank.accountNumber,
                    bank_account_name: bank.accountName,
                    bank_list: bank.bankListText,
                    notes: invoice.notes || ''
                }
            });
        }
        finally {
            connection.release();
        }
    }
    /**
     * Get Bank Settings
     */
    static async getBankSettings() {
        const connection = await pool_1.databasePool.getConnection();
        try {
            const [rows] = await connection.query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('bank_name', 'bank_account_number', 'bank_account_name', 'multiple_banks_enabled', 'payment_banks')");
            const settings = {};
            rows.forEach(r => settings[r.setting_key] = r.setting_value);
            const multipleBanksEnabled = settings['multiple_banks_enabled'] === 'true';
            let bankListText = '';
            if (multipleBanksEnabled && settings['payment_banks']) {
                try {
                    const rawBanks = JSON.parse(settings['payment_banks']);
                    if (Array.isArray(rawBanks)) {
                        const banks = rawBanks.filter((b) => b.is_active !== false);
                        if (banks.length > 0) {
                            bankListText = banks.map((b) => `🏦 *${b.name}*\n💳 ${b.account_number}\n👤 ${b.account_name}`).join('\n\n');
                            // For backward compatibility, use the first active bank for single variables
                            return {
                                bankName: banks[0].name || settings['bank_name'] || 'BCA',
                                accountNumber: banks[0].account_number || settings['bank_account_number'] || '-',
                                accountName: banks[0].account_name || settings['bank_account_name'] || 'Provider',
                                bankListText: bankListText
                            };
                        }
                    }
                }
                catch (e) {
                    console.error('[UnifiedNotification] Error parsing payment_banks JSON:', e);
                }
            }
            // Default (Single Bank)
            const bName = settings['bank_name'] || 'BCA';
            const bAcc = settings['bank_account_number'] || '-';
            const bUser = settings['bank_account_name'] || 'Provider';
            return {
                bankName: bName,
                accountNumber: bAcc,
                accountName: bUser,
                bankListText: `🏦 *${bName}*\n💳 ${bAcc}\n👤 ${bUser}`
            };
        }
        finally {
            connection.release();
        }
    }
    /**
     * Send payment received notification
     */
    static async notifyPaymentReceived(paymentId, sendImmediately = true) {
        console.log(`[UnifiedNotification] 🔔 notifyPaymentReceived called for paymentId: ${paymentId}, sendImmediately: ${sendImmediately}`);
        const connection = await pool_1.databasePool.getConnection();
        try {
            const { getBillingMonth } = await Promise.resolve().then(() => __importStar(require('../../utils/periodHelper')));
            const [paymentRows] = await connection.query(`SELECT p.*, i.invoice_number, i.customer_id, i.total_amount, i.remaining_amount, i.period, i.due_date, i.notes as invoice_notes,
                c.name as customer_name, c.customer_code
         FROM payments p
         JOIN invoices i ON p.invoice_id = i.id
         JOIN customers c ON i.customer_id = c.id
         WHERE p.id = ?`, [paymentId]);
            if (paymentRows.length === 0) {
                return;
            }
            const payment = paymentRows[0];
            const paymentDate = new Date(payment.payment_date);
            const remainingAmount = parseFloat(payment.remaining_amount || '0');
            // Determine notification type
            const notificationType = remainingAmount > 0 ? 'payment_partial' : 'payment_received';
            // Generate PDF if full payment
            let attachmentPath = undefined;
            if (remainingAmount <= 0) {
                try {
                    const { InvoicePdfService } = await Promise.resolve().then(() => __importStar(require('../invoice/InvoicePdfService')));
                    attachmentPath = await InvoicePdfService.generateInvoicePdf(payment.invoice_id);
                    console.log(`[UnifiedNotification] 📄 Generated PDF for payment ${paymentId}: ${attachmentPath}`);
                }
                catch (pdfError) {
                    console.error(`[UnifiedNotification] ❌ Failed to generate PDF for payment:`, pdfError);
                }
            }
            // Format billing month
            const billingMonth = getBillingMonth(payment.period, paymentDate, payment.due_date);
            await this.queueNotification({
                customer_id: payment.customer_id,
                invoice_id: payment.invoice_id,
                payment_id: paymentId,
                notification_type: notificationType,
                attachment_path: attachmentPath,
                variables: {
                    customer_name: payment.customer_name,
                    customer_code: payment.customer_code,
                    invoice_number: payment.invoice_number,
                    billing_month: billingMonth,
                    amount: NotificationTemplateService_1.NotificationTemplateService.formatCurrency(parseFloat(payment.amount)),
                    paid_amount: NotificationTemplateService_1.NotificationTemplateService.formatCurrency(parseFloat(payment.amount)),
                    total_amount: NotificationTemplateService_1.NotificationTemplateService.formatCurrency(parseFloat(payment.total_amount)),
                    remaining_amount: NotificationTemplateService_1.NotificationTemplateService.formatCurrency(remainingAmount),
                    payment_method: (payment.payment_method || 'Tunai') + (payment.notes ? `\n📝 ${payment.notes}` : ''),
                    payment_date: NotificationTemplateService_1.NotificationTemplateService.formatDate(paymentDate),
                    due_date: payment.due_date ? NotificationTemplateService_1.NotificationTemplateService.formatDate(new Date(payment.due_date)) : '-',
                    payment_notes: payment.notes || '',
                    invoice_notes: payment.invoice_notes || '',
                    notes: (payment.notes ? `Pesan: ${payment.notes}` : '') + (payment.notes && payment.invoice_notes ? '\n' : '') + (payment.invoice_notes ? `Keterangan: ${payment.invoice_notes}` : '')
                },
                send_immediately: sendImmediately // Urgent: Payment receipt
            });
        }
        finally {
            connection.release();
        }
    }
    /**
     * Get notification statistics
     */
    static async getStatistics(days = 30) {
        const connection = await pool_1.databasePool.getConnection();
        try {
            const [statsRows] = await connection.query(`SELECT 
           COUNT(*) as total,
           SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
           SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
           SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
           SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped
         FROM unified_notifications_queue
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`, [days]);
            const [typeRows] = await connection.query(`SELECT notification_type, COUNT(*) as count
         FROM unified_notifications_queue
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         GROUP BY notification_type`, [days]);
            const [channelRows] = await connection.query(`SELECT channel, COUNT(*) as count
         FROM unified_notifications_queue
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         GROUP BY channel`, [days]);
            const stats = (statsRows[0] || {});
            const by_type = {};
            const by_channel = {};
            typeRows.forEach((row) => {
                by_type[row.notification_type] = parseInt(row.count);
            });
            channelRows.forEach((row) => {
                by_channel[row.channel] = parseInt(row.count);
            });
            return {
                total: parseInt(stats.total || '0'),
                sent: parseInt(stats.sent || '0'),
                failed: parseInt(stats.failed || '0'),
                pending: parseInt(stats.pending || '0'),
                skipped: parseInt(stats.skipped || '0'),
                by_type,
                by_channel
            };
        }
        finally {
            connection.release();
        }
    }
    /**
     * Broadcast message to all Admins/Operators
     */
    static async broadcastToAdmins(message) {
        try {
            // Use pool directly to avoid queue overhead for system alerts
            const [users] = await pool_1.databasePool.query("SELECT phone FROM users WHERE role IN ('admin', 'superadmin', 'operator') AND is_active = 1 AND phone IS NOT NULL");
            if (users.length === 0)
                return;
            const waClient = whatsapp_1.whatsappService;
            for (const user of users) {
                // Send directly
                await waClient.sendMessage(user.phone, message).catch(err => {
                    console.warn(`[UnifiedNotification] Failed to broadcast to admin ${user.phone}:`, err.message);
                });
            }
        }
        catch (error) {
            console.error('[UnifiedNotification] Broadcast Error:', error);
        }
    }
}
exports.UnifiedNotificationService = UnifiedNotificationService;
