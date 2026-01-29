# Sistem Validasi Pembayaran Sebelum Perubahan Paket

## Gambaran Umum
Sistem ini dirancang untuk memastikan bahwa pelanggan postpaid menyelesaikan pembayaran tagihan tertunggak sebelum dapat melakukan perubahan paket layanan. Sistem ini memberikan notifikasi WhatsApp otomatis dan antarmuka admin untuk manajemen perubahan paket.

## Komponen Utama

### 1. Service Validasi Pembayaran ([PackageChangeValidationService](file:///c:/laragon/www/billing/src/services/billing/PackageChangeValidationService.ts))
- Memeriksa apakah pelanggan memiliki tagihan tertunggak
- Menentukan apakah pelanggan postpaid atau prepaid
- Mengembalikan informasi detail tentang tagihan yang belum dibayar

### 2. Service Notifikasi WhatsApp ([PackageChangeNotificationService](file:///c:/laragon/www/billing/src/services/whatsapp/PackageChangeNotificationService.ts))
- Mengirim notifikasi otomatis ke pelanggan tentang tagihan tertunggak
- Format pesan profesional dalam Bahasa Indonesia
- Fungsi untuk notifikasi massal

### 3. Service Perubahan Paket ([PackageChangeService](file:///c:/laragon/www/billing/src/services/billing/PackageChangeService.ts))
- Integrasi validasi sebelum perubahan paket
- Fungsi untuk perubahan paket static IP dan PPPoE
- Fungsi paksa perubahan paket untuk admin

### 4. Antarmuka Admin
- Halaman untuk melihat status validasi semua pelanggan postpaid
- Statistik ringkasan
- Fungsi untuk memaksa perubahan paket dalam kasus tertentu
- Fungsi untuk mengirim notifikasi pengingat

## Cara Kerja

### Alur Normal:
1. Pelanggan meminta perubahan paket
2. Sistem memeriksa apakah pelanggan postpaid
3. Sistem memeriksa apakah ada tagihan tertunggak
4. Jika tidak ada tagihan tertunggak, perubahan paket dilanjutkan
5. Jika ada tagihan tertunggak, proses diblokir dan notifikasi dikirim

### Alur dengan Tagihan Tertunggak:
1. Sistem mendeteksi tagihan tertunggak
2. Notifikasi WhatsApp otomatis dikirim ke pelanggan
3. Proses perubahan paket diblokir
4. Admin dapat melihat status di halaman admin
5. Setelah pembayaran diselesaikan, pelanggan dapat mengajukan ulang perubahan paket

### Fungsi Paksa untuk Admin:
- Admin dapat memaksa perubahan paket meskipun ada tagihan tertunggak
- Alasan harus dicantumkan untuk audit trail
- Log perubahan paket dicatat untuk pelacakan

## Endpoint API
- `GET /admin/package-change-validation` - Halaman admin validasi
- `POST /admin/package-change-validation/force` - Paksa perubahan paket
- `POST /admin/package-change-validation/remind/:customerId` - Kirim notifikasi pengingat
- `GET /api/pending-customers` - Data pelanggan dengan tagihan tertunggak

## Fitur Tambahan
- Dashboard admin dengan statistik
- Fungsi refresh dan pencarian
- Log perubahan paket untuk audit
- Integrasi dengan sistem notifikasi WhatsApp yang sudah ada

## Konfigurasi
Sistem ini terintegrasi dengan arsitektur aplikasi billing yang sudah ada dan menggunakan database MySQL yang sama. Tidak diperlukan konfigurasi tambahan untuk sistem berjalan.