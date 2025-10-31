# Changelog v2.1.7 (2025-10-30)

## Fixes
- Import Excel: mendukung header nomor telepon yang lebih variatif:
  - "Nomor Telepon", "No. Telepon", "No Telepon", "No Telp", "Telp", "Tlp", "HP", dsb.
  - Mencegah kasus Berhasil 0 / Gagal N ketika file memakai kolom "Nomor Telepon".
- Logging import diperjelas sehingga baris dan kolom yang terbaca terlihat jelas.

## Notes
- Tidak ada perubahan schema database.
- Disarankan menjalankan normalisasi nomor telepon lama (hapus spasi/tanda) sebelum melakukan import massal untuk mengurangi duplikasi.

## Deployment
```
git pull
npm install
npm run build
pm2 restart billing-app
```




