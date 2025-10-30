# Changelog v2.1.8 (2025-10-30)

## Improvements
- Excel Import: Normalisasi header dinamis untuk mendeteksi kolom telepon meski ada variasi/karakter tersembunyi.
- Menghapus NBSP, titik, underscore; lowercase; penggabungan spasi.
- Dukungan varian: "Nomor Telepon", "No. Telepon", "No Telp", "Telp", "Tlp", "HP", dst.
- Pembersihan nomor telepon juga menghapus titik selain spasi dan dash.

## Deployment
```
git pull
npm install --no-audit --no-fund
npm run build
pm2 restart billing-app
```


