# WhatsApp Business Server Setup

Server WhatsApp Business untuk notifikasi billing telah berhasil diintegrasikan ke dalam sistem.

## Fitur

1. **Pengiriman Pesan WhatsApp Otomatis**
   - Notifikasi pembayaran diterima
   - Peringatan pembayaran telat
   - Notifikasi tagihan baru
   - Notifikasi prepaid

2. **API Endpoints**
   - Status WhatsApp service
   - Kirim pesan tunggal
   - Kirim pesan bulk
   - Kirim ke customer berdasarkan ID
   - History notifikasi
   - Statistik notifikasi

3. **Logging & Tracking**
   - Semua notifikasi dicatat di database (`notification_logs`)
   - Tracking status (sent, failed, pending)
   - Error logging untuk debugging

## Setup Awal

### 1. Install Dependencies

Dependencies sudah terinstall:
- `whatsapp-web.js` - Library untuk WhatsApp Web API
- `qrcode-terminal` - Untuk menampilkan QR code di terminal

### 2. Scan QR Code

Saat server pertama kali dijalankan:

1. Server akan menampilkan QR code di terminal
2. Buka WhatsApp di smartphone Anda
3. Pergi ke **Settings > Linked Devices**
4. Pilih **Link a Device**
5. Scan QR code yang ditampilkan di terminal
6. Setelah berhasil, WhatsApp service siap digunakan

**Catatan:** Session WhatsApp akan disimpan di folder `whatsapp-session/` untuk koneksi otomatis di masa depan.

## API Endpoints

### 1. Get Status
```
GET /whatsapp/status
```

Response:
```json
{
  "success": true,
  "data": {
    "ready": true,
    "initialized": true,
    "stats": {
      "total": 100,
      "sent": 95,
      "failed": 5,
      "pending": 0,
      "successRate": 95
    }
  }
}
```

### 2. Send Message
```
POST /whatsapp/send
Content-Type: application/json

{
  "phone": "081234567890",
  "message": "Pesan Anda",
  "customerId": 123,
  "template": "payment_notification"
}
```

### 3. Send to Customer
```
POST /whatsapp/send-to-customer
Content-Type: application/json

{
  "customerId": 123,
  "message": "Pesan Anda",
  "template": "payment_notification"
}
```

### 4. Send Bulk Messages
```
POST /whatsapp/send-bulk
Content-Type: application/json

{
  "recipients": [
    {
      "phone": "081234567890",
      "message": "Pesan 1",
      "customerId": 123
    },
    {
      "phone": "081234567891",
      "message": "Pesan 2",
      "customerId": 124
    }
  ],
  "delayMs": 2000
}
```

### 5. Get Notification History
```
GET /whatsapp/history?limit=50&customerId=123&status=sent
```

### 6. Get Statistics
```
GET /whatsapp/stats
```

### 7. Send Payment Notification
```
POST /whatsapp/send-payment-notification
Content-Type: application/json

{
  "customerId": 123,
  "invoiceId": 456,
  "amount": 100000,
  "paymentMethod": "transfer",
  "paymentId": 789,
  "paymentType": "full"
}
```

## Format Nomor Telepon

Nomor telepon akan otomatis diformat:
- `081234567890` → `6281234567890@c.us`
- `81234567890` → `6281234567890@c.us`
- `+6281234567890` → `6281234567890@c.us`

Format default menggunakan kode negara Indonesia (62).

## Integrasi dengan Sistem Billing

WhatsApp service sudah terintegrasi dengan:

1. **KasirController** - Notifikasi pembayaran otomatis
2. **LatePaymentTrackingService** - Peringatan pembayaran telat
3. **SmartNotificationService** - Notifikasi prepaid

Semua notifikasi otomatis dikirim saat:
- Pembayaran diterima
- Pembayaran telat (3x dan 4x)
- Tagihan baru dibuat
- Prepaid package akan expired

## Troubleshooting

### WhatsApp Client Tidak Ready

Jika status `ready: false`:

1. Periksa apakah QR code sudah di-scan
2. Periksa koneksi internet
3. Restart server dan scan ulang QR code
4. Hapus folder `whatsapp-session/` dan scan ulang

### Pesan Gagal Terkirim

1. Periksa format nomor telepon
2. Pastikan nomor sudah terdaftar di WhatsApp
3. Periksa log error di database (`notification_logs`)
4. Pastikan WhatsApp client dalam status ready

### Session Expired

Jika session expired:

1. Hapus folder `whatsapp-session/`
2. Restart server
3. Scan QR code ulang

## Keamanan

- Session WhatsApp disimpan lokal di folder `whatsapp-session/`
- Jangan share folder session dengan pihak lain
- Pastikan folder `whatsapp-session/` tidak di-commit ke git (sudah ada di .gitignore)

## Monitoring

Semua notifikasi dicatat di tabel `notification_logs` dengan kolom:
- `channel`: 'whatsapp'
- `status`: 'sent', 'failed', atau 'pending'
- `error_message`: Pesan error jika gagal
- `sent_at`: Waktu pengiriman

Gunakan endpoint `/whatsapp/stats` untuk melihat statistik notifikasi.

## Catatan Penting

1. **Rate Limiting**: WhatsApp memiliki batasan pengiriman pesan. Gunakan delay minimal 2 detik untuk bulk messages.

2. **WhatsApp Business**: Untuk penggunaan production, pertimbangkan menggunakan WhatsApp Business API resmi untuk stabilitas yang lebih baik.

3. **Backup Session**: Backup folder `whatsapp-session/` secara berkala untuk menghindari kehilangan koneksi.

4. **Multiple Devices**: WhatsApp Web hanya bisa terhubung ke satu device pada satu waktu.








