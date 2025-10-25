# 🚀 Auto-Update System - Setup Guide

**Status:** ✅ COMPLETE  
**Version:** 1.0.0  
**Date:** 2025-10-25

---

## ✅ Apa yang Sudah Dibuat

### 1. **Database Tables** ✅
- `system_settings` - Menyimpan konfigurasi sistem (version, GitHub repo, auto-update settings)
- `update_history` - Tracking semua update yang dilakukan

### 2. **Services** ✅
- `GitHubService` - Integrasi dengan GitHub API untuk check updates & download releases
- `UpdateService` - Service untuk apply updates dengan aman (backup, rollback, dll)
- `aboutService` (updated) - Service untuk halaman About dengan integrasi update system

### 3. **Controllers & Routes** ✅
- Updated `aboutController` dengan fitur update lengkap
- Updated routes untuk handle update requests
- API endpoints untuk check updates, apply update, update settings

### 4. **UI/View** ✅
- Halaman About dengan UI modern dan lengkap
- Check update button dengan real-time feedback
- Update modal dengan changelog
- Update history table
- Update settings (auto-update, channel)

---

## 📋 Setup Instructions

### **Step 1: Run Database Migration**

Jalankan SQL migration untuk membuat tables:

```bash
# Via MySQL client
mysql -u root -p billing_database < migrations/create_system_settings.sql

# Atau via phpMyAdmin/adminer
# Copy-paste isi file migrations/create_system_settings.sql
```

**File migration:** `migrations/create_system_settings.sql`

### **Step 2: Compile TypeScript**

```bash
cd C:\laragon\www\billing
npm run build
```

Ini akan compile semua file TypeScript baru ke folder `dist/`.

### **Step 3: Restart Server**

```bash
# Via PM2
pm2 restart billing

# Atau via batch file
.\restart-server.bat

# Atau manual
npm start
```

### **Step 4: Test Update System**

1. Buka browser: `http://localhost:3000/about`
2. Klik tombol **"Cek Update"**
3. Sistem akan check GitHub untuk update terbaru
4. Jika ada update, akan muncul modal
5. Klik **"Update Sekarang"** untuk apply update

---

## 🎯 Cara Kerja Sistem

### **Workflow Auto-Update:**

```
1. User klik "Cek Update"
   ↓
2. Query GitHub API untuk latest release
   ↓
3. Compare version (current vs latest)
   ↓
4. Jika ada update baru:
   - Tampilkan modal dengan changelog
   - User confirm update
   ↓
5. Apply Update Process:
   a. Create backup (git stash)
   b. Fetch dari GitHub (git fetch)
   c. Checkout version baru (git checkout v1.x.x)
   d. Pull changes (git pull)
   e. Update dependencies (npm install)
   f. Rebuild TypeScript (npm run build)
   g. Restart PM2 (pm2 restart)
   ↓
6. Update selesai!
```

### **Rollback System:**

Jika update gagal, sistem otomatis rollback ke versi sebelumnya:

```
Update Failed
   ↓
Git checkout previous version
   ↓
Update database version
   ↓
Rollback complete
```

---

## ⚙️ Configuration

### **System Settings** (via database)

| Setting Key | Default Value | Description |
|-------------|---------------|-------------|
| `app_version` | `1.0.0` | Current app version |
| `github_repo_owner` | `adiprayitno160-svg` | GitHub username |
| `github_repo_name` | `billing_system` | Repository name |
| `auto_update_enabled` | `false` | Enable auto-update |
| `update_channel` | `stable` | Update channel (stable/beta/dev) |
| `update_check_interval` | `86400000` | Check interval (24 hours) |

### **Update Channels:**

- **Stable:** Hanya update yang sudah stabil dan tested
- **Beta:** Include pre-release/beta versions
- **Dev:** Include development versions (tidak recommended untuk production)

---

## 📡 API Endpoints

### **Check for Updates**
```
GET /about/check-updates
```

**Response:**
```json
{
  "available": true,
  "currentVersion": "1.0.0",
  "latestVersion": "1.1.0",
  "changelog": "Bug fixes and improvements",
  "publishedAt": "2025-10-25T10:00:00Z",
  "downloadUrl": "https://github.com/.../archive/v1.1.0.zip"
}
```

### **Apply Update**
```
POST /about/update
Body: { "version": "v1.1.0" }
```

**Response:** Redirect to /about with success/error message

### **Update Settings**
```
POST /about/update-settings
Body: { "autoUpdate": true, "updateChannel": "stable" }
```

**Response:** Redirect to /about with success message

### **Get Update History**
```
GET /about/update-history
```

