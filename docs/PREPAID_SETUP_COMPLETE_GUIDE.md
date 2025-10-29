# 🚀 Panduan Setup Lengkap Sistem Prepaid Portal

Panduan step-by-step untuk mengaktifkan sistem prepaid portal dengan forced redirect untuk customer prepaid/prabayar.

---

## 📋 Overview Sistem

Sistem ini memungkinkan customer prepaid untuk:
- **Otomatis di-redirect paksa** ke portal jika belum punya paket atau paket expired
- **Self-service** untuk beli paket internet melalui portal
- **PPPoE & Static IP** sama-sama supported
- **Otomatis aktivasi** setelah pembayaran berhasil
- **Scheduler monitoring** untuk auto-expire dan notifikasi

---

## ⚙️ Langkah 1: Setup Database

### 1.1 Run Migration SQL

Jalankan migration file untuk membuat tabel-tabel prepaid:

```bash
mysql -u root -p billing_db < migrations/add_system_settings_prepaid.sql
```

**Atau manual via phpMyAdmin/MySQL client:**
- Buka file `migrations/add_system_settings_prepaid.sql`
- Copy paste isi file dan execute

### 1.2 Verifikasi Tabel

Pastikan tabel-tabel ini sudah ada:

```sql
SHOW TABLES LIKE 'prepaid%';
SHOW TABLES LIKE 'system_settings';
```

**Expected tables:**
- `prepaid_packages`
- `prepaid_package_subscriptions`
- `prepaid_portal_sessions`
- `prepaid_transactions`
- `prepaid_usage_logs`
- `system_settings`

---

## 🌐 Langkah 2: Konfigurasi Portal URL

### 2.1 Login ke Billing System

1. Login sebagai **Admin** atau **Superadmin**
2. Navigasi ke **Settings** > **System Settings** (`/settings/system`)

### 2.2 Set Portal URL

**Contoh konfigurasi:**

| Skenario | Portal URL | Keterangan |
|----------|------------|------------|
| **Development (Local)** | `http://localhost:3000` | ❌ JANGAN gunakan untuk production |
| **LAN Network** | `http://192.168.1.10:3000` | ✅ Gunakan IP server di LAN |
| **Public dengan Domain** | `http://billing.domain.com` | ✅ Recommended (gunakan port 80) |
| **HTTPS dengan SSL** | `https://billing.domain.com` | ✅ Best practice |

**Contoh untuk LAN:**
- Cek IP server billing: `ifconfig` atau `ip addr`
- Misalkan IP server: `192.168.88.100`
- Billing jalan di port `3000`
- Maka set: `http://192.168.88.100:3000`

**Save settings!**

---

## 🔧 Langkah 3: Setup MikroTik RouterOS

### 3.1 Buat PPPoE Profiles (untuk PPPoE customers)

Buat 2 jenis profile:
1. **prepaid-no-package** - untuk redirect ke portal
2. **prepaid-{speed}** - untuk customer dengan paket aktif

```routeros
/ppp profile
# Profile untuk customer tanpa paket (akan di-redirect)
add name="prepaid-no-package" \
    local-address=10.10.10.1 \
    remote-address=pppoe-pool \
    rate-limit=128k/128k \
    address-list=prepaid-no-package \
    only-one=yes \
    comment="Prepaid customer without active package"

# Profile untuk customer dengan paket 10Mbps
add name="prepaid-10mbps" \
    local-address=10.10.10.1 \
    remote-address=pppoe-pool \
    rate-limit=10M/10M \
    address-list=prepaid-active \
    only-one=yes \
    comment="Prepaid customer with 10Mbps package"

# Profile untuk customer dengan paket 20Mbps
add name="prepaid-20mbps" \
    local-address=10.10.10.1 \
    remote-address=pppoe-pool \
    rate-limit=20M/20M \
    address-list=prepaid-active \
    only-one=yes \
    comment="Prepaid customer with 20Mbps package"

# Profile untuk customer dengan paket 50Mbps
add name="prepaid-50mbps" \
    local-address=10.10.10.1 \
    remote-address=pppoe-pool \
    rate-limit=50M/50M \
    address-list=prepaid-active \
    only-one=yes \
    comment="Prepaid customer with 50Mbps package"
```

### 3.2 Setup NAT Redirect Rules

**⚠️ GANTI IP dan PORT sesuai dengan Portal URL yang Anda set di Step 2.2!**

**Contoh untuk `http://192.168.88.100:3000`:**

```routeros
/ip firewall nat
# Redirect HTTP traffic
add chain=dstnat \
    src-address-list=prepaid-no-package \
    protocol=tcp \
    dst-port=80 \
    action=dst-nat \
    to-addresses=192.168.88.100 \
    to-ports=3000 \
    comment="Redirect HTTP to prepaid portal"

# Redirect HTTPS traffic
add chain=dstnat \
    src-address-list=prepaid-no-package \
    protocol=tcp \
    dst-port=443 \
    action=dst-nat \
    to-addresses=192.168.88.100 \
    to-ports=3000 \
    comment="Redirect HTTPS to prepaid portal"
```

