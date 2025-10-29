# 🚀 QUICK START: Setup Prepaid System (5 Menit!)

## ✅ **SUDAH FIXED! Sekarang Langsung Bisa Dipakai!**

Error sudah diperbaiki. System sekarang otomatis create table `system_settings` jika belum ada.

---

## 📋 CARA SETUP (SUPER MUDAH):

### **Step 1: Restart Server (Jika Sudah Running)**

Jika server billing sudah jalan, restart dulu:

```bash
pm2 restart billing-system
```

Atau jika pakai nodemon/npm:

```bash
# Stop dulu (Ctrl+C)
# Lalu start lagi
npm start
```

---

### **Step 2: Login & Akses Mikrotik Setup**

1. **Login** ke billing system (admin/superadmin)
2. **Klik menu sidebar:** **Prepaid** > **🚀 Mikrotik Setup**
3. Atau langsung buka: `http://192.168.239.126:3000/prepaid/mikrotik-setup`

---

### **Step 3: Set Portal URL**

Di halaman Mikrotik Setup:

1. **Lihat Portal URL** yang tertulis (default: `http://localhost:3000`)
2. **Klik icon edit** (✏️) di samping Portal URL
3. Akan redirect ke **System Settings**
4. **Ubah Portal URL** jadi: `http://192.168.239.126:3000`
5. **SAVE!**
6. **Kembali ke Mikrotik Setup**

---

### **Step 4: Setup Mikrotik (ONE CLICK!)**

1. **Klik tombol besar:** "Setup Mikrotik Sekarang!"
2. Popup konfirmasi: **Klik OK**
3. **Tunggu 10-30 detik**
4. **SELESAI!** ✅

Status akan berubah jadi:
```
✅ PPPoE Profiles
✅ NAT Rules  
✅ Filter Rules
```

---

## 🎯 YANG OTOMATIS DIBUAT:

### **1. PPPoE Profiles (5 profiles)**
```routeros
/ppp profile
prepaid-no-package  (128k/128k)
prepaid-10mbps      (10M/10M)
prepaid-20mbps      (20M/20M)
prepaid-50mbps      (50M/50M)
prepaid-100mbps     (100M/100M)
```

### **2. NAT Redirect Rules (ke 192.168.239.126:3000)**
```routeros
/ip firewall nat
HTTP  (port 80)  → 192.168.239.126:3000
HTTPS (port 443) → 192.168.239.126:3000
```

### **3. Firewall Filter Rules**
```routeros
/ip firewall filter
✅ Allow internet for prepaid-active
✅ Allow DNS for prepaid-no-package
✅ Allow access to 192.168.239.126
❌ Block internet for prepaid-no-package
```

---

## 🧪 TEST SYSTEM:

### **Test 1: Portal Splash Page**

Buka browser, akses:
```
http://192.168.239.126:3000/prepaid/portal/splash
```

**Harus muncul:** Halaman splash page portal prepaid ✅

---

### **Test 2: Test Redirect (Simulasi Customer)**

**Cara 1: Pakai Address List**

1. Di Mikrotik, manual add IP test:
```routeros
/ip firewall address-list
add list=prepaid-no-package address=192.168.1.100 comment="Test device"
```

2. Dari device dengan IP `192.168.1.100`, buka browser
3. Ketik: `google.com`
4. **Harus redirect** ke portal splash page ✅

---

**Cara 2: Pakai PPPoE Test Account**

1. Buat test PPPoE user:
```routeros
/ppp secret
add name=test-prepaid password=test123 service=pppoe profile=prepaid-no-package
```

2. Koneksikan ke PPPoE dengan `test-prepaid` / `test123`
3. Setelah connect, buka browser
4. Ketik website apapun
5. **Harus redirect** ke portal! ✅

---

### **Test 3: Migration Customer**

1. Buka menu: **Pelanggan** > **Data Pelanggan**
2. Pilih 1 customer (PPPoE atau Static IP)
3. Klik tombol **"Migrasi ke Prepaid"**
4. Sistem otomatis:
   - Ubah billing_mode jadi `prepaid`
   - Generate Portal ID & PIN
   - Setup Mikrotik (PPPoE profile atau address-list)
   - Kirim WhatsApp (jika aktif)
5. Customer sekarang prepaid! ✅

---

## 🔍 TROUBLESHOOTING:

### ❌ **Error: "Mikrotik belum dikonfigurasi"**

**Solusi:**
1. Buka **Settings** > **Mikrotik**
2. Set IP, username, password Mikrotik
3. Test connection
4. Save
5. Balik ke Mikrotik Setup

---

### ❌ **Error: "Connection timeout"**

**Solusi:**
- Pastikan Mikrotik API enabled: `/ip service print` (api harus running)
- Pastikan billing server bisa ping ke Mikrotik
- Cek firewall Mikrotik tidak block API port 8728

---

### ❌ **Redirect tidak jalan**

**Solusi:**
1. Cek NAT rules di Mikrotik:
```routeros
/ip firewall nat print where chain=dstnat
```
Harus ada 2 rules untuk prepaid

2. Cek IP ada di address-list:
```routeros
/ip firewall address-list print where list=prepaid-no-package
```

3. Cek billing server running:
```bash
pm2 status
netstat -tulpn | grep 3000
```

---

## 📊 MONITORING:

### **Dashboard Prepaid**

URL: `/prepaid/dashboard`

Monitor:
- Total prepaid customers
- Active subscriptions
- Revenue
- Recent transactions

---

### **Address List Management**

URL: `/prepaid/address-list`

Lihat real-time:
- IPs di `prepaid-no-package` (akan redirect)
- IPs di `prepaid-active` (internet full)
- Manual add/remove untuk troubleshooting

---

## ✅ CHECKLIST:

- [ ] Server billing running
- [ ] Login ke billing system berhasil
- [ ] Buka `/prepaid/mikrotik-setup` berhasil
- [ ] Portal URL sudah di-set: `http://192.168.239.126:3000`
- [ ] Mikrotik settings sudah dikonfigurasi
- [ ] Klik "Setup Mikrotik" berhasil
- [ ] Status menunjukkan ✅ semua
- [ ] Test splash page berhasil
- [ ] Test redirect berhasil
- [ ] Migration customer berhasil

---

## 🎉 SELESAI!

**Prepaid system dengan One-Click Mikrotik Setup sudah jalan!**

Customer prepaid sekarang otomatis di-redirect ke:
```
http://192.168.239.126:3000/prepaid/portal/splash
```

Mereka tinggal:
1. Login dengan Portal ID & PIN
2. Pilih paket
3. Bayar
4. Internet aktif otomatis! 🚀

---

## 📞 SUPPORT:

Jika ada masalah:
- Cek log server: `pm2 logs billing-system`
- Cek log Mikrotik: `/log print where topics~"firewall"`
- Baca dokumentasi: `docs/PREPAID_MIKROTIK_ONE_CLICK_SETUP.md`

**Selamat menggunakan! 🎊**

