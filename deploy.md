# Cara Deploy Perubahan Setelah Commit & Push

## Di Server Production (Linux/Ubuntu via SSH)

```bash
# 1. Masuk ke direktori aplikasi
cd /path/to/billing

# 2. Pull perubahan terbaru dari GitHub
git pull origin main

# 3. Install dependencies jika ada perubahan package.json
npm install

# 4. Build aplikasi (compile TypeScript ke JavaScript)
npm run build

# 5. Build CSS jika ada perubahan
npm run css:build

# 6. Reload aplikasi dengan PM2 (zero downtime)
npm run pm2:reload

# ATAU jika menggunakan script deploy langsung:
npm run deploy
```

## Di Local Development (Windows/Laragon)

### Opsi 1: Development Mode (Auto-reload)
```bash
# Jika sedang development, cukup restart dengan:
npm run dev
```

### Opsi 2: Production Mode dengan PM2
```bash
# 1. Pull perubahan (jika perlu)
git pull origin main

# 2. Build aplikasi
npm run build

# 3. Build CSS
npm run css:build

# 4. Reload PM2
npm run pm2:reload
```

## Script Deploy Otomatis (Satu Perintah)

Sudah tersedia script `deploy` di package.json:
```bash
npm run deploy
```

Script ini akan:
1. Build TypeScript ke JavaScript (`npm run build`)
2. Reload aplikasi PM2 tanpa downtime (`pm2 reload billing-app`)

## Langkah-langkah Detail

### 1. Pull Perubahan
```bash
git pull origin main
```

### 2. Install Dependencies (Jika package.json berubah)
```bash
npm install
```

### 3. Build Aplikasi
```bash
# Build TypeScript
npm run build

# Build CSS (jika ada perubahan Tailwind)
npm run css:build
```

### 4. Restart Aplikasi

**Menggunakan PM2:**
```bash
# Reload (zero downtime - recommended)
npm run pm2:reload

# ATAU Restart (full restart)
npm run pm2:restart

# Cek status
npm run pm2:status

# Lihat logs
npm run pm2:logs
```

**Tanpa PM2 (Development):**
```bash
# Stop server yang sedang jalan (Ctrl+C)
# Lalu start lagi
npm run dev
```

## Troubleshooting

### Jika build error:
```bash
# Bersihkan build sebelumnya
rm -rf dist/
npm run build
```

### Jika PM2 error:
```bash
# Stop dulu
npm run pm2:stop

# Start lagi
npm run pm2:start
```

### Cek logs untuk error:
```bash
npm run pm2:logs
# atau
tail -f logs/combined.log
```

## Checklist Deploy

- [ ] Git pull berhasil
- [ ] Dependencies terinstall (jika ada perubahan)
- [ ] Build berhasil tanpa error
- [ ] CSS build berhasil (jika ada perubahan)
- [ ] PM2 reload/restart berhasil
- [ ] Aplikasi berjalan (cek status)
- [ ] Test aplikasi di browser