**Contoh untuk domain dengan port 80 (`http://billing.domain.com`):**

```routeros
/ip firewall nat
add chain=dstnat \
    src-address-list=prepaid-no-package \
    protocol=tcp \
    dst-port=80 \
    action=dst-nat \
    to-addresses=<IP_SERVER_BILLING> \
    to-ports=80 \
    comment="Redirect to billing portal"

add chain=dstnat \
    src-address-list=prepaid-no-package \
    protocol=tcp \
    dst-port=443 \
    action=dst-nat \
    to-addresses=<IP_SERVER_BILLING> \
    to-ports=80 \
    comment="Redirect HTTPS to HTTP billing"
```

### 3.3 Setup Firewall Filter Rules

```routeros
/ip firewall filter

# 1. Allow full internet for active prepaid customers
add chain=forward \
    src-address-list=prepaid-active \
    action=accept \
    place-before=0 \
    comment="Allow internet for active prepaid customers"

# 2. Allow DNS for customers without package (needed for redirect)
add chain=forward \
    src-address-list=prepaid-no-package \
    protocol=udp \
    dst-port=53 \
    action=accept \
    comment="Allow DNS for prepaid without package"

# 3. Allow access to billing server for customers without package
add chain=forward \
    src-address-list=prepaid-no-package \
    dst-address=192.168.88.100 \
    action=accept \
    comment="Allow access to billing portal server"

# 4. Block all other internet for customers without package
add chain=forward \
    src-address-list=prepaid-no-package \
    action=drop \
    comment="Block internet for prepaid without package"
```

**⚠️ GANTI `192.168.88.100` dengan IP server billing Anda!**

---

## 📦 Langkah 4: Buat Paket Prepaid

### 4.1 Login ke Billing System

Navigasi ke **Prepaid** > **Paket Prepaid** (`/prepaid/packages`)

### 4.2 Tambah Paket

Contoh paket:

| Nama Paket | Speed | Durasi | Harga | Mikrotik Profile |
|------------|-------|--------|-------|------------------|
| Paket 10Mbps 7 Hari | 10 Mbps | 7 hari | Rp 50.000 | prepaid-10mbps |
| Paket 20Mbps 7 Hari | 20 Mbps | 7 hari | Rp 75.000 | prepaid-20mbps |
| Paket 20Mbps 30 Hari | 20 Mbps | 30 hari | Rp 250.000 | prepaid-20mbps |
| Paket 50Mbps 30 Hari | 50 Mbps | 30 hari | Rp 500.000 | prepaid-50mbps |

**Penting:**
- Kolom **Mikrotik Profile Name** harus sesuai dengan profile yang dibuat di Step 3.1
- Untuk Static IP, profile ini tidak digunakan (hanya menggunakan address-list)

---

## 👥 Langkah 5: Migrasi Customer ke Prepaid

### 5.1 Cara Migrasi

Ada 2 cara:

#### A. Via Customer List (Manual)

1. Navigasi ke **Pelanggan** > **Data Pelanggan** (`/customers/list`)
2. Klik tombol **Edit** atau **View Details** pada customer
3. Klik tombol **Migrasi ke Prepaid**
4. Sistem akan otomatis:
   - Ubah billing_mode ke `prepaid`
   - Generate Portal ID & PIN
   - Setup MikroTik (PPPoE profile atau address-list)
   - Kirim notifikasi WhatsApp (jika aktif)

#### B. Via Prepaid Dashboard (Bulk)

1. Navigasi ke **Prepaid** > **Dashboard** (`/prepaid/dashboard`)
2. Klik **Customers** tab
3. Pilih customer yang ingin di-migrasi
4. Klik **Create Portal Access**

### 5.2 Verifikasi Migrasi

**Untuk PPPoE Customer:**
- Cek di MikroTik: `/ppp secret print`
- Profile harus berubah jadi `prepaid-no-package`

**Untuk Static IP Customer:**
- Cek di MikroTik: `/ip firewall address-list print where list=prepaid-no-package`
- IP customer harus muncul di list

---

## 🧪 Langkah 6: Testing

### 6.1 Test dari Admin Side

1. Buka browser
2. Akses: `http://<PORTAL_URL>/prepaid/portal/splash`
   - Contoh: `http://192.168.88.100:3000/prepaid/portal/splash`
3. Harus muncul halaman splash page

### 6.2 Test dari Customer Side

**Setup:**
1. Pilih 1 customer yang sudah di-migrasi ke prepaid
2. Dapatkan Portal ID & PIN dari database atau dari WhatsApp notification

