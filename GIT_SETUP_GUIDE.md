# 🚀 Git Setup Guide - Billing System

**Status:** Step 1.2 & 1.3 ✅ COMPLETED  
**Next:** Git Init & Push to GitHub

---

## ✅ Apa yang Sudah Dikerjakan

### 1. `.gitignore` - Updated ✅
- ✅ Protected sensitive files (.env, database backups)
- ✅ Protected user data (uploads/, whatsapp-session/)
- ✅ Ignored build output (dist/, node_modules/)
- ✅ Ignored log files
- ✅ Ignored temporary files

**Location:** `C:\laragon\www\billing\.gitignore`

### 2. Cleanup Documentation ✅
- ✅ Created `CLEANUP_REPORT.md` - Detailed analysis
- ✅ Created `cleanup-before-git.bat` - Automated cleanup script
- ✅ Created `env.example.txt` - Environment template

**Files Created:**
- `CLEANUP_REPORT.md` - Laporan lengkap file yang bisa dibersihkan
- `cleanup-before-git.bat` - Script otomatis untuk cleanup
- `env.example.txt` - Template untuk .env file
- `GIT_SETUP_GUIDE.md` - Panduan ini

---

## 📋 Next Steps - Yang Harus Anda Lakukan

### Step 1: Buat GitHub Repository (Jika Belum)

1. Buka https://github.com/new
2. **Repository Name:** `billing-system` (atau terserah Anda)
3. **Visibility:** ⚠️ **PRIVATE** (PENTING!)
4. ❌ Jangan centang "Initialize with README"
5. Click "Create repository"
6. Copy URL repository (akan seperti: `https://github.com/username/billing-system.git`)

---

### Step 2: Run Cleanup Script

Buka PowerShell di folder project dan jalankan:

```powershell
cd C:\laragon\www\billing
.\cleanup-before-git.bat
```

Script ini akan:
- ✅ Backup log files
- ✅ Hapus folder `dist/` (compiled code)
- ✅ Hapus file log temporary
- ✅ Hapus file debug HTML
- ✅ Organize documentation ke folder `docs/`

**SAFE:** Script ini tidak akan menghapus:
- ❌ .env (protected)
- ❌ node_modules/ (protected)
- ❌ backups/ (protected)
- ❌ uploads/ (protected)
- ❌ whatsapp-session/ (protected)

---

### Step 3: Initialize Git

Jalankan command berikut di PowerShell:

```powershell
# Masuk ke folder project
cd C:\laragon\www\billing

# Init git
git init

# Set branch name ke main
git branch -M main

# Configure git (jika belum pernah)
git config --global user.name "Nama Anda"
git config --global user.email "email@anda.com"

# Verify git config
git config --list
```

---

### Step 4: Connect to GitHub

```powershell
# Add remote (ganti dengan URL repository Anda)
git remote add origin https://github.com/YOUR-USERNAME/billing-system.git

# Verify remote
git remote -v
```

---

### Step 5: First Commit

```powershell
# Check status (pastikan .env tidak muncul!)
git status

# Add all files
git add .

# Commit
git commit -m "Initial commit - Billing System v1.0.0"
```

---

### Step 6: Create Version Tag

```powershell
# Create tag for v1.0.0
git tag -a v1.0.0 -m "Release v1.0.0 - Initial stable version"

# List tags to verify
git tag
```

---

### Step 7: Push to GitHub

```powershell
# Push code
git push -u origin main

# Push tags
git push --tags
```

---

### Step 8: Verify on GitHub

1. Buka repository Anda di GitHub
2. **Cek yang HARUS ADA:**
   - ✅ `src/` folder
   - ✅ `views/` folder
   - ✅ `public/` folder
   - ✅ `package.json`
   - ✅ `.gitignore`
   - ✅ `README.md`

3. **Cek yang JANGAN ADA (Protected):**
   - ❌ `.env` file
   - ❌ `node_modules/` folder
   - ❌ `uploads/` folder
   - ❌ `backups/` folder
   - ❌ `whatsapp-session/` folder
   - ❌ `dist/` folder
   - ❌ `*.log` files

4. **Cek Tags:**
   - Go to "Tags" tab
   - Should see `v1.0.0`

---

### Step 9: Create GitHub Release (Optional)

1. Di GitHub repository, click tab **"Releases"**
2. Click **"Create a new release"**
3. **Choose a tag:** `v1.0.0`
4. **Release title:** `Version 1.0.0 - Initial Release`
5. **Description:**

