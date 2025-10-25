# 🧹 Cleanup Report - File Temporary yang Bisa Dibersihkan

**Generated:** 2025-10-25  
**Purpose:** Persiapan untuk Git Push Pertama

---

## ✅ File yang AMAN untuk Dihapus

### 1️⃣ **Folder `dist/` - Compiled Output**
**Path:** `C:\laragon\www\billing\dist\`  
**Size:** ~1-5 MB (estimasi)  
**Reason:** Folder ini berisi hasil compile TypeScript yang bisa di-generate ulang dengan `npm run build`

```powershell
# Command untuk hapus:
Remove-Item -Path "dist" -Recurse -Force
```

---

### 2️⃣ **Folder `logs/` - Log Files**
**Path:** `C:\laragon\www\billing\logs\`  
**Files:**
- `combined-0.log`
- `err-0.log`
- `out-0.log`

**Reason:** Log files akan di-generate ulang otomatis. Anda bisa backup dulu kalau masih perlu.

```powershell
# Backup logs (optional):
Compress-Archive -Path "logs" -DestinationPath "logs-backup-$(Get-Date -Format 'yyyyMMdd').zip"

# Hapus log files:
Remove-Item -Path "logs\*.log" -Force
```

---

### 3️⃣ **File Debug/Test HTML**
**Files Found:**
- `fix-sla-database.html`
- `fix-telegram-settings-table.html`
- `PRINT_THERMAL_QUICK_GUIDE.html`
- `public/test-buttons-debug.html`
- `public/test-cache.html`
- `TEST_PRINT_KASIR.html`

**Reason:** File debugging temporary yang tidak perlu di-commit ke Git

```powershell
# Hapus file-file test/debug HTML:
Remove-Item -Path "fix-*.html" -Force
Remove-Item -Path "test-*.html" -Force
Remove-Item -Path "public\test-*.html" -Force
Remove-Item -Path "*-debug.html" -Force
Remove-Item -Path "PRINT_THERMAL_QUICK_GUIDE.html" -Force
```

---

### 4️⃣ **File Debug JavaScript**
**Files Found:**
- `check-kasir-user.js`
- `fix-kasir-password.js`
- `test-kasir-login.js`

**Reason:** Script debugging yang kemungkinan temporary

```powershell
# Review dulu sebelum hapus! Kalau masih diperlukan, jangan hapus
# Hapus hanya kalau sudah tidak diperlukan:
# Remove-Item -Path "check-kasir-user.js" -Force
# Remove-Item -Path "fix-kasir-password.js" -Force
# Remove-Item -Path "test-kasir-login.js" -Force
```

---

### 5️⃣ **File Debug Lainnya**
**Files Found:**
- `onclick_debug.png`

**Reason:** Screenshot debugging

```powershell
Remove-Item -Path "onclick_debug.png" -Force
```

---

### 6️⃣ **File Markdown Documentation (OPTIONAL)**
**Files Found:** 30+ file .md seperti:
- `BACKUP_RESTORE_GUIDE.md`
- `FIX_PRINT_SIDEBAR_ISSUE.md`
- `KASIR_FIXES_COMPLETE.md`
- `THERMAL_PRINT_CONSISTENCY_FIX.md`
- dll...

**Decision:** 
- ✅ **KEEP** `README.md` (dokumentasi utama)
- 🤔 **OPTIONAL** untuk file MD lainnya (bisa di-commit atau tidak)
- Kalau mau simpan sebagai dokumentasi progress → **KEEP**
- Kalau mau repo lebih bersih → **HAPUS atau pindahkan ke folder docs/**

```powershell
# Kalau mau pindah ke folder docs:
New-Item -ItemType Directory -Path "docs" -Force
Move-Item -Path "BACKUP_*.md" -Destination "docs\"
Move-Item -Path "FIX_*.md" -Destination "docs\"
Move-Item -Path "KASIR_*.md" -Destination "docs\"
Move-Item -Path "PAYMENT_*.md" -Destination "docs\"
Move-Item -Path "PRINT_*.md" -Destination "docs\"
Move-Item -Path "THERMAL_*.md" -Destination "docs\"
```

---

## ⚠️ Folder yang JANGAN DIHAPUS (Sudah Protected oleh .gitignore)

### ❌ **JANGAN SENTUH:**

1. **`node_modules/`** - Dependencies (heavy, tidak perlu di-commit)
2. **`backups/`** - Backup database (data penting!)
3. **`uploads/`** - File upload customer (data penting!)
4. **`whatsapp-session/`** - WhatsApp session (akan hilang koneksinya!)
5. **`test-session/`** - Test session data
6. **`.env`** - Configuration rahasia (NEVER commit!)

> ✅ Folder-folder ini sudah diproteksi di `.gitignore`, jadi tidak akan masuk ke Git

---

## 🚀 Quick Cleanup Script (All-in-One)

**File:** `cleanup-before-git.bat`

```batch
@echo off
echo ========================================
echo Cleanup Script - Before Git Push
echo ========================================
echo.