**Test PPPoE:**
1. Koneksikan ke PPPoE dengan username/password customer
2. Setelah connect, buka browser
3. Akses website apapun (misal: `google.com`)
4. **Harus otomatis redirect** ke portal splash page
5. Login dengan Portal ID & PIN
6. Pilih paket dan lakukan pembayaran (test)
7. Setelah aktivasi, coba buka `google.com` - **harus bisa akses internet**

**Test Static IP:**
1. Set IP static di device customer sesuai dengan IP di database
2. Buka browser
3. Akses website apapun
4. **Harus otomatis redirect** ke portal
5. Lakukan test seperti di atas

### 6.3 Troubleshooting Test

**Redirect tidak jalan:**
- Cek NAT rules di MikroTik: `/ip firewall nat print where chain=dstnat`
- Pastikan IP/Port ke billing server sudah benar
- Pastikan billing server running di port yang benar
- Cek address-list: `/ip firewall address-list print where list=prepaid-no-package`

**Login portal gagal:**
- Cek Portal ID & PIN di database: `SELECT portal_id, portal_pin FROM customers WHERE id=X`
- Cek session di database: `SELECT * FROM prepaid_portal_sessions`

**Setelah beli paket, internet tidak aktif:**
- Cek subscription: `SELECT * FROM prepaid_package_subscriptions WHERE customer_id=X`
- Cek address-list: `/ip firewall address-list print where list=prepaid-active`
- Cek PPPoE profile (untuk PPPoE): `/ppp secret print where name=<username>`

---

## 🔄 Langkah 7: Verifikasi Scheduler

### 7.1 Cek Scheduler Running

Scheduler otomatis berjalan saat server start. Cek log:

```bash
pm2 logs billing-system
```

Harus muncul log seperti:
```
[PrepaidScheduler] Running checks at 2025-01-28T10:00:00.000Z
```

### 7.2 Manual Trigger (untuk test)

1. Login ke Billing System
2. Navigasi ke **Prepaid** > **Dashboard** (`/prepaid/dashboard`)
3. Scroll ke bawah, cari tombol **"Trigger Scheduler Manually"**
4. Klik tombol tersebut
5. Scheduler akan langsung cek expired subscriptions

---

## 📊 Langkah 8: Monitoring

### 8.1 Dashboard Prepaid

- **URL:** `/prepaid/dashboard`
- **Fitur:**
  - Total prepaid customers
  - Active subscriptions
  - Revenue statistics
  - Recent transactions

### 8.2 Address List Management

- **URL:** `/prepaid/address-list`
- **Fitur:**
  - View `prepaid-no-package` list
  - View `prepaid-active` list
  - Manual add/remove IP (untuk troubleshooting)
  - Clear list

### 8.3 Subscriptions Management

- **URL:** `/prepaid/subscriptions`
- **Fitur:**
  - View all active subscriptions
  - Manual activate/deactivate
  - Expiry monitoring

---

## ✅ Checklist Setup Complete

- [ ] Database migration sukses
- [ ] System Settings Portal URL sudah di-set
- [ ] MikroTik PPPoE profiles sudah dibuat
- [ ] MikroTik NAT redirect rules sudah dibuat
- [ ] MikroTik Firewall filter rules sudah dibuat
- [ ] Paket prepaid sudah dibuat minimal 1 paket
- [ ] Customer sudah di-migrasi ke prepaid minimal 1 customer
- [ ] Test redirect dari customer side berhasil
- [ ] Test login portal berhasil
- [ ] Test pembelian paket berhasil
- [ ] Scheduler running dan terdeteksi di log
- [ ] Dashboard prepaid bisa diakses

---

## 📝 Notes

### Untuk Production

1. **Gunakan HTTPS** untuk keamanan
2. **Backup database** sebelum migrasi mass customer
3. **Setup monitoring** untuk track system performance
4. **Konfigurasi payment gateway** yang sesuai
5. **Test notifikasi** WhatsApp & Telegram

### Maintenance

- **Address List Management:** Gunakan UI di `/prepaid/address-list` untuk troubleshooting
- **Manual Activation:** Bisa dilakukan via `/prepaid/subscriptions`
- **Logs:** Monitor `pm2 logs` untuk track scheduler & errors

### Support

Jika ada masalah, cek:
1. **Log server:** `pm2 logs billing-system`
2. **Database:** Cek tabel `prepaid_*`
3. **MikroTik:** Cek address-list & NAT rules
4. **Documentation:** `docs/PREPAID_USER_GUIDE.md` & `docs/PREPAID_MIKROTIK_SETUP.md`

---

## 🎉 Selesai!

Sistem prepaid portal dengan forced redirect sudah aktif dan siap digunakan!

**Kontak customer yang sudah di-migrasi:**
- Berikan Portal ID & PIN mereka
- Instruksikan untuk akses internet seperti biasa
- Browser akan otomatis redirect ke portal saat belum punya paket
- Mereka bisa self-service beli paket kapan saja!

**Selamat! 🚀**

