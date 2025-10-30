# 🚀 Quick Start - PM2 Auto Restart

## 📌 Restart Otomatis SUDAH AKTIF!

Aplikasi billing Anda sudah dikonfigurasi dengan **auto restart otomatis**. PM2 akan otomatis restart aplikasi jika:
- ✅ Aplikasi crash/error
- ✅ Memory usage > 1GB
- ✅ Process hang/tidak responding

## 🔄 Cara Restart Manual (MUDAH)

### Pilihan 1: Menu Interaktif (PALING MUDAH) ⭐
Double-click file ini di Windows Explorer:
```
📁 pm2-menu.bat
```
Menu lengkap dengan semua fitur PM2!

### Pilihan 2: Script Cepat
Double-click salah satu:
- `pm2-restart.bat` - Restart cepat
- `pm2-status.bat` - Cek status & logs

### Pilihan 3: Terminal Laragon
1. Buka Laragon → Menu → Terminal
2. Jalankan:
```bash
npm run pm2:restart
```

### Pilihan 4: Command Manual
Di Laragon Terminal:
```bash
pm2 restart billing-app
```

## 📊 Command Penting Lainnya

```bash
# Via NPM Scripts (di Laragon Terminal)
npm run pm2:status    # Status aplikasi
npm run pm2:logs      # Lihat logs
npm run pm2:reload    # Zero-downtime restart
npm run deploy        # Build + Reload

# Direct PM2 Commands
pm2 list              # List semua process
pm2 logs billing-app  # Lihat logs real-time
pm2 monit            # Monitor CPU/Memory
```

## 📖 Dokumentasi Lengkap

Baca file `PM2_GUIDE.md` untuk:
- ✨ Penjelasan detail fitur auto restart
- 🔧 Konfigurasi advanced
- 🐛 Troubleshooting
- 📱 Best practices

## ⚙️ Konfigurasi Auto Restart

File: `ecosystem.config.js`

```javascript
autorestart: true              // ✅ Auto restart jika crash
max_memory_restart: '1G'       // ✅ Restart jika RAM > 1GB
restart_delay: 4000           // ✅ Delay 4 detik sebelum restart
max_restarts: 10              // ✅ Max 10 restart
```

## 🆘 Troubleshooting Cepat

**PM2 tidak terdeteksi?**
- Gunakan **Laragon Terminal** bukan PowerShell biasa
- Atau double-click `pm2-menu.bat`

**Aplikasi terus restart?**
```bash
npm run pm2:logs    # Cek error
```

**Need help?**
Baca `PM2_GUIDE.md` untuk troubleshooting lengkap!

---

**Version:** 2.0.9  
**Last Updated:** 2025-10-30