echo [1/6] Backing up logs...
powershell -Command "Compress-Archive -Path 'logs' -DestinationPath 'logs-backup-%date:~-4%%date:~-10,2%%date:~-7,2%.zip' -Force"

echo [2/6] Removing compiled output...
rmdir /s /q dist

echo [3/6] Removing log files...
del /q logs\*.log

echo [4/6] Removing debug HTML files...
del /q fix-*.html
del /q test-*.html
del /q public\test-*.html
del /q *-debug.html
del /q PRINT_THERMAL_QUICK_GUIDE.html

echo [5/6] Removing debug images...
del /q onclick_debug.png

echo [6/6] Creating docs folder for MD files...
if not exist docs mkdir docs
move BACKUP_*.md docs\ 2>nul
move FIX_*.md docs\ 2>nul
move KASIR_*.md docs\ 2>nul
move PAYMENT_*.md docs\ 2>nul
move PRINT_*.md docs\ 2>nul
move THERMAL_*.md docs\ 2>nul

echo.
echo ========================================
echo Cleanup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Review changes: git status
echo 2. Add files: git add .
echo 3. Commit: git commit -m "Initial commit"
echo 4. Push: git push -u origin main
echo.
pause
```

---

## 📊 Estimasi Size yang Bisa Dihemat

| Item | Estimated Size | Reason |
|------|----------------|--------|
| `dist/` folder | ~2-5 MB | Compiled code |
| `logs/` files | ~1-10 MB | Log accumulation |
| Debug HTML/JS | ~500 KB | Test files |
| MD documentation | ~200 KB | Optional |
| **TOTAL** | **~3-15 MB** | Depends on usage |

> **Note:** `node_modules/`, `whatsapp-session/`, dan `backups/` tidak dihitung karena sudah di-ignore oleh Git.

---

## ✅ Checklist Before Git Push

- [ ] Backup logs (jika diperlukan)
- [ ] Hapus folder `dist/`
- [ ] Hapus file log di `logs/`
- [ ] Hapus file debug HTML/JS
- [ ] Review file .md (keep atau pindah ke docs/)
- [ ] Cek `.env` tidak ada di git status
- [ ] Run `git status` untuk verify

---

## 🔍 Verify Before Push

Setelah cleanup, jalankan:

```powershell
cd C:\laragon\www\billing
git status
```

**Pastikan TIDAK ADA:**
- ❌ File `.env`
- ❌ Folder `node_modules/`
- ❌ Folder `backups/`
- ❌ Folder `uploads/`
- ❌ Folder `whatsapp-session/`
- ❌ Folder `test-session/`
- ❌ File `.log`

**Yang HARUS ADA:**
- ✅ Folder `src/`
- ✅ Folder `views/`
- ✅ Folder `public/`
- ✅ File `package.json`
- ✅ File `.gitignore`
- ✅ File `README.md`

---

**Generated by Billing System Auto-Update Preparation**



