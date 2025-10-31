# Fix Error: tsc not found di Production Server

## Masalah
```
sh: 1: tsc: not found
```

TypeScript tidak terinstall di production server karena biasanya `npm install --production` tidak menginstall devDependencies.

## Solusi

### Opsi 1: Install devDependencies (Recommended)
```bash
# Di server production, install semua dependencies termasuk devDependencies
cd /opt/billing
npm install

# Kemudian build dan deploy
npm run build
npm run pm2:reload
```

### Opsi 2: Install TypeScript secara global
```bash
npm install -g typescript

# Kemudian build dan deploy
npm run build
npm run pm2:reload
```

### Opsi 3: Gunakan npx (tanpa install global)
Edit `package.json` script build untuk menggunakan npx:
```json
"build": "npx tsc"
```

## Langkah Lengkap Deploy Setelah Fix

```bash
# 1. Masuk ke direktori aplikasi
cd /opt/billing

# 2. Pull perubahan terbaru
git pull origin main

# 3. Install dependencies (termasuk devDependencies untuk build)
npm install

# 4. Build aplikasi
npm run build

# 5. Build CSS (jika perlu)
npm run css:build

# 6. Reload PM2
npm run pm2:reload

# 7. Cek status
npm run pm2:status
```

## Alternatif: Update package.json Script

Jika ingin build tanpa install devDependencies di production, bisa menggunakan npx:

```json
{
  "scripts": {
    "build": "npx tsc",
    "css:build": "npx tailwindcss -i ./src/styles/tailwind.css -o ./public/assets/styles.css --minify"
  }
}
```

Dengan cara ini, npx akan download dan menjalankan tsc tanpa perlu install global.

