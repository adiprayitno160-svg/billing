# ⚡ QUICK START - Deploy ke Server aaPanel

**Total Time:** ~15 menit  
**Level:** Mudah - Medium

---

## 🎯 LANGKAH CEPAT (3 Metode)

### 📦 **METODE 1: Auto Setup Script (TERMUDAH)** ⭐

```bash
# 1. Login SSH sebagai root
ssh root@your-server-ip

# 2. Masuk ke Docker container aaPanel (jika menggunakan Docker)
docker exec -it aapanel /bin/bash

# 3. Download & run setup script
cd /tmp
wget https://raw.githubusercontent.com/YOUR_USERNAME/billing/main/server-setup.sh
chmod +x server-setup.sh
bash server-setup.sh

# 4. Ikuti prompt interaktif
# Script akan otomatis:
#   ✅ Clone repository
#   ✅ Setup .env
#   ✅ Buat database
#   ✅ Install dependencies
#   ✅ Build aplikasi
#   ✅ Start dengan PM2
```

**DONE!** Aplikasi berjalan di port 3000.

---

### 🔧 **METODE 2: Manual (Step-by-Step)**

```bash
# 1. Masuk container (jika Docker)
docker exec -it aapanel /bin/bash

# 2. Install Git
apt-get update && apt-get install git -y

# 3. Clone repository
cd /www/wwwroot
git clone https://github.com/YOUR_USERNAME/billing.git
cd billing

# 4. Setup .env
nano .env
# Copy-paste konfigurasi (lihat DEPLOYMENT_AAPANEL.md)

# 5. Buat database
mysql -u root -p
CREATE DATABASE billing_system;
EXIT;

# 6. Build & Start
npm install
npm run build
npm install -g pm2
pm2 start dist/server.js --name billing
pm2 save
pm2 startup
```

**DONE!** Lanjut setup Nginx di aaPanel.

---

### 🖥️ **METODE 3: Via aaPanel Web UI**

**Untuk yang lebih suka GUI:**

1. **Upload code via FTP** ke `/www/wwwroot/billing/`
2. **Buka aaPanel** → Website → Node Project
3. **Add Node Project:**
   - Path: `/www/wwwroot/billing`
   - Run: `dist/server.js`
   - Port: `3000`
4. **Setup .env** via File Manager
5. **Buat database** via Database menu
6. **Terminal aaPanel:**
   ```bash
   cd /www/wwwroot/billing
   npm install
   npm run build
   ```
7. **Start** dari Node Project menu

**DONE!** Aplikasi managed via aaPanel UI.

---

## 🌐 SETUP NGINX REVERSE PROXY (Wajib!)

**Via aaPanel Web UI:**

1. **Website** → **Add Site**
   - Domain: `billing.yourdomain.com`
   - PHP: **Static**
   
2. **Settings** → **Reverse Proxy**
   - Target: `http://127.0.0.1:3000`
   - Enable: **ON**

3. **(Optional) SSL** → Let's Encrypt → Apply

**Akses:** https://billing.yourdomain.com

---

## ✅ CHECKLIST FINAL

- [ ] Aplikasi running (cek: `pm2 status`)
- [ ] Port 3000 listening (cek: `curl localhost:3000`)
- [ ] Database connected (lihat PM2 logs)
- [ ] Nginx reverse proxy configured
- [ ] Domain pointing ke server
- [ ] SSL certificate installed (optional)
- [ ] Login berhasil (admin/admin)
- [ ] **Ganti password default!**

---

## 🔥 ONE-LINER DEPLOYMENT

**Copy-paste satu baris ini di SSH (sebagai root):**

```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/billing/main/server-setup.sh | bash
```

Ikuti prompt interaktif, **DONE dalam 5 menit!** ⚡

---

## 📞 TROUBLESHOOTING CEPAT

```bash
# Cek status
pm2 status

# Lihat logs
pm2 logs billing

# Restart
pm2 restart billing

# Cek port
netstat -tlnp | grep 3000

# Update dari GitHub
cd /www/wwwroot/billing
git pull
npm install
npm run build
pm2 restart billing
```

---

## 🎓 DOKUMENTASI LENGKAP

Lihat: **[DEPLOYMENT_AAPANEL.md](./DEPLOYMENT_AAPANEL.md)**

---

**⏱️ Estimated Time:**
- Metode 1 (Auto): 5-10 menit
- Metode 2 (Manual): 15-20 menit
- Metode 3 (aaPanel UI): 20-30 menit

**💡 Rekomendasi:** Gunakan **Metode 1** untuk deployment tercepat!

---

*Happy Deploying! 🚀*


