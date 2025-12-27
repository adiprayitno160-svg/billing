/**
 * Utility to ensure all notification templates exist in database
 * Run this after schema initialization to ensure all templates are present
 */

import { databasePool } from '../db/pool';

export async function ensureNotificationTemplates(): Promise<void> {
  const conn = await databasePool.getConnection();

  try {
    // Templates to ensure exist
    const templates = [
      {
        template_code: 'customer_created',
        template_name: 'Pelanggan Baru',
        notification_type: 'customer_created',
        channel: 'whatsapp',
        title_template: 'Selamat Datang - {customer_code}',
        message_template: '🎉 *Selamat Datang!*\n\nHalo {customer_name},\n\nTerima kasih telah bergabung dengan layanan internet kami!\n\n📋 *Informasi Akun Anda:*\n🆔 Kode Pelanggan: {customer_code}\n🔌 Tipe Koneksi: {connection_type}{package_info}{pppoe_info}{ip_info}\n\n💡 *Tips:*\n• Simpan informasi ini dengan aman\n• Hubungi kami jika ada pertanyaan\n• Nikmati layanan internet Anda!\n\nTerima kasih,\nTim Support',
        variables: JSON.stringify(['customer_name', 'customer_code', 'connection_type', 'package_info', 'pppoe_info', 'ip_info']),
        priority: 'normal',
        is_active: true
      },
      {
        template_code: 'service_blocked',
        template_name: 'Layanan Diblokir',
        notification_type: 'service_blocked',
        channel: 'whatsapp',
        title_template: 'Layanan Internet Diblokir',
        message_template: '⚠️ *Layanan Internet Diblokir*\n\nHalo {customer_name},\n\nLayanan internet Anda telah diblokir karena:\n\n📋 *Alasan:*\n{reason}\n\n📄 *Detail:*\n{details}\n\n💡 *Cara Mengaktifkan Kembali:*\n• Lakukan pembayaran tagihan yang tertunggak\n• Hubungi customer service untuk informasi lebih lanjut\n• Setelah pembayaran, layanan akan otomatis diaktifkan kembali\n\nTerima kasih,\nTim Support',
        variables: JSON.stringify(['customer_name', 'reason', 'details']),
        priority: 'high',
        is_active: true
      },
      {
        template_code: 'service_unblocked',
        template_name: 'Layanan Diaktifkan Kembali',
        notification_type: 'service_unblocked',
        channel: 'whatsapp',
        title_template: 'Layanan Internet Diaktifkan Kembali',
        message_template: '✅ *Layanan Internet Diaktifkan Kembali*\n\nHalo {customer_name},\n\nLayanan internet Anda telah diaktifkan kembali!\n\n📋 *Informasi:*\n{details}\n\n💡 *Terima Kasih:*\nTerima kasih telah melakukan pembayaran. Nikmati layanan internet Anda kembali!\n\nJika ada pertanyaan, jangan ragu untuk menghubungi kami.\n\nTerima kasih,\nTim Support',
        variables: JSON.stringify(['customer_name', 'details']),
        priority: 'normal',
        is_active: true
      },
      {
        template_code: 'customer_deleted',
        template_name: 'Pelanggan Dihapus',
        notification_type: 'customer_deleted',
        channel: 'whatsapp',
        title_template: 'Akun Anda Telah Dihapus',
        message_template: '⚠️ *Pemberitahuan Penghapusan Akun*\n\nHalo {customer_name},\n\nKami memberitahukan bahwa akun Anda dengan kode pelanggan *{customer_code}* telah dihapus dari sistem kami.\n\n📋 *Informasi:*\n• Nama: {customer_name}\n• Kode Pelanggan: {customer_code}\n• Status: Akun telah dihapus\n\n💡 *Catatan:*\n• Semua data terkait akun Anda telah dihapus dari sistem\n• Jika ini adalah kesalahan, silakan hubungi customer service kami\n• Terima kasih telah menggunakan layanan kami\n\nJika ada pertanyaan atau keberatan, jangan ragu untuk menghubungi kami.\n\nTerima kasih,\nTim Support',
        variables: JSON.stringify(['customer_name', 'customer_code']),
        priority: 'high',
        is_active: true
      },

      {
        template_code: 'payment_partial',
        template_name: 'Pembayaran Kurang',
        notification_type: 'payment_partial',
        channel: 'whatsapp',
        title_template: 'Pembayaran Kurang',
        message_template: '⚠️ *Pembayaran Kurang*\n\nHalo {customer_name},\n\nTerima kasih atas pembayaran Anda untuk invoice *{invoice_number}*.\n\n📋 *Detail Pembayaran:*\n• Invoice: {invoice_number}\n• Jumlah Tagihan: Rp {total_amount}\n• Jumlah Dibayar: Rp {paid_amount}\n• Sisa Tagihan: Rp {remaining_amount}\n\n💡 *Informasi Penting:*\n• Masih ada sisa tagihan yang harus dilunasi\n• Silakan lakukan pembayaran sisa tagihan segera\n• Layanan dapat terganggu jika sisa tagihan tidak dilunasi\n• Hubungi kami jika ada pertanyaan tentang tagihan\n\n📅 *Jatuh Tempo:* {due_date}\n\nTerima kasih,\nTim Support',
        variables: JSON.stringify(['customer_name', 'invoice_number', 'total_amount', 'paid_amount', 'remaining_amount', 'due_date']),
        priority: 'high',
        is_active: true
      },
      {
        template_code: 'payment_debt',
        template_name: 'Pembayaran Ditunda/Hutang',
        notification_type: 'payment_debt',
        channel: 'whatsapp',
        title_template: 'Pembayaran Ditunda',
        message_template: '📋 *Pembayaran Ditunda / Hutang*\n\nHalo {customer_name},\n\nKami memberitahukan bahwa pembayaran untuk invoice *{invoice_number}* telah ditunda dan dicatat sebagai hutang.\n\n📋 *Detail Hutang:*\n• Invoice: {invoice_number}\n• Jumlah Tagihan: Rp {total_amount}\n• Jumlah Hutang: Rp {debt_amount}\n• Alasan: {debt_reason}\n• Tanggal Hutang: {debt_date}\n• Jatuh Tempo: {due_date}\n\n💡 *Informasi Penting:*\n• Hutang ini harus dilunasi sesuai kesepakatan\n• Silakan hubungi customer service untuk informasi lebih lanjut\n• Layanan dapat terganggu jika hutang tidak dilunasi\n• Catatan: {notes}\n\nJika ada pertanyaan, jangan ragu untuk menghubungi kami.\n\nTerima kasih,\nTim Support',
        variables: JSON.stringify(['customer_name', 'invoice_number', 'total_amount', 'debt_amount', 'debt_reason', 'debt_date', 'due_date', 'notes']),
        priority: 'high',
        is_active: true
      },
      {
        template_code: 'isolation_warning',
        template_name: 'Peringatan Sebelum Isolir',
        notification_type: 'isolation_warning',
        channel: 'whatsapp',
        title_template: 'Peringatan: Layanan Akan Diisolir',
        message_template: '⚠️ *Peringatan: Layanan Akan Diisolir*\n\nHalo {customer_name},\n\nKami mengingatkan bahwa layanan internet Anda akan diisolir dalam *{days_remaining} hari* jika tagihan tidak dilunasi.\n\n📋 *Detail Tagihan:*\n• Invoice: {invoice_number}\n• Jumlah Tagihan: Rp {total_amount}\n• Sisa Tagihan: Rp {remaining_amount}\n• Jatuh Tempo: {due_date}\n• Hari Tersisa: {days_remaining} hari\n\n💡 *Tindakan yang Diperlukan:*\n• Segera lakukan pembayaran tagihan yang tertunggak\n• Setelah pembayaran, layanan akan tetap aktif\n• Jika tidak dibayar, layanan akan diisolir otomatis\n• Hubungi customer service jika ada pertanyaan\n\n📱 *Cara Pembayaran:*\n• Transfer ke rekening yang tertera di invoice\n• Atau datang ke kantor kami\n• Konfirmasi pembayaran setelah transfer\n\nJangan sampai layanan Anda terganggu. Lakukan pembayaran sekarang!\n\nTerima kasih,\nTim Support',
        variables: JSON.stringify(['customer_name', 'invoice_number', 'total_amount', 'remaining_amount', 'due_date', 'days_remaining']),
        priority: 'high',
        is_active: true
      },
      {
        template_code: 'payment_shortage_warning',
        template_name: 'Peringatan Pembayaran Kurang/Menunggak',
        notification_type: 'payment_shortage_warning',
        channel: 'whatsapp',
        title_template: 'Peringatan: Pembayaran Masih Kurang',
        message_template: '⚠️ *Peringatan: Pembayaran Masih Kurang / Menunggak*\n\nHalo {customer_name},\n\nKami mengingatkan bahwa Anda masih memiliki tagihan yang *belum dilunasi* atau *kurang pembayaran*.\n\n📋 *Detail Tagihan:*\n• Invoice: {invoice_number}\n• Jumlah Tagihan: Rp {total_amount}\n• Jumlah Dibayar: Rp {paid_amount}\n• Sisa Tagihan: Rp {remaining_amount}\n• Jatuh Tempo: {due_date}\n• Hari Menunggak: {days_overdue} hari\n\n💡 *Informasi Penting:*\n• Pembayaran Anda masih kurang atau belum dilunasi\n• Silakan segera lakukan pembayaran sisa tagihan\n• Layanan dapat terganggu jika tagihan tidak dilunasi\n• Hubungi customer service jika ada pertanyaan\n\n📱 *Cara Pembayaran:*\n• Transfer ke rekening yang tertera di invoice\n• Cantumkan nomor invoice di keterangan transfer\n• Konfirmasi pembayaran setelah transfer\n\nJangan sampai layanan Anda terganggu. Segera lakukan pembayaran!\n\nTerima kasih,\nTim Support',
        variables: JSON.stringify(['customer_name', 'invoice_number', 'total_amount', 'paid_amount', 'remaining_amount', 'due_date', 'days_overdue']),
        priority: 'high',
        is_active: true
      },
      {
        template_code: 'pre_block_warning',
        template_name: 'Peringatan Blokir Awal Bulan',
        notification_type: 'pre_block_warning',
        channel: 'whatsapp',
        title_template: 'Peringatan: Layanan Akan Diblokir Tanggal 1',
        message_template: '🚨 *PERINGATAN: Layanan Akan Diblokir*\n\nHalo {customer_name},\n\nKami mengingatkan bahwa layanan internet Anda akan *DIBLOKIR pada tanggal {blocking_date}* jika tagihan tidak dilunasi.\n\n📋 *Detail Tagihan:*\n• Kode Pelanggan: {customer_code}\n• Invoice: {invoice_number}\n• Jumlah Tagihan: Rp {total_amount}\n• Sisa Tagihan: Rp {remaining_amount}\n• Jatuh Tempo: {due_date}\n\n⏳ *Waktu Tersisa: {days_until_block} hari*\n\n⚠️ *PENTING:*\n• Tanggal 1 adalah masa transisi ke blokir\n• Segera lakukan pembayaran sebelum tanggal 1\n• Setelah diblokir, layanan tidak dapat digunakan\n• Pembayaran setelah blokir akan memulihkan layanan\n\n📱 *Cara Pembayaran:*\n• Transfer ke rekening yang tertera di invoice\n• Cantumkan nomor invoice di keterangan transfer\n• Konfirmasi pembayaran setelah transfer\n\n🔔 Jangan sampai layanan Anda terputus. Bayar sekarang!\n\nTerima kasih,\nTim Support',
        variables: JSON.stringify(['customer_name', 'customer_code', 'invoice_number', 'total_amount', 'remaining_amount', 'due_date', 'blocking_date', 'days_until_block']),
        priority: 'high',
        is_active: true
      }
    ];

    for (const template of templates) {
      // Check if template exists
      const [existing] = await conn.query(
        'SELECT id FROM notification_templates WHERE template_code = ?',
        [template.template_code]
      );

      if (Array.isArray(existing) && existing.length === 0) {
        // Insert template
        await conn.query(
          `INSERT INTO notification_templates 
           (template_code, template_name, notification_type, channel, title_template, 
            message_template, variables, priority, is_active) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            template.template_code,
            template.template_name,
            template.notification_type,
            template.channel,
            template.title_template,
            template.message_template,
            template.variables,
            template.priority,
            template.is_active
          ]
        );
        console.log(`✅ Template ${template.template_code} inserted`);
      } else {
        console.log(`ℹ️  Template ${template.template_code} already exists`);
      }
    }

    console.log('✅ All notification templates ensured');
  } catch (error) {
    console.error('❌ Error ensuring notification templates:', error);
    throw error;
  } finally {
    conn.release();
  }
}




