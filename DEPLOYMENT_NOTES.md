# Catatan Deployment & Troubleshooting Billing System

## 1. Masalah Tampilan Tidak Berubah (Cache/Stale Process)
Jika Anda sudah melakukan `git pull` dan `pm2 restart` tetapi tampilan di browser (terutama file `.ejs`) tidak berubah:

### 🌟 Solusi Utama: Reboot Server
Terkadang PM2 atau Node.js process bisa "nyangkut" (zombie process) atau file system caching di server Linux menahan file lama. Solusi paling ampuh adalah restart server fisik.
```bash
sudo reboot
```

### 🔧 Langkah Debugging Lainnya
1. **Gunakan Script Deployment Otomatis**
   Selalu gunakan script `./deploy.sh` yang sudah disiapkan di root folder. Script ini melakukan:
   - `git reset --hard` (Memastikan kode bersih)
   - `npm install`
   - `npm run build` (PENTING untuk TypeScript changes)
   - `pm2 reload/restart`

2. **Cek File Secara Manual**
   Verifikasi apakah file di server benar-benar berubah dengan perintah `grep` atau `cat`.
   ```bash
   grep "Text Yang Baru" views/file/target.ejs
   ```
   Jika grep menemukan teks baru tapi browser tidak, berarti masalahnya 100% di proses yang berjalan (perlu restart/reboot).

3. **Build TypeScript Error**
   Jika `npm run build` error karena masalah type definition (`*.d.ts`), perbaiki dulu typenya. Jangan mem-bypass build jika perubahan ada di file `.ts`.

## 2. Struktur Project
- **Views**: `/var/www/billing/views` (Server membaca langsung dari sini, bukan dari `dist`).
- **Logic**: `/var/www/billing/dist` (Hasil compile dari `src`).
- **Static Assets**: `/var/www/billing/public`.

## 3. Perintah Deployment Cepat
```bash
cd /var/www/billing
git pull origin main
./deploy.sh
```
