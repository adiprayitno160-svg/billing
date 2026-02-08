
const { databasePool } = require('./src/db/pool');

async function updateTemplates() {
    try {
        // Payment Received
        const paymentReceivedMsg = "Halo {customer_name},\n\n✅ Pembayaran Anda telah diterima:\n\n📄 Invoice: {invoice_number}\n{billing_summary}\n💳 Metode: {payment_method}\n📅 Tanggal: {payment_date}\n\nTerima kasih atas pembayaran Anda.";
        await databasePool.query(
            "UPDATE notification_templates SET message_template = ? WHERE notification_type = 'payment_received' AND channel = 'whatsapp'",
            [paymentReceivedMsg]
        );

        // Payment Partial
        const paymentPartialMsg = "Halo {customer_name},\n\n✅ Pembayaran parsial diterima:\n\n📄 Invoice: {invoice_number}\n{billing_summary}\n💳 Metode: {payment_method}\n📅 Tanggal: {payment_date}\n\nHarap lunasi sisa tagihan sebelum jatuh tempo. Terima kasih.";
        await databasePool.query(
            "UPDATE notification_templates SET message_template = ? WHERE notification_type = 'payment_partial' AND channel = 'whatsapp'",
            [paymentPartialMsg]
        );

        // Invoice Overdue
        const invoiceOverdueMsg = "Halo {customer_name},\n\n⚠️ Invoice Anda telah melewati jatuh tempo:\n\n📄 Invoice: {invoice_number}\n{billing_summary}\n📅 Jatuh Tempo: {due_date}\n⏰ Terlambat: {days_overdue} hari\n\nSilakan segera lakukan pembayaran untuk menghindari gangguan layanan.\n\nTerima kasih.";
        await databasePool.query(
            "UPDATE notification_templates SET message_template = ? WHERE notification_type = 'invoice_overdue' AND channel = 'whatsapp'",
            [invoiceOverdueMsg]
        );

        // Invoice Created
        const invoiceCreatedMsg = "Halo {customer_name},\n\n📄 Invoice baru telah diterbitkan:\n\nInvoice: {invoice_number}\nPeriode: {period}\n{billing_summary}\n📅 Jatuh Tempo: {due_date}\n\n💳 Pembayaran dapat melalui:\n{bank_list}\n\nTerima kasih.";
        await databasePool.query(
            "UPDATE notification_templates SET message_template = ? WHERE notification_type = 'invoice_created' AND channel = 'whatsapp'",
            [invoiceCreatedMsg]
        );

        console.log("Templates updated successfully");
        process.exit(0);
    } catch (error) {
        console.error("Error updating templates:", error);
        process.exit(1);
    }
}

updateTemplates();
