# 🔧 Fix Update Issue - tsc not found

## ❌ Masalah
```bash
sh: 1: tsc: not found
```

**Penyebab:** `tsc` (TypeScript Compiler) tidak terinstall karena perintah `npm install --production` tidak menginstall devDependencies.

## ✅ Solusi

### Opsi 1: Install dengan devDependencies (Recommended untuk build)

```bash
cd /opt/billing

# Install semua dependencies (termasuk devDependencies untuk build)
npm install

# Build aplikasi
npm run build

# Install hanya production dependencies untuk run
npm install --production

# Restart PM2
pm2 restart billing-app --update-env
```

### Opsi 2: Install TypeScript globally (Jarang digunakan)

```bash
npm install -g typescript

# Kemudian build
npm run build
```

### Opsi 3: Install secara lokal dan build

```bash
cd /opt/billing

# Install devDependencies untuk build
npm install typescript ts-node

# Build
npm run build

# Uninstall devDependencies (optional, untuk hemat space)
npm install --production

# Restart
pm2 restart billing-app --update-env
```

---

## 📋 Perintah Lengkap (Copy-Paste)

```bash
cd /opt/billing && \
git pull origin main && \
npm install && \
npm run build && \
npm install --production && \
pm2 restart billing-app --update-env && \
pm2 logs billing-app --lines 30
```

---

## 📝 Penjelasan

### Kenapa `--production` menyebabkan masalah?

- `npm install --production` → install **hanya** dependencies yang dibutuhkan untuk **run** aplikasi
- TypeScript (`tsc`) adalah **devDependency** → hanya dibutuhkan untuk **build**
- Build butuh devDependencies, tapi run tidak perlu

### Solusi

Install **tanpa** `--production` untuk build, kemudian install `--production` lagi untuk run.

---

## ✅ Setelah Update

Cek versi:
```bash
cat VERSION
```

Buka browser:
```
http://your-server:3000/about
```

Harus menunjukkan: **Versi Saat Ini: 2.1.8**

