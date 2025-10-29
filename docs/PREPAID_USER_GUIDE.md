# 📱 Panduan Penggunaan Prepaid Portal System

## 🎯 Ringkasan Sistem

Sistem Prepaid Portal yang terintegrasi memungkinkan pelanggan **membeli paket internet sendiri** tanpa harus menghubungi admin. Customer yang belum memiliki paket aktif akan **dipaksa redirect** ke portal untuk membeli paket.

---

## 🚀 Cara Menggunakan

### **1. Migrasi Customer dari Postpaid ke Prepaid**

**Dari Dashboard:**
1. Buka **Dashboard** → Lihat card "Prepaid System"
2. Klik **"Lihat Customer"** → Filter prepaid
3. Atau langsung ke **Pelanggan** → **Data Pelanggan**

**Proses Migrasi:**
1. Pilih customer yang ingin dimigrasi
2. Klik tombol **"Migrate to Prepaid"** (akan ada di halaman detail/edit customer)
3. System otomatis:
   - Generate **Portal ID** (8 digit)
   - Generate **Portal PIN** (6 digit)
   - Update billing mode ke prepaid
   - **PPPoE**: Update profile → `prepaid-no-package`
   - **Static IP**: Add IP → address-list `prepaid-no-package`
   - Kirim WhatsApp dengan Portal ID & PIN

**Informasi yang Dikirim ke Customer:**
```
Halo [Nama Customer],

Akun Anda telah dimigrasi ke sistem Prepaid.

Portal ID: 12345678
PIN: 123456

Silakan login di:
http://your-domain.com/prepaid/portal/login

Untuk membeli paket internet.

Terima kasih.
```

---

### **2. Customer Mengakses Internet**

**Skenario 1: Customer PPPoE**
```
1. Customer connect PPPoE (username/password tetap sama)
2. ✅ PPPoE Connected
3. Profile: prepaid-no-package (speed 128k)
4. Customer buka browser → REDIRECT PAKSA ke portal
5. Lihat splash page dengan instruksi
```

**Skenario 2: Customer Static IP**
```
1. Customer connect internet
2. IP ada di address-list "prepaid-no-package"
3. Customer buka browser → REDIRECT PAKSA ke portal
4. Lihat splash page dengan instruksi
```

---

### **3. Customer Login & Beli Paket**

**Step by Step:**

1. **Login Portal**
   - URL: `http://your-domain.com/prepaid/portal/login`
   - Masukkan Portal ID (8 digit)
   - Masukkan PIN (6 digit)
   - Klik **"Masuk ke Portal"**

2. **Pilih Paket**
   - Lihat daftar paket yang tersedia
   - Pilih paket sesuai kebutuhan
   - Klik **"Beli Paket"**

3. **Payment**
   - Pilih metode pembayaran
   - Lakukan pembayaran
   - Tunggu konfirmasi

4. **Aktivasi Otomatis**
   - System aktivasi paket
   - **PPPoE**: Profile berubah → `prepaid-20mbps` + disconnect
   - **Static IP**: IP pindah ke `prepaid-active`
   - Customer reconnect
   - **Internet AKTIF!** 🎉

---

### **4. Monitoring dari Admin**

**Dashboard Utama:**
- Lihat **KPI Card "Prepaid"** - Total customer prepaid
- Lihat **KPI Card "Active"** - Total subscription aktif
- Card **"Prepaid System"** dengan statistik lengkap:
  - Total Prepaid
  - Active Subscriptions
  - Need Package
  - Active Rate (%)

**Dashboard Prepaid:**
- Klik **"Dashboard Prepaid"** dari menu atau card
- Lihat:
  - Customer prepaid
  - Active subscriptions
  - Expired/depleted packages
  - Revenue statistics

**Menu Prepaid System:**
1. **Dashboard Prepaid** - Overview
2. **Customer Prepaid** - Daftar customer
3. **Paket Prepaid** - Kelola paket & harga
4. **Speed Profiles** - Kelola speed profile
5. **Portal Redirect** - Monitor address-list
6. **Active Subscriptions** - Subscription aktif
7. **Laporan Prepaid** - Report & analytics

---

### **5. Auto Monitoring & Expiry**

**Scheduler Berjalan Otomatis:**
- Check every **5 minutes**
- Detect expired subscriptions
- Auto deactivate & revert configuration

**Saat Paket Expired:**
```
Scheduler detect paket expired
    ↓
System Process:
  • Update subscription status: expired
  • PPPoE: Revert profile → prepaid-no-package + disconnect
  • Static: Move IP → prepaid-no-package
  • Send expiry notification via WhatsApp
    ↓
Customer ter-redirect LAGI ke portal
Customer harus beli paket baru
```

---

## 🛠️ Manajemen Paket Prepaid

### **Buat Paket Baru**

