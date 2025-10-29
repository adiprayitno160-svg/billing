# 🚀 Mikrotik One-Click Setup - Panduan

## ✨ Fitur Baru: Setup Mikrotik Tanpa Manual Config!

Sekarang admin **TIDAK PERLU** lagi manual config Mikrotik satu-satu!
Cukup **KLIK TOMBOL**, sistem otomatis setup semuanya! 🎉

---

## 📍 Cara Menggunakan:

### **Langkah 1: Set Portal URL**

1. Login ke Billing System
2. Buka **Settings** > **System Settings** (`/settings/system`)
3. Set **Portal URL** dengan IP server billing Anda
   - Contoh: `http://192.168.239.126:3000`
   - Atau: `http://192.168.1.10:3000`
   - Atau: `http://billing.domain.com`
4. **SAVE!**

---

### **Langkah 2: Setup Mikrotik (One-Click!)**

1. Buka menu **Prepaid** > **🚀 Mikrotik Setup** (`/prepaid/mikrotik-setup`)
2. **KLIK tombol besar:** "Setup Mikrotik Sekarang!"
3. Confirm (OK)
4. **Tunggu 10-30 detik**
5. **DONE!** ✅

---

## 🎯 Apa yang Di-Setup Otomatis?

### 1. **PPPoE Profiles** (5 profiles)
```
✅ prepaid-no-package  (128k/128k - untuk redirect)
✅ prepaid-10mbps      (10M/10M)
✅ prepaid-20mbps      (20M/20M)
✅ prepaid-50mbps      (50M/50M)
✅ prepaid-100mbps     (100M/100M)
```

### 2. **NAT Redirect Rules** (2 rules)
```
✅ HTTP (port 80)  → redirect ke Portal URL
✅ HTTPS (port 443) → redirect ke Portal URL
```

### 3. **Firewall Filter Rules** (4 rules)
```
✅ Allow internet untuk prepaid-active
✅ Allow DNS untuk prepaid-no-package
✅ Allow akses ke billing server
✅ Block internet untuk prepaid-no-package
```

---

## 🖥️ Screenshot Konsep UI:

