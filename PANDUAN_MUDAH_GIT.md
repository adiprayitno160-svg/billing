# 🎯 PANDUAN SUPER MUDAH - Setup Git di Cursor

**JANGAN PANIK!** Ikuti langkah ini satu per satu. 

---

## 📌 **RINGKASAN: Apa yang Mau Kita Lakukan?**

Kita mau:
1. Upload kode billing Anda ke GitHub (supaya aman & bisa auto-update)
2. Pakai Cursor (editor yang Anda pakai sekarang) untuk upload-nya
3. TIDAK perlu command line yang ribet!

---

## 🚀 **LANGKAH 1: Buat Tempat di GitHub**

### Apa itu GitHub?
Seperti Google Drive tapi khusus untuk kode program.

### Cara Bikin:

1. **Buka browser** (Chrome/Edge/Firefox)
2. **Pergi ke:** https://github.com/signup (kalau belum punya akun)
   - Atau login di https://github.com (kalau sudah punya)
3. **Buat Repository Baru:**
   - Klik tombol **hijau "New"** atau **"+"** di kanan atas → **"New repository"**
4. **Isi form:**
   - **Repository name:** `billing-system` (atau nama lain yang Anda mau)
   - **Description:** `Sistem Billing Management` (opsional)
   - **Visibility:** Pilih **"Private"** ⚠️ PENTING! (supaya tidak dilihat orang lain)
   - **JANGAN centang** "Add a README file"
   - **JANGAN centang** "Add .gitignore"
   - **JANGAN centang** "Choose a license"
5. **Klik tombol "Create repository"**
6. **Copy URL yang muncul** (seperti: `https://github.com/username/billing-system.git`)
   - Simpan URL ini, nanti kita pakai!

✅ **SELESAI!** Tempat di GitHub sudah siap.

---

## 🧹 **LANGKAH 2: Bersihkan File Temporary (OPSIONAL)**

### Kenapa perlu dibersihkan?
Supaya file yang di-upload tidak terlalu banyak yang tidak penting.

### Cara Mudah:

**OPTION A: Pakai Script Otomatis (Recommended)**

1. Di Cursor, tekan tombol **`` Ctrl+` ``** (backtick, di bawah tombol ESC)
   - Ini akan buka Terminal di bawah
2. Ketik atau copy-paste command ini:
   ```
   .\cleanup-before-git.bat
   ```
3. Tekan **Enter**
4. Ikuti petunjuk di layar (ketik `Y` untuk yes)
5. Tunggu sampai selesai

**OPTION B: Skip (Lewati)**

Kalau bingung, lewati saja langkah ini. Tidak masalah.

✅ **SELESAI!** File temporary sudah dibersihkan (atau di-skip).

---

## 🎨 **LANGKAH 3: Upload ke GitHub (PAKAI CURSOR)**

### Inilah cara termudah! Tidak perlu command line sama sekali!

### Step 3.1: Buka Source Control di Cursor

1. **Lihat sidebar kiri di Cursor** (ada icon-icon vertical)
2. **Cari icon yang seperti cabang pohon atau huruf Y** (ini Source Control)
3. **Klik icon tersebut**
4. Akan muncul panel "Source Control" di sebelah kiri

### Step 3.2: Initialize Git

Di panel Source Control:

1. **Kalau muncul button "Initialize Repository":**
   - Klik button tersebut
   - Git sudah siap!

2. **Kalau tidak muncul button itu:**
   - Berarti Git sudah ter-init
   - Langsung ke step berikutnya

### Step 3.3: Review File (PENTING!)

Sekarang Anda akan lihat **daftar file** yang akan di-upload.

**CEK YANG PENTING:**

✅ Yang **HARUS ADA** di list:
- `src/` (folder)
- `views/` (folder)
- `public/` (folder)
- `package.json`
- `.gitignore`
- Dan file code lainnya

❌ Yang **JANGAN SAMPAI ADA**:
- `.env` ← **BAHAYA!** Ini berisi password database!
- `node_modules/` ← Terlalu besar
- `backups/` ← Data backup database
- `uploads/` ← File user
- `whatsapp-session/` ← Session WhatsApp

**KALAU `.env` MUNCUL = STOP! JANGAN LANJUT!**
(Kasih tahu saya, nanti saya bantu fix)

**KALAU `.env` TIDAK ADA = AMAN! LANJUT!**

### Step 3.4: Stage Files (Siapkan untuk Upload)

Di panel Source Control:

1. **Lihat bagian "Changes"** (daftar file yang berubah)
2. **Ada tombol "+" di sebelah kanan tulisan "Changes"**
3. **Klik tombol "+" tersebut** (ini artinya: siapkan semua file untuk upload)
4. File akan pindah ke bagian "Staged Changes"

Ini sama dengan perintah: `git add .` (kalau pakai command line)

### Step 3.5: Commit (Simpan ke Git)

Di panel Source Control:

1. **Lihat kotak text di paling atas** (ada tulisan "Message")
2. **Ketik pesan:**
   ```
   Initial commit - Billing System v1.0.0
   ```
3. **Klik tombol ✓ "Commit"** (di atas kotak message)
   - Atau tekan `Ctrl+Enter`

File sudah tersimpan di Git local!

### Step 3.6: Hubungkan ke GitHub

Sekarang kita sambungkan ke GitHub yang tadi dibuat.

Di panel Source Control:

1. **Klik tombol "..." (3 titik)** di pojok kanan atas panel
2. **Pilih: "Remote" → "Add Remote..."**
3. **Paste URL GitHub** yang tadi Anda copy (dari Langkah 1)
   - Contoh: `https://github.com/username/billing-system.git`