1. **Prepaid System** → **Paket Prepaid**
2. Klik **"Create Package"**
3. Isi form:
   - **Nama Paket**: 20GB - 20Mbps
   - **Tipe**: Monthly/Weekly/Daily
   - **Quota**: 20480 MB (20GB)
   - **Speed**: Download 20Mbps, Upload 20Mbps
   - **Harga**: Rp 75.000
   - **Mikrotik Profile**: `prepaid-20mbps`
4. **Save**

### **Edit/Delete Paket**

- Edit: Klik tombol Edit di daftar paket
- Delete: Klik tombol Delete (hanya jika tidak ada subscription aktif)

---

## 📊 Laporan & Statistik

### **Melihat Laporan**

**Prepaid System** → **Laporan Prepaid**

Laporan yang tersedia:
- **Revenue Report** - Pendapatan per periode
- **Top Packages** - Paket paling laris
- **Customer Activity** - Aktivitas customer
- **Expiry Report** - Paket yang akan/sudah expired

---

## 🔧 Troubleshooting

### **Customer Tidak Ter-redirect**

**Checklist:**
1. ✅ Customer sudah di-migrasi ke prepaid?
2. ✅ PPPoE: Profile sudah `prepaid-no-package`?
3. ✅ Static IP: IP sudah ada di address-list?
4. ✅ Mikrotik firewall rules sudah setup?
5. ✅ NAT redirect rules aktif?

**Cek Manual:**
```routeros
# Di Mikrotik
/ppp active print detail
/ip firewall address-list print where list~"prepaid"
/ip firewall nat print where comment~"prepaid"
```

### **Paket Tidak Aktif Setelah Bayar**

**Checklist:**
1. ✅ Payment sudah confirmed?
2. ✅ Subscription created di database?
3. ✅ Mikrotik connected?
4. ✅ Profile/IP sudah di-update?

**Cek Logs:**
```bash
# Di server billing
pm2 logs billing-system --lines 100 | grep -i "prepaid\|activation"
```

### **Customer Tidak Reconnect**

**Solusi:**
- **PPPoE**: Customer disconnect & connect manual
- **Static IP**: Tunggu beberapa saat atau restart router customer

---

## 📱 URL Penting

| URL | Keterangan |
|-----|------------|
| `/prepaid/dashboard` | Dashboard admin prepaid |
| `/prepaid/customers` | Daftar customer prepaid |
| `/prepaid/packages` | Kelola paket prepaid |
| `/prepaid/subscriptions` | Active subscriptions |
| `/prepaid/portal/splash` | Landing page redirect (test) |
| `/prepaid/portal/login` | Login portal customer |
| `/prepaid/portal/packages` | Halaman pilih paket (customer) |

---

## ⚙️ Konfigurasi

### **Setup Mikrotik**

Lihat dokumentasi lengkap: `docs/PREPAID_MIKROTIK_SETUP.md`

**Quick Setup:**
1. Buat PPPoE profiles (prepaid-no-package, prepaid-*mbps)
2. Setup NAT redirect rules
3. Setup Filter rules
4. Test dengan 1 customer

### **Integrasi WhatsApp**

Notifikasi otomatis untuk:
- Portal ID & PIN saat migrasi
- Paket akan expired (1 hari sebelum)
- Paket sudah expired
- Aktivasi paket berhasil

Setup: **Pengaturan** → **WhatsApp**

---

## 🎓 Tips & Best Practices

### **Tips untuk Admin**

1. **Test dulu dengan 1 customer** sebelum migrasi massal
2. **Pastikan Mikrotik sudah setup** sebelum migrasi
3. **Monitor scheduler logs** untuk detect masalah early
4. **Backup database** sebelum migrasi massal
5. **Edukasi customer** tentang cara pakai portal

### **Tips untuk Customer Service**

1. **Simpan template pesan** untuk WhatsApp (Portal ID/PIN)
2. **Buat FAQ** tentang cara beli paket
3. **Siapkan nomor CS** untuk customer yang kesulitan
4. **Monitor customer yang sering expired** → tawarkan paket lebih besar

### **Rekomendasi Harga Paket**

Contoh strategi pricing:
- **10GB - 10Mbps**: Rp 50.000 (entry level)
- **20GB - 20Mbps**: Rp 75.000 (most popular) ⭐
- **50GB - 50Mbps**: Rp 150.000 (power user)
- **Unlimited - 100Mbps**: Rp 300.000 (premium)

---

## 📞 Support

Jika ada masalah:
1. Check logs server: `pm2 logs billing-system`
2. Check Mikrotik logs: `/log print where message~"prepaid"`
3. Check database: Tabel `prepaid_package_subscriptions`
4. Hubungi developer jika ada bug

---

**🎉 Selamat! Sistem Prepaid Portal sudah siap digunakan!**

Dokumentasi Mikrotik: `docs/PREPAID_MIKROTIK_SETUP.md`

