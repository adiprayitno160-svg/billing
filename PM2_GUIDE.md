# 🔄 Panduan PM2 Auto Restart - Billing System

## 📋 Daftar Isi
1. [Fitur Auto Restart](#fitur-auto-restart)
2. [Cara Restart Manual](#cara-restart-manual)
3. [Script Helper](#script-helper)
4. [Monitoring](#monitoring)
5. [Troubleshooting](#troubleshooting)

---

## ✨ Fitur Auto Restart

Aplikasi billing sudah dikonfigurasi dengan **auto restart otomatis** menggunakan PM2. Fitur yang aktif:

### 🔧 Konfigurasi Auto Restart
```javascript
autorestart: true              // Restart otomatis jika crash
max_memory_restart: '1G'       // Restart jika memory > 1GB
min_uptime: '10s'             // Minimum uptime sebelum dianggap stabil
max_restarts: 10              // Maksimal 10 restart dalam periode tertentu
restart_delay: 4000           // Delay 4 detik sebelum restart
exp_backoff_restart_delay: 100 // Exponential backoff untuk restart
```

### 📊 Kapan Auto Restart Terjadi?
1. **Aplikasi crash/error** → Restart otomatis dalam 4 detik
2. **Memory > 1GB** → Restart otomatis untuk prevent memory leak
3. **Process hang** → PM2 akan detect dan restart
4. **Server reboot** → Otomatis start saat server nyala (jika di-setup)

---

## 🔄 Cara Restart Manual

### Opsi 1: Menggunakan Script Helper (MUDAH)
Double-click file berikut di Windows Explorer:

#### **pm2-restart.bat**
- Restart aplikasi billing
- Tampilkan status setelah restart

#### **pm2-status.bat**
- Cek status PM2
- Lihat logs terbaru

### Opsi 2: Terminal Laragon
1. Buka **Laragon**
2. Klik **Menu** → **Terminal** (atau tekan Ctrl+Alt+T)
3. Jalankan salah satu command:

```bash
# Restart aplikasi billing saja
pm2 restart billing-app

# Restart semua aplikasi PM2
pm2 restart all

# Reload (zero-downtime restart)
pm2 reload billing-app

# Stop dan Start ulang
pm2 stop billing-app
pm2 start billing-app
```

### Opsi 3: NPM Script
Di terminal Laragon:
```bash
npm run pm2:start
```

### Opsi 4: PowerShell
```powershell
.\pm2-restart.ps1
```

---

## 📁 Script Helper Yang Tersedia

### 1. **pm2-restart.bat**
Restart cepat aplikasi billing:
```batch
@echo off
echo Restarting PM2 Application...
pm2 restart billing-app
pm2 list
pause
```

### 2. **pm2-status.bat**
Cek status dan logs:
```batch
@echo off
pm2 list
pm2 logs billing-app --lines 20
pause
```

### 3. **pm2-restart.ps1**
PowerShell script dengan error handling:
```powershell
pm2 restart billing-app
pm2 list
```

---

## 📊 Monitoring PM2

### Command Monitoring Berguna

```bash
# Lihat semua process
pm2 list

# Monitor real-time (CPU, Memory)
pm2 monit

# Lihat logs real-time
pm2 logs billing-app

# Lihat logs dengan limit baris
pm2 logs billing-app --lines 100

# Lihat error logs saja
pm2 logs billing-app --err

# Clear logs
pm2 flush

# Informasi detail aplikasi
pm2 describe billing-app

# Lihat startup script
pm2 startup
```

### Dashboard Web PM2
Untuk monitoring yang lebih canggih, install PM2 Plus:
```bash
pm2 install pm2-server-monit
```

---

## 🚀 Setup Auto Start Saat Boot

Agar aplikasi otomatis running saat server restart:

```bash
# Generate startup script
pm2 startup

# Jalankan command yang muncul (copy-paste)
# Contoh output: sudo env PATH=...

# Save current process list
pm2 save
```

**Windows Service (Alternatif):**
```bash
npm install -g pm2-windows-service
pm2-service-install
pm2 save
```

---

## 🔍 Troubleshooting

### Problem: PM2 tidak terdeteksi di PowerShell
**Solusi:**
1. Gunakan **Laragon Terminal** bukan PowerShell biasa
2. Atau install PM2 global:
   ```bash
   npm install -g pm2
   ```
3. Restart terminal setelah install

### Problem: Aplikasi terus restart berulang-ulang
**Penyebab:** Ada error di aplikasi yang bikin crash

**Solusi:**
```bash
# Cek logs untuk error
pm2 logs billing-app --err

# Stop aplikasi dulu
pm2 stop billing-app

# Fix error di code
# Build ulang
npm run build

# Start lagi
pm2 start billing-app
```

### Problem: Memory leak, restart terus karena > 1GB
**Solusi:**
1. Cek code untuk memory leak
2. Atau naikkan limit:
   ```javascript
   max_memory_restart: '2G'  // di ecosystem.config.js
   ```
3. Restart PM2:
   ```bash
   pm2 delete billing-app
   pm2 start ecosystem.config.js --env production
   ```

### Problem: Aplikasi tidak auto restart setelah crash
**Check:**
```bash
# Pastikan autorestart = true
pm2 describe billing-app | grep autorestart

# Restart PM2 daemon
pm2 kill
pm2 start ecosystem.config.js --env production
```

### Problem: Logs terlalu besar
**Solusi:**
```bash
# Install log rotate
pm2 install pm2-logrotate

# Configure
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## 📱 Quick Reference Commands

| Command | Fungsi |
|---------|--------|
| `pm2 restart billing-app` | Restart aplikasi |
| `pm2 reload billing-app` | Zero-downtime restart |
| `pm2 stop billing-app` | Stop aplikasi |
| `pm2 start billing-app` | Start aplikasi |
| `pm2 delete billing-app` | Delete dari PM2 |
| `pm2 list` | List semua process |
| `pm2 logs` | Lihat logs real-time |
| `pm2 monit` | Monitor CPU/Memory |
| `pm2 flush` | Clear semua logs |
| `pm2 save` | Save process list |
| `pm2 resurrect` | Restore saved processes |
| `pm2 reset billing-app` | Reset restart counter |

---

## 🎯 Best Practices

1. **Selalu build sebelum restart production:**
   ```bash
   npm run build
   pm2 restart billing-app
   ```

2. **Gunakan reload untuk zero-downtime:**
   ```bash
   pm2 reload billing-app
   ```

3. **Monitor logs setelah restart:**
   ```bash
   pm2 logs billing-app --lines 50
   ```

4. **Save state setelah konfigurasi:**
   ```bash
   pm2 save
   ```

5. **Backup logs penting sebelum flush:**
   ```bash
   cp logs/combined.log logs/backup-$(date +%Y%m%d).log
   pm2 flush
   ```

---

## 🆘 Support

Jika masih ada masalah:
1. Check logs: `pm2 logs billing-app`
2. Check status: `pm2 describe billing-app`
3. Restart PM2 daemon: `pm2 kill` lalu `pm2 start ecosystem.config.js`

---

**Dibuat:** 2025-10-30  
**Untuk:** Billing System v2.0.9