4. **Tekan Enter**
5. **Kalau diminta nama remote:** ketik `origin` (default)
6. **Tekan Enter**

### Step 3.7: Push (Upload ke GitHub)

Sekarang upload file ke GitHub!

Di panel Source Control:

1. **Klik tombol "..." (3 titik)** lagi
2. **Pilih: "Push"** atau **"Push to..."**
3. **Kalau diminta pilih branch:** pilih `main` atau `master`
4. **Tunggu proses upload** (mungkin 10-60 detik tergantung koneksi)
5. **Kalau diminta login GitHub:**
   - Login dengan akun GitHub Anda
   - Atau gunakan token (nanti saya bantu kalau ada masalah)

✅ **SELESAI!** Kode Anda sudah di GitHub!

### Step 3.8: Verifikasi (Cek Berhasil atau Tidak)

1. **Buka browser**
2. **Pergi ke URL GitHub repository Anda**
   - Contoh: `https://github.com/username/billing-system`
3. **Refresh halaman**
4. **Cek:** Apakah file sudah muncul?
   - Kalau ada folder `src/`, `views/`, `public/` = **BERHASIL!** 🎉
   - Kalau masih kosong = ada masalah (kasih tahu saya)

---

## 🏷️ **LANGKAH 4: Buat Tag Versi (OPSIONAL)**

Ini untuk marking versi 1.0.0.

Di panel Source Control:

1. **Klik tombol "..." (3 titik)**
2. **Pilih: "Tags" → "Create Tag..."**
3. **Ketik nama tag:** `v1.0.0`
4. **Tekan Enter**
5. **Kalau diminta message:** `Release v1.0.0 - Initial version`
6. **Tekan Enter**
7. **Klik "..." lagi → "Push" → "Push Tags"**

✅ Tag sudah dibuat!

---

## 🎉 **SELESAI!**

Sekarang kode billing Anda sudah aman di GitHub!

### **Apa yang Sudah Anda Lakukan:**

✅ Buat repository di GitHub  
✅ Initialize Git di Cursor  
✅ Upload kode ke GitHub  
✅ Create version tag v1.0.0  

### **Next Step (Nanti):**

Setelah ini selesai, kita bisa lanjut bikin fitur **auto-update** supaya:
- Cek update dari GitHub otomatis
- Download & install update dengan 1 klik
- Rollback kalau ada masalah

---

## ❓ **TROUBLESHOOTING (Kalau Ada Masalah)**

### 1. "Initialize Repository" tidak muncul
**Artinya:** Git sudah ter-init
**Solusi:** Langsung lanjut ke step berikutnya

### 2. File `.env` muncul di Changes list
**Artinya:** .gitignore belum bekerja
**Solusi:** STOP dulu, kasih tahu saya. Ini bahaya!

### 3. "Failed to push" atau error saat Push
**Kemungkinan:**
- URL GitHub salah → Cek lagi URL-nya
- Belum login → Login ke GitHub di browser, lalu coba lagi
- Koneksi internet → Cek koneksi

### 4. Diminta username/password GitHub
**Solusi:** 
- Username: username GitHub Anda
- Password: BUKAN password biasa, tapi Personal Access Token
- Cara bikin token: https://github.com/settings/tokens → "Generate new token" → copy token-nya

### 5. Masih bingung/stuck
**Solusi:** Kasih tahu saya di step mana yang bingung, nanti saya bantu step-by-step!

---

## 📞 **BUTUH BANTUAN?**

Kalau stuck di step manapun, kasih tahu saya:
- Step berapa yang bingung?
- Error message apa yang muncul?
- Screenshot kalau perlu

Saya akan bantu sampai selesai! 😊

---

**Dibuat:** 2025-10-25  
**Untuk:** Setup Git & GitHub - Billing System

