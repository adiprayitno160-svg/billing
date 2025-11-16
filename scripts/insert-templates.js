/**
 * Script to insert missing notification templates
 * Run: node scripts/insert-templates.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

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
  }
];

async function insertTemplates() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'billing'
  });

  try {
    console.log('Checking and inserting templates...\n');
    
    for (const template of templates) {
      // Check if exists
      const [existing] = await connection.query(
        'SELECT id FROM notification_templates WHERE template_code = ?',
        [template.template_code]
      );
      
      if (existing.length === 0) {
        // Insert
        await connection.query(
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
        console.log(`✅ Inserted: ${template.template_code}`);
      } else {
        console.log(`ℹ️  Already exists: ${template.template_code}`);
      }
    }
    
    // Count total templates
    const [count] = await connection.query('SELECT COUNT(*) as total FROM notification_templates');
    console.log(`\n✅ Total templates: ${count[0].total}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

insertTemplates();