**Response:**
```json
[
  {
    "id": 1,
    "version_from": "1.0.0",
    "version_to": "1.1.0",
    "status": "success",
    "started_at": "2025-10-25T10:00:00Z",
    "completed_at": "2025-10-25T10:02:00Z"
  }
]
```

---

## 🔧 Troubleshooting

### **Problem: "Git is not installed"**

**Solution:**
- Git sudah ada di Laragon: `C:\laragon\bin\git\bin\git.exe`
- Pastikan path sudah benar di `UpdateService.ts`
- Atau install Git for Windows

### **Problem: Update gagal dengan error "Permission denied"**

**Solution:**
- Pastikan file tidak sedang digunakan
- Stop server dulu sebelum update
- Check file permissions

### **Problem: "Failed to fetch from GitHub"**

**Solution:**
- Check koneksi internet
- Pastikan GitHub repository public atau ada access token
- Check GitHub API rate limit (60 requests/hour tanpa auth)

### **Problem: Database table tidak ada**

**Solution:**
- Run migration SQL: `migrations/create_system_settings.sql`
- Check connection database di `.env`

### **Problem: Update berhasil tapi aplikasi tidak restart**

**Solution:**
- Restart manual: `pm2 restart billing`
- Check PM2 status: `pm2 list`
- Check logs: `pm2 logs billing`

---

## 🔐 Security Notes

### **Protected Files (Tidak Ter-Update):**

File-file ini **TIDAK** akan ter-overwrite saat update:

- `.env` (config rahasia)
- `uploads/` (file user)
- `backups/` (backup database)
- `whatsapp-session/` (session WhatsApp)
- `node_modules/` (re-install dari package.json)

### **GitHub Access:**

- Public repository: Tidak perlu token
- Private repository: Butuh Personal Access Token (PAT)
- Token disimpan di `GITHUB_TOKEN` environment variable (optional)

---

## 📊 Testing Checklist

- [ ] Database tables created successfully
- [ ] Can access /about page
- [ ] "Cek Update" button works
- [ ] Shows correct current version
- [ ] Can check for updates from GitHub
- [ ] Update modal shows when update available
- [ ] Can change update settings
- [ ] Update history shows (if any updates done)
- [ ] Update process works (test with dummy version)

---

## 🎉 Features

### ✅ **Implemented:**

1. **Check Updates** - Query GitHub untuk latest release
2. **Show Changelog** - Display changelog dari GitHub release
3. **Apply Update** - Update via git pull dengan backup
4. **Rollback** - Auto rollback jika update gagal
5. **Update History** - Track semua update di database
6. **Update Settings** - Enable/disable auto-update, pilih channel
7. **Version Comparison** - Semantic version comparison
8. **UI/UX** - Modern UI dengan modal dan feedback
9. **Safety** - Protected files, backup before update
10. **Restart Management** - Auto restart via PM2

### 🔮 **Future Enhancements:**

1. Auto-update scheduler (check setiap X jam)
2. Email notification saat ada update
3. Telegram notification
4. Staged rollout (update bertahap)
5. Update via webhook (GitHub push event)
6. Database migration automation
7. Update verification (checksum/signature)
8. Multi-server update (jika ada multiple instances)

---

## 📝 Next Steps

### **Untuk Testing:**

1. **Create dummy release di GitHub:**
   ```bash
   git tag -a v1.0.1 -m "Test release v1.0.1"
   git push --tags
   ```

2. **Buat GitHub Release:**
   - Go to: https://github.com/adiprayitno160-svg/billing_system/releases/new
   - Choose tag: v1.0.1
   - Title: "Version 1.0.1 - Bug Fixes"
   - Description:
     ```
     ## Changes
     - Fixed print thermal issue
     - Improved performance
     - Updated dependencies
     ```
   - Publish release

3. **Test Update Process:**
   - Buka /about
   - Klik "Cek Update"
   - Harusnya detect v1.0.1 sebagai update baru
   - Klik "Update Sekarang"
   - Tunggu proses selesai

### **Untuk Production:**

1. Set proper GitHub repository (sudah done)
2. Enable auto-update (via settings)
3. Choose update channel (recommend: stable)
4. Setup monitoring untuk update failures
5. Schedule periodic update checks

---

## 📞 Support

Jika ada masalah atau pertanyaan:
1. Check logs: `pm2 logs billing`
2. Check update history di database
3. Check GitHub API rate limit
4. Review error messages di browser console

---

**Generated:** 2025-10-25  
**Author:** Billing System Auto-Update  
**Repository:** https://github.com/adiprayitno160-svg/billing_system