```
┌──────────────────────────────────────────────────────┐
│  🚀 Mikrotik Setup Wizard                           │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Portal URL Configuration                            │
│  ┌────────────────────────────────────────────┐     │
│  │ http://192.168.239.126:3000              ✏️│     │
│  └────────────────────────────────────────────┘     │
│                                                      │
│  Mikrotik Connection                                 │
│  Host: 192.168.1.1                                   │
│  Port: 8728                                          │
│  [Test Connection]                                   │
│                                                      │
│  Status Setup:                                       │
│  ┌──────────┬──────────┬──────────┐                 │
│  │ Profiles │ NAT Rules│ Filters  │                 │
│  │    ✅    │    ✅    │    ✅    │                 │
│  └──────────┴──────────┴──────────┘                 │
│                                                      │
│  ┌────────────────────────────────────────────┐     │
│  │   🚀 Setup Mikrotik Sekarang!            │     │
│  └────────────────────────────────────────────┘     │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 🎬 Alur Kerja Admin:

### **Skenario: Admin Pertama Kali Setup**

1. **Admin login** ke billing system
2. **Klik menu:** Prepaid > 🚀 Mikrotik Setup
3. **Lihat status:** Belum ada setup (❌ semua merah)
4. **Klik tombol:** "Setup Mikrotik Sekarang!"
5. **Konfirmasi:** OK
6. **Sistem proses:** (10-30 detik)
   - ✅ Creating PPPoE Profiles...
   - ✅ Creating NAT Redirect Rules...
   - ✅ Creating Firewall Filter Rules...
7. **Selesai!** Status jadi ✅ semua hijau
8. **Prepaid system siap digunakan!** 🎉

---

### **Skenario: Re-Setup / Update Portal URL**

1. Admin ubah Portal URL di System Settings
2. Buka Mikrotik Setup wizard
3. Klik **"Re-Setup / Update Mikrotik"**
4. Sistem update semua rules dengan Portal URL baru
5. Done!

---

### **Skenario: Reset Setup**

1. Buka Mikrotik Setup wizard
2. Klik **"Reset Setup"**
3. Konfirmasi: OK
4. Sistem hapus semua NAT & Filter rules
5. PPPoE Profiles **TIDAK** dihapus (untuk safety)

---

## 🔧 Fitur UI:

### **Test Connection**
- Klik tombol "Test Connection"
- Sistem cek koneksi ke Mikrotik
- Tampilkan router identity jika berhasil

### **Status Check Real-Time**
- Otomatis cek status setup saat page load
- Tampilkan status PPPoE Profiles, NAT Rules, Filter Rules
- Indicator ✅ (sudah) atau ❌ (belum)

### **One-Click Setup**
- Tombol besar dan jelas
- Konfirmasi sebelum execute
- Progress feedback

### **Reset/Remove Rules**
- Untuk troubleshooting atau cleanup
- Hanya hapus NAT & Filter rules
- PPPoE Profiles tetap ada

---

## 🆚 Perbandingan: Manual vs One-Click

### **MANUAL (Cara Lama):**
❌ Copy script dari dokumentasi
❌ Edit IP & port manual
❌ Paste satu-satu ke Mikrotik Terminal
❌ Pastikan tidak ada typo
❌ Cek manual apakah berhasil
❌ Ulangi untuk setiap admin/router
⏱️ **Waktu: 15-30 menit per router**

### **ONE-CLICK (Cara Baru):**
✅ Buka UI Mikrotik Setup
✅ Klik 1 tombol
✅ Sistem otomatis handle semuanya
✅ Auto-detect IP & port dari Portal URL
✅ Auto-verify rules created
✅ Bisa di-reuse untuk semua admin
⏱️ **Waktu: 30 detik per router**

---

## 💡 Tips & Best Practices:

### **1. Portal URL Harus Benar**
```
❌ JANGAN: http://localhost:3000
✅ GUNAKAN: http://192.168.239.126:3000
✅ ATAU: http://billing.domain.com
```

### **2. Test Connection Dulu**
Sebelum setup, klik "Test Connection" untuk pastikan koneksi ke Mikrotik OK.

### **3. Backup Mikrotik**
Backup config Mikrotik sebelum setup (opsional, untuk safety):
```routeros
/export file=backup-before-prepaid-setup
```

### **4. Multi-Admin/Multi-Router**
Jika punya banyak admin atau banyak router:
- Setup **Portal URL sekali** di System Settings
- Setiap admin tinggal **klik tombol** di Mikrotik Setup
- **Tidak perlu** manual config lagi!

### **5. Update Portal URL**
Jika ganti IP server:
- Update Portal URL di System Settings
- Buka Mikrotik Setup
- Klik "Re-Setup / Update"
- Rules otomatis update dengan IP baru

---

## 🐛 Troubleshooting:

### **❌ Setup gagal: "Connection timeout"**
**Penyebab:** Billing system tidak bisa connect ke Mikrotik
**Solusi:**
- Cek Mikrotik API enable: `/ip service print` (pastikan api running)
- Cek firewall Mikrotik tidak block API port
- Cek username/password Mikrotik di Settings

---

### **❌ Setup berhasil tapi redirect tidak jalan**
**Penyebab:** Portal URL salah atau billing server tidak running
**Solusi:**
- Pastikan billing server running: `pm2 status`
- Cek Portal URL bisa diakses: `curl http://192.168.239.126:3000/prepaid/portal/splash`
- Re-setup dengan Portal URL yang benar

---

### **❌ "Rules already exist" error**
**Penyebab:** Rules sudah ada di Mikrotik (dari setup manual sebelumnya)
**Solusi:**
- Klik tombol "Reset Setup" dulu
- Lalu klik "Setup Mikrotik" lagi

---

## 📋 Checklist Setelah Setup:

- [ ] Status di UI menunjukkan ✅ semua
- [ ] PPPoE Profiles ada 5 (cek: `/ppp profile print`)
- [ ] NAT Rules ada 2 (cek: `/ip firewall nat print`)
- [ ] Filter Rules ada 4 (cek: `/ip firewall filter print`)
- [ ] Test redirect dari customer device (buka google.com harus redirect)
- [ ] Test login portal dengan Portal ID & PIN
- [ ] Test purchase package dan aktivasi

---

## 🎉 Keuntungan untuk Admin:

✅ **Hemat Waktu** - dari 30 menit jadi 30 detik
✅ **No Typo** - sistem auto-generate, no human error
✅ **Konsisten** - semua router setup sama persis
✅ **Easy Update** - ganti Portal URL? 1 klik update!
✅ **Scalable** - bisa untuk banyak router dengan mudah
✅ **User Friendly** - admin non-technical juga bisa!

---

## 🚀 Ready to Use!

Sistem One-Click Mikrotik Setup sudah siap digunakan!

**Menu:** Prepaid > 🚀 Mikrotik Setup
**URL:** `/prepaid/mikrotik-setup`

**Selamat! Setup Mikrotik sekarang jadi super mudah! 🎊**

