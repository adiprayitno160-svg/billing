# 🚀 Ubuntu Server Deployment - WhatsApp Bot Fix

## ⚡ QUICK START (Copy-Paste Commands)

SSH ke Ubuntu server dan jalankan command berikut **satu per satu**:

```bash
# 1. Navigate to application directory
cd /var/www/billing

# 2. Pull latest code from GitHub (v2.3.16)
git pull origin main

# 3. Make scripts executable
chmod +x scripts/*.sh

# 4. Install Chromium dependencies (PENTING!)
sudo ./scripts/fix-whatsapp-ubuntu.sh

# 5. Install Node.js dependencies
npm install

# 6. Build TypeScript
npm run build

# 7. Stop current PM2 process
pm2 stop billing-app

# 8. Start with production environment
pm2 start ecosystem.config.js --env production

# 9. Save PM2 configuration
pm2 save

# 10. Monitor logs untuk QR code
pm2 logs billing-app
```

---

## 📋 Expected Output

### ✅ **Step 4 Output** (Install Dependencies):
```
🔧 WhatsApp Bot Ubuntu Server Quick Fix
================================================
📦 Step 1/5: Installing Chromium dependencies...
✅ Chromium dependencies installed
🔤 Step 2/5: Installing fonts...
✅ Fonts installed
🌐 Step 3/5: Verifying Chromium installation...
✅ Chromium found: Chromium 120.x.x.x
📁 Step 4/5: Setting up WhatsApp auth directory...
✅ WhatsApp auth directory ready
🔧 Step 5/5: Configuring environment...
✅ Environment variable set
================================================
✅ WhatsApp Bot Quick Fix Completed!
```

### ✅ **Step 8 Output** (PM2 Start):
```
[PM2] Starting ecosystem.config.js in production mode
[PM2] Process billing-app launched
```

### ✅ **Step 10 Output** (PM2 Logs):
```
PM2        | App [billing-app] online
billing-app| 📱 Initializing WhatsApp Web service...
billing-app| 📱 QR Code generated
billing-app| ┌─────────────────────────┐
billing-app| │  ▄▄▄▄▄ ▄▄  ▄ ▄▄▄▄▄     │
billing-app| │  █   █  █▄█  █   █     │  <-- SCAN QR CODE
billing-app| │  ▀▀▀▀▀ ▀ ▀ ▀ ▀▀▀▀▀     │
billing-app| └─────────────────────────┘
```

**↑ Scan QR code dengan WhatsApp di HP Anda**

### ✅ **After QR Scan**:
```
billing-app| ✅ WhatsApp authenticated
billing-app| ✅ WhatsApp connection opened successfully!
```

---

## 🧪 Testing

Setelah QR code di-scan, test bot dari WhatsApp customer terdaftar:

**Kirim pesan:**
```
/menu
```

**Expected Response:**
```
🏠 MENU UTAMA
Hai [Nama Customer],

1️⃣ Tagihan - Lihat tagihan yang belum dibayar
2️⃣ Bantuan - Informasi bantuan
3️⃣ WiFi - Ubah nama WiFi & password
4️⃣ Reboot - Restart Perangkat (ONT)
...
```

---

## ⚠️ Troubleshooting

### Problem: "Failed to launch the browser process"

**Solution:**
```bash
# Run fix script again
sudo ./scripts/fix-whatsapp-ubuntu.sh

# Check Chromium
which chromium-browser
# Should output: /usr/bin/chromium-browser
```

### Problem: PM2 keeps restarting

**Check logs:**
```bash
pm2 logs billing-app --err --lines 100
```

**Common fixes:**
```bash
# 1. Clear old session
rm -rf .wwebjs_auth/session

# 2. Restart PM2
pm2 delete billing-app
pm2 start ecosystem.config.js --env production
```

### Problem: QR Code not showing

**Solution:**
```bash
# Check if WhatsApp service is initializing
pm2 logs billing-app | grep "WhatsApp"

# If no output, check application logs
pm2 logs billing-app --lines 200
```

---

## 🔍 Verify Success

**Check PM2 status:**
```bash
pm2 status
```

**Expected:**
```
┌────┬──────────────┬─────────┬─────────┬──────────┐
│ id │ name         │ mode    │ status  │ uptime   │
├────┼──────────────┼─────────┼─────────┼──────────┤
│ 0  │ billing-app  │ fork    │ online  │ 5m       │
└────┴──────────────┴─────────┴─────────┴──────────┘
```

**✅ Status harus "online" dengan uptime > 30 detik (tidak restart terus)**

---

## 📊 Success Criteria

- ✅ Application status: **online**
- ✅ PM2 uptime: **> 30 seconds** (stable, tidak crash loop)
- ✅ WhatsApp QR code: **generated** (kalau belum auth)
- ✅ WhatsApp status: **connected** (after QR scan)
- ✅ Bot responding to: **/menu** command
- ✅ Bot can process: **payment verification images**

---

## 📝 What Changed in v2.3.16?

1. **WhatsAppService.ts**
   - ✅ Fixed operator precedence bug
   - ✅ Added 60-second timeout for Chromium launch
   - ✅ Added 30+ stability flags for headless Ubuntu
   - ✅ Auto-detect system Chromium on Linux

2. **ecosystem.config.js**
   - ✅ Set PUPPETEER_EXECUTABLE_PATH for production
   - ✅ Increased min_uptime to 30s (prevent crash loop)
   - ✅ Added restart delay & exponential backoff

3. **Ubuntu Scripts**
   - ✅ `fix-whatsapp-ubuntu.sh` (one-command fix)
   - ✅ `install-chromium-deps-ubuntu.sh` (detailed install)

---

## 🎯 Version Info

- **Version:** 2.3.16
- **Commit:** 9204e00
- **Status:** ✅ Ready for production
- **Tested:** Windows localhost ✓ | Ubuntu server (pending deployment)

---

## 📞 Support

Jika ada masalah setelah deployment:

1. **Capture full logs:** `pm2 logs billing-app --lines 500 > whatsapp-error.log`
2. **Check system resources:** `free -h` dan `df -h`
3. **Verify Chromium:** `chromium-browser --version`

**Server Info:**
- IP: 192.168.239.154
- Port: 3001
- OS: Ubuntu 20.04
- Node: v20.19.6

---

**Last Updated:** 2025-12-28  
**Deployed By:** System Admin  
**Deploy Status:** 🟢 Ready to Deploy
