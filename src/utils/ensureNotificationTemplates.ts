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
        message_template: '⚠️ *Pembayaran Kurang*\n\nHalo {customer_name},\n\nTerima kasih atas pembayaran Anda untuk invoice *{invoice_number}*.\n\n📋 *Detail Pembayaran:*\n• Invoice: {invoice_number}\n• Jumlah Tagihan: Rp {total_amount}\n• Jumlah Dibayar: Rp {paid_amount}\n• Sisa Tagihan: Rp {remaining_amount}\n\n💰 *Informasi Saldo:*\n• Digunakan: Rp {balance_used}\n• Saldo Bertambah: Rp {excess_amount}\n• Saldo Akhir: Rp {new_balance}\n\n💡 *Informasi Penting:*\n• Masih ada sisa tagihan yang harus dilunasi\n• Silakan lakukan pembayaran sisa tagihan segera\n• Layanan dapat terganggu jika sisa tagihan tidak dilunasi\n• Hubungi kami jika ada pertanyaan tentang tagihan\n\n📅 *Jatuh Tempo:* {due_date}\n\nTerima kasih,\nTim Support',
        variables: JSON.stringify(['customer_name', 'invoice_number', 'total_amount', 'paid_amount', 'remaining_amount', 'due_date', 'balance_used', 'excess_amount', 'new_balance']),
        priority: 'high',
        is_active: true
      },
      {
        template_code: 'payment_received',
        template_name: 'Pembayaran Diterima',
        notification_type: 'payment_received',
        channel: 'whatsapp',
        title_template: 'Pembayaran Diterima - {invoice_number}',
        message_template: '✅ *Pembayaran Diterima*\n\nHalo {customer_name},\n\nTerima kasih! Pembayaran Anda telah kami terima.\n\n📋 *Detail Pembayaran:*\n• Invoice: {invoice_number}\n• Jumlah: Rp {amount}\n• Metode: {payment_method}\n• Tanggal: {payment_date}\n\n💰 *Informasi Saldo:*\n• Digunakan: Rp {balance_used}\n• Saldo Bertambah: Rp {excess_amount}\n• Saldo Akhir: Rp {new_balance}\n\n💡 *Terima Kasih:*\nLayanan internet Anda tetap aktif. Terima kasih atas kerja samanya!\n\nJika ada pertanyaan, silakan hubungi kami.\n\nTerima kasih,\nTim Support',
        variables: JSON.stringify(['customer_name', 'invoice_number', 'amount', 'payment_method', 'payment_date', 'balance_used', 'excess_amount', 'new_balance']),
        priority: 'normal',
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
        message_template: '🚨 *PERINGATAN: Layanan Akan Diblokir*\n\nHalo {customer_name},\n\nKami mengingatkan bahwa layanan internet Anda akan *DIBLOKIR pada tanggal {blocking_date}* jika tagihan tidak dilunasi.\n\n📋 *Detail Tagihan:*\n• Kode Pelanggan: {customer_code}\n• Invoice: {invoice_number}\n• Jumlah Tagihan: Rp {total_amount}\n• Sisa Tagihan: Rp {remaining_amount}\n• Jatuh Tempo: {due_date}\n\n⏳ *Waktu Tersisa: {days_until_block} hari*\n\n⚠️ *PENTING:*\n• Tanggal 1 adalah masa transisi ke blokir\n• Segera lakukan pembayaran sebelum tanggal 1\n• Setelah diblokir, layanan tidak dapat digunakan\n• Pembayaran setelah blokir akan memulihkan layanan\n\n📱 *Cara Pembayaran:*\n• Transfer ke rekening yang tertera di invoice\n• Cantumkan nomor invoice di keterangan transfer\n• Konfirmasi pembayaran setelah transfer\n\n        🔔 Jangan sampai layanan Anda terputus. Bayar sekarang!\n\nTerima kasih,\nTim Support',
        variables: JSON.stringify(['customer_name', 'customer_code', 'invoice_number', 'total_amount', 'remaining_amount', 'due_date', 'blocking_date', 'days_until_block']),
        priority: 'high',
        is_active: true
      },
      {
        template_code: 'payment_deferment_approved',
        template_name: 'Penundaan Pembayaran Disetujui',
        notification_type: 'payment_deferment',
        channel: 'whatsapp',
        title_template: 'Penundaan Pembayaran Disetujui',
        message_template: '✅ *Penundaan Pembayaran Disetujui*\n\nHalo {customer_name},\n\nPermintaan penundaan pembayaran Anda telah *DISETUJUI*.\n\n📋 *Informasi:*\n{details}\n\n💡 *Penting:*\nHarap lakukan pembayaran sebelum batas waktu tersebut untuk menghindari pemutusan layanan otomatis oleh sistem.\n\nTerima kasih,\nTim Support',
        variables: JSON.stringify(['customer_name', 'details']),
        priority: 'normal',
        is_active: true
      },
      {
        template_code: 'payment_deferment_limit',
        template_name: 'Limit Penundaan Tercapai',
        notification_type: 'payment_deferment',
        channel: 'whatsapp',
        title_template: 'Limit Penundaan Tercapai',
        message_template: '⚠️ *Limit Penundaan Tercapai*\n\nHalo {customer_name},\n\nMohon maaf, permintaan penundaan pembayaran Anda *GAGAL*.\n\n📋 *Alasan:*\n{details}\n\n💡 *Tindakan:*\nSilakan lakukan pelunasan tagihan segera agar layanan tetap aktif.\n\nTerima kasih,\nTim Support',
        variables: JSON.stringify(['customer_name', 'details']),
        priority: 'high',
        is_active: true
      },
      // Technician Job Templates
      {
        template_code: 'technician_job_created',
        template_name: 'Pekerjaan Baru Untuk Teknisi',
        notification_type: 'technician_job',
        channel: 'whatsapp',
        title_template: '🛠️ PEKERJAAN BARU TERSEDIA',
        message_template: '*🛠️ PEKERJAAN BARU TERSEDIA*\n\n🎫 Tiket: *{ticket_number}*\n📂 Tipe: *{job_type}*\n📝 Judul: {title}\n🚨 Prioritas: {priority}\n📍 Lokasi: {location}\n\nUntuk mengambil, balas:\n*!ambil {ticket_number}*\n\nTerima kasih.',
        variables: JSON.stringify(['ticket_number', 'job_type', 'title', 'priority', 'location']),
        priority: 'normal',
        is_active: true
      },
      {
        template_code: 'technician_job_accepted',
        template_name: 'Pekerjaan Diterima Teknisi',
        notification_type: 'technician_job',
        channel: 'whatsapp',
        title_template: '✅ PEKERJAAN DIAMBIL',
        message_template: '*✅ PEKERJAAN DIAMBIL*\n\nHalo {customer_name},\n\nPekerjaan Anda telah diterima oleh teknisi kami.\n\n📋 *DETAIL PEKERJAAN*:\n• Tiket: #{ticket_number}\n• Teknisi: {technician_name}\n• Tanggal: {accept_date}\n\n🔧 Teknisi akan segera menghubungi Anda untuk penjadwalan.\n\nTerima kasih.',
        variables: JSON.stringify(['customer_name', 'ticket_number', 'technician_name', 'accept_date']),
        priority: 'normal',
        is_active: true
      },
      {
        template_code: 'technician_job_completed',
        template_name: 'Pekerjaan Selesai',
        notification_type: 'technician_job',
        channel: 'whatsapp',
        title_template: '✅ PEKERJAAN SELESAI',
        message_template: '*✅ PEKERJAAN SELESAI*\n\nHalo {customer_name},\n\nPekerjaan *{title}* (# {ticket_number}) telah diselesaikan oleh teknisi kami.\n\n📅 Waktu: {completion_date}\n📋 Catatan: {completion_notes}\n{proof_info}\n\nTerima kasih telah menggunakan layanan kami.',
        variables: JSON.stringify(['customer_name', 'title', 'ticket_number', 'completion_date', 'completion_notes', 'proof_info']),
        priority: 'normal',
        is_active: true
      },
      {
        template_code: 'technician_job_cancelled',
        template_name: 'Pekerjaan Dibatalkan',
        notification_type: 'technician_job',
        channel: 'whatsapp',
        title_template: '❌ PEKERJAAN DIBATALKAN',
        message_template: '*❌ PEKERJAAN DIBATALKAN*\n\nHalo {customer_name},\n\nMohon maaf, pekerjaan *{title}* (# {ticket_number}) telah dibatalkan.\n\n📋 *ALASAN PEMBATALAN*:\n{cancellation_reason}\n\n💡 *INFORMASI*:\n• Jika ada pertanyaan, silakan hubungi customer service\n• Kami akan membuat tiket baru jika diperlukan\n\nTerima kasih atas pengertiannya.',
        variables: JSON.stringify(['customer_name', 'title', 'ticket_number', 'cancellation_reason']),
        priority: 'high',
        is_active: true
      },
      {
        template_code: 'technician_report_submitted',
        template_name: 'Laporan Teknisi Dikirim',
        notification_type: 'technician_job',
        channel: 'whatsapp',
        title_template: '📋 LAPORAN TEKNISI',
        message_template: '*📋 LAPORAN TEKNISI*\n\nTiket: *{ticket_number}*\nStatus: *{status}*\nCustomer: {customer_name}\nWaktu: {report_time}\nCatatan: {notes}\n\nLaporan telah tersimpan di sistem.',
        variables: JSON.stringify(['ticket_number', 'status', 'customer_name', 'report_time', 'notes']),
        priority: 'normal',
        is_active: true
      },
      {
        template_code: 'invoice_created',
        template_name: 'Tagihan Baru',
        notification_type: 'invoice_created',
        channel: 'whatsapp',
        title_template: 'Tagihan Baru - {invoice_number}',
        message_template: '📄 *TAGIHAN INTERNET BARU*\n\nHalo {customer_name},\n\nTagihan internet Anda untuk periode *{period}* telah tersedia.\n\n📋 *Rincian Tagihan:*\n• No. Invoice: {invoice_number}\n• Nominal: Rp {amount}\n• Jatuh Tempo: {due_date}\n\n💳 *Metode Pembayaran:*\n{bank_list}\n\n💡 *Catatan:*\n• Abaikan jika sudah membayar\n• Konfirmasi jika melakukan transfer bank\n• Layanan otomatis diperpanjang setelah lunas\n\nTerima kasih,\nTim Support',
        variables: JSON.stringify(['customer_name', 'invoice_number', 'amount', 'due_date', 'period', 'bank_list']),
        priority: 'normal',
        is_active: true
      },
      {
        template_code: 'invoice_overdue',
        template_name: 'Tagihan Menunggak',
        notification_type: 'invoice_overdue',
        channel: 'whatsapp',
        title_template: '⚠️ Peringatan: Tagihan Menunggak',
        message_template: '⚠️ *PERINGATAN TAGIHAN MENUNGGAK*\n\nHalo {customer_name},\n\nKami menginformasikan bahwa tagihan Anda telah melewati jatuh tempo.\n\n📋 *Rincian:*\n• No. Invoice: {invoice_number}\n• Total Tunggakan: Rp {amount}\n• Jatuh Tempo: {due_date}\n• Terlambat: {days_overdue} hari\n\n💳 *Segera lakukan pembayaran ke:*\n{bank_list}\n\n🚨 *PENTING:*\nHindari isolir layanan otomatis dengan segera melunasi tagihan.\n\nTerima kasih,\nTim Support',
        variables: JSON.stringify(['customer_name', 'invoice_number', 'amount', 'due_date', 'days_overdue', 'bank_list']),
        priority: 'high',
        is_active: true
      },
      {
        template_code: 'invoice_reminder',
        template_name: 'Pengingat Tagihan',
        notification_type: 'invoice_reminder',
        channel: 'whatsapp',
        title_template: 'Reminder: Tagihan Bulanan',
        message_template: '🔔 *PENGINGAT TAGIHAN INTERNET*\n\nHalo {customer_name},\n\nJangan lupa, tagihan periode *{period}* sebentar lagi jatuh tempo.\n\n📋 *Rincian:*\n• No. Invoice: {invoice_number}\n• Nominal: Rp {amount}\n• Jatuh Tempo: {due_date}\n\n💳 *Pembayaran via:*\n{bank_list}\n\nNikmati terus internet lancar tanpa kendala!\n\nTerima kasih,\nTim Support',
        variables: JSON.stringify(['customer_name', 'invoice_number', 'amount', 'due_date', 'period', 'bank_list']),
        priority: 'normal',
        is_active: true
      },
      {
        template_code: 'broadcast',
        template_name: 'Broadcast Massal',
        notification_type: 'broadcast',
        channel: 'whatsapp',
        title_template: 'Pengumuman - {customer_name}',
        message_template: '{custom_message}',
        variables: JSON.stringify(['customer_name', 'custom_message']),
        priority: 'normal',
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




