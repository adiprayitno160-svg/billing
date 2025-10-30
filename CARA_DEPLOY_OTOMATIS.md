# 🚀 CARA DEPLOY OTOMATIS - SIMPLE IMPORT EXCEL

## 📋 Overview

Sekarang import Excel sudah disederhanakan jadi **3 kolom saja**:
- ✅ **Nama** (wajib)
- ✅ **Telepon** (wajib)
- ✅ **Alamat** (opsional)

Field lain (email, paket, status) bisa diisi manual setelah import.

---

## 🚀 DEPLOY OTOMATIS (PILIH SALAH SATU)

### **OPSI 1: Windows Batch File (Paling Simple)**

1. **Double-click file ini:**
   ```
   AUTO-DEPLOY-SIMPLE-IMPORT.bat
   ```

2. **Isi informasi server:**
   - Username (contoh: `root`)
   - Server IP (contoh: `103.127.132.64`)
   - Project path (default: `/opt/billing`)

3. **Enter** dan tunggu deployment selesai!

---

### **OPSI 2: PowerShell (Recommended)**

1. **Klik kanan pada file ini → Run with PowerShell:**
   ```
   deploy-simple-import.ps1
   ```

2. **Atau jalankan dari terminal:**
   ```powershell
   .\deploy-simple-import.ps1
   ```

3. **Dengan parameter (skip input):**
   ```powershell
   .\deploy-simple-import.ps1 -ServerUser "root" -ServerIP "103.127.132.64" -ProjectPath "/opt/billing"
   ```

---

### **OPSI 3: Manual SSH (Jika Script Gagal)**

```bash
ssh root@YOUR_SERVER_IP

cd /opt/billing

git pull origin main

npm install

npm run build

pm2 restart billing-app

pm2 logs billing-app --lines 20
```

---

## 📋 SETELAH DEPLOY SELESAI

### **1. Test Import Excel**

**Buat file Excel dengan format ini:**

| Nama | Telepon | Alamat |
|------|---------|--------|
| John Doe | 08123456789 | Jl. Merdeka No. 123 |
| Jane Smith | 08234567890 | Jl. Sudirman No. 456 |
| Ahmad Rizki | 08345678901 | Jl. Diponegoro No. 789 |

**Save as:** `test_import.xlsx`

---

### **2. Upload di Browser**

1. Buka: `http://YOUR_SERVER_IP/customers/list`
2. Klik: **"📥 Import Excel"**
3. Pilih file: `test_import.xlsx`
4. Klik: **"Import Data"**
5. Tunggu notifikasi sukses

---

### **3. Monitor Log (Untuk Debug)**

**Via SSH:**
```bash
ssh root@YOUR_SERVER_IP "pm2 logs billing-app --lines 0"
```

**Atau dari PowerShell:**
```powershell
ssh root@YOUR_SERVER_IP "pm2 logs billing-app --lines 20"
```

**Log yang muncul untuk setiap baris:**
```
📝 Processing row 2: {
  Nama: 'John Doe',
  Telepon: '08123456789',
  Alamat: 'Jl. Merdeka No. 123',
  All keys in Excel: 'Nama, Telepon, Alamat'
}
  ✅ Validation passed: Nama dan Telepon OK
  🔍 Checking phone: "08123456789"
  ✅ Phone OK - No duplicate found
  💾 Inserting customer (SIMPLE): {
    name: 'John Doe',
    phone: '08123456789',
    address: 'Jl. Merdeka No. 123'
  }
  ✅ SUCCESS: Row 2 imported!
```

---

## ⚠️ TROUBLESHOOTING

### **Error: "tsc: not found"**

**Solusi:**
```bash
ssh root@YOUR_SERVER_IP

cd /opt/billing

npm install

npm run build

pm2 restart billing-app
```

---

### **Error: "PM2 process not found"**

**Solusi:**
```bash
ssh root@YOUR_SERVER_IP

cd /opt/billing

pm2 start ecosystem.config.js --env production

pm2 save
```

---

### **Error: "Git pull failed"**

**Solusi:**
```bash
ssh root@YOUR_SERVER_IP

cd /opt/billing

git status

# Jika ada uncommitted changes:
git stash

git pull origin main

npm run build

pm2 restart billing-app
```

---

### **Import Gagal: "Kolom Nama kosong"**

**Artinya:** Header Excel salah atau ada baris kosong

**Solusi:**
1. Pastikan header PERSIS: `Nama | Telepon | Alamat`
2. Hapus baris kosong di Excel
3. Save as `.xlsx` (bukan `.csv`)

---

### **Import Gagal: "Telepon sudah ada"**

**Artinya:** Nomor telepon duplikat

**Solusi:**
1. Gunakan nomor telepon yang unik
2. Atau hapus customer lama:
   ```bash
   ssh root@YOUR_SERVER_IP
   mysql -u root -p billing
   DELETE FROM customers WHERE phone = '08123456789';
   ```

---

## 📂 FILE TEMPLATE EXCEL

Lihat file: `TEMPLATE_IMPORT_EXCEL_SIMPLE.txt`

Atau copy-paste ini ke Excel:

```
Nama	Telepon	Alamat
Agus Setiawan	081234567890	Jl. Mawar No. 10
Dewi Lestari	082345678901	Jl. Melati No. 20
Eko Prasetyo	083456789012	Jl. Anggrek No. 30
Fitri Handayani	084567890123	Jl. Kenanga No. 40
Gita Pratama	085678901234	Jl. Cempaka No. 50
```

Save as: `data_pelanggan.xlsx`

---

## 🎯 QUICK REFERENCE

| Aksi | Command |
|------|---------|
| **Auto Deploy (Windows)** | Double-click `AUTO-DEPLOY-SIMPLE-IMPORT.bat` |
| **Auto Deploy (PowerShell)** | `.\deploy-simple-import.ps1` |
| **Manual Deploy** | `ssh root@SERVER_IP` → `cd /opt/billing` → `git pull` → `npm run build` → `pm2 restart billing-app` |
| **Monitor Log** | `ssh root@SERVER_IP "pm2 logs billing-app --lines 0"` |
| **Check Status** | `ssh root@SERVER_IP "pm2 list"` |
| **View Customers** | `http://SERVER_IP/customers/list` |

---

## ✅ CHECKLIST DEPLOYMENT

- [ ] Jalankan auto-deploy script
- [ ] Tunggu "✅ DEPLOYMENT SUCCESS!"
- [ ] Buat file Excel test (3 kolom: Nama, Telepon, Alamat)
- [ ] Upload di `/customers/list`
- [ ] Monitor log PM2
- [ ] Verifikasi customer muncul di tabel
- [ ] Edit manual untuk isi email/paket/status

---

## 📞 BANTUAN

Jika masih gagal, kirim:
1. Screenshot notifikasi error di browser
2. Copy log PM2 (20 baris terakhir)
3. Screenshot Excel (3 baris pertama)

---

**🎉 Selamat Deploy!**

Versi: 2.0.8.5
Update: Simple Import Excel (3 Kolom)

