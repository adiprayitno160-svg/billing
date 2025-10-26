# ⚡ QUICK DEPLOY KE AAPANEL

## 🎯 Cara Tercepat (1 Command!)

### Login SSH ke server, lalu jalankan:

```bash
curl -fsSL https://raw.githubusercontent.com/YOUR-USERNAME/billing/main/aapanel-deploy.sh | bash
```

> **Ganti `YOUR-USERNAME` dengan username GitHub Anda!**

---

## 📋 Atau Step-by-Step (Lebih Aman)

### 1️⃣ Login ke Server
```bash
ssh root@IP_SERVER_ANDA
```

### 2️⃣ Download Script
```bash
cd ~
wget https://raw.githubusercontent.com/YOUR-USERNAME/billing/main/aapanel-deploy.sh
chmod +x aapanel-deploy.sh
```

### 3️⃣ Jalankan
```bash
bash aapanel-deploy.sh
```

Script akan otomatis menanyakan URL GitHub repository Anda.

---

## 🚀 Atau dengan Environment Variable

```bash
export GITHUB_REPO="https://github.com/your-username/billing.git"
bash aapanel-deploy.sh
```

---

## ✅ Setelah Selesai

Akses aplikasi di browser:
```
http://IP-SERVER:3000
```

**Login:**
- Username: `admin`
- Password: `admin123`

⚠️ **GANTI PASSWORD SETELAH LOGIN!**

---

## 📝 Credentials

File credentials tersimpan di:
```
/www/wwwroot/billing/CREDENTIALS.txt
```

Backup file ini ke tempat aman!

---

## 🔧 Command Berguna

```bash
# Lihat status
pm2 status

# Lihat logs
pm2 logs billing-system

# Restart
pm2 restart billing-system

# Update dari GitHub
cd /www/wwwroot/billing
git pull
npm run build
pm2 restart billing-system
```

---

## ❓ Troubleshooting

### Tidak bisa clone dari GitHub?

**Untuk repository PRIVATE:**

```bash
# Generate SSH key
ssh-keygen -t rsa -b 4096 -C "deploy" -f ~/.ssh/id_rsa -N ""

# Tampilkan public key
cat ~/.ssh/id_rsa.pub

# Copy dan tambahkan ke:
# https://github.com/settings/keys
```

Lalu jalankan dengan SSH URL:
```bash
export GITHUB_REPO="git@github.com:your-username/billing.git"
bash aapanel-deploy.sh
```

### Port 3000 sudah dipakai?

```bash
export APP_PORT=3001
bash aapanel-deploy.sh
```

### Error SSL_ERROR_RX_RECORD_TOO_LONG?

Gunakan **HTTP** bukan HTTPS:
```
http://IP-SERVER:3000  ✅
https://IP-SERVER:3000 ❌
```

Untuk HTTPS, setup Nginx reverse proxy + SSL certificate.

---

## 📚 Dokumentasi Lengkap

Lihat: [INSTALL_AAPANEL.md](INSTALL_AAPANEL.md)

---

**Selesai! Aplikasi online dalam 5 menit! ⚡**