```markdown
## 🎉 Initial Release

### Features
- ✅ Billing management system
- ✅ Customer management with ID generator
- ✅ Payment gateway integration (Midtrans, Tripay, Xendit)
- ✅ Print thermal & ODC invoice
- ✅ WhatsApp integration
- ✅ Telegram bot notifications
- ✅ Network monitoring (MikroTik)
- ✅ SLA management
- ✅ FTTH/Prepaid package management
- ✅ Kasir (POS) system
- ✅ Customer portal

### Installation
1. Clone repository
2. Copy `env.example.txt` to `.env` and configure
3. Install dependencies: `npm install`
4. Build TypeScript: `npm run build`
5. Setup database (import schema)
6. Start server: `npm start` or `pm2 start ecosystem.config.js`

### Requirements
- Node.js v18+
- MySQL/MariaDB
- MikroTik Router (optional)
- PM2 (for production)
```

6. Click **"Publish release"**

---

## ⚠️ Important Notes

### 1. .env File Protection
File `.env` berisi konfigurasi rahasia (password database, API keys, dll). File ini:
- ✅ Sudah di-protect di `.gitignore`
- ❌ **TIDAK BOLEH** di-commit ke Git
- ✅ Gunakan `env.example.txt` sebagai template

### 2. GitHub Repository Visibility
- ✅ **PRIVATE** - Recommended (kode aplikasi production)
- ⚠️ **PUBLIC** - Hanya jika mau open source (pastikan tidak ada data sensitif)

### 3. Git Workflow Kedepan

Setelah setup awal selesai, workflow Anda:

```bash
# Setiap ada perubahan
git add .
git commit -m "Deskripsi perubahan"
git push

# Setiap release baru
git tag -a v1.1.0 -m "Release v1.1.0"
git push --tags
```

---

## 🔍 Troubleshooting

### Problem: Git command not found
**Solution:** Install Git for Windows dari https://git-scm.com/download/win

### Problem: .env muncul di git status
**Solution:** 
```bash
# Remove from staging
git rm --cached .env

# Verify .gitignore contains .env
cat .gitignore | Select-String ".env"
```

### Problem: File size too large
**Solution:**
- Pastikan `node_modules/` tidak ter-add
- Pastikan `dist/` sudah dihapus
- Run `cleanup-before-git.bat` lagi

### Problem: Git push rejected
**Solution:**
```bash
# Check remote
git remote -v

# Re-add remote if wrong
git remote remove origin
git remote add origin YOUR_CORRECT_URL

# Force push (first time only)
git push -u origin main --force
```

---

## 📊 Repository Structure After Setup

```
billing-system/
├── .gitignore              ✅ Protected files config
├── README.md               ✅ Main documentation
├── package.json            ✅ Dependencies
├── tsconfig.json           ✅ TypeScript config
├── ecosystem.config.js     ✅ PM2 config
├── env.example.txt         ✅ Environment template
├── src/                    ✅ Source code (TypeScript)
│   ├── controllers/
│   ├── services/
│   ├── routes/
│   ├── middlewares/
│   └── server.ts
├── views/                  ✅ EJS templates
├── public/                 ✅ Static files
│   └── assets/
└── docs/                   ✅ Documentation
    ├── CLEANUP_REPORT.md
    ├── GIT_SETUP_GUIDE.md
    └── ...

NOT IN GIT (Protected):
├── .env                    ❌ Config rahasia
├── node_modules/           ❌ Dependencies (heavy)
├── dist/                   ❌ Compiled (rebuild)
├── uploads/                ❌ User files
├── backups/                ❌ Database backups
├── whatsapp-session/       ❌ WhatsApp session
├── test-session/           ❌ Test session
└── logs/                   ❌ Log files
```

---

## ✅ Checklist

Sebelum lanjut, pastikan:

- [ ] GitHub repository sudah dibuat (PRIVATE)
- [ ] `.gitignore` sudah updated
- [ ] Cleanup script sudah dijalankan
- [ ] Git init sudah dijalankan
- [ ] Remote origin sudah di-set
- [ ] First commit sudah dibuat
- [ ] Tag v1.0.0 sudah dibuat
- [ ] Push ke GitHub berhasil
- [ ] Verify di GitHub (file .env tidak ada)
- [ ] GitHub Release sudah dibuat (optional)

---

## 🚀 Siap untuk Step Selanjutnya!

Setelah semua checklist di atas selesai, Anda siap untuk:

1. ✅ Development auto-update system
2. ✅ Create update routes & controllers
3. ✅ Build update UI in About page
4. ✅ Test update workflow

---

**Need Help?**
- GitHub Docs: https://docs.github.com/en/get-started
- Git Basics: https://git-scm.com/book/en/v2/Getting-Started-About-Version-Control

**Generated:** 2025-10-25  
**Project:** Billing System Auto-Update Setup



