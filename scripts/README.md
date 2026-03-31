# Ubuntu Server Deployment Scripts

This directory contains scripts to help deploy and fix WhatsApp bot on Ubuntu server.

## Scripts

### 1. `fix-whatsapp-ubuntu.sh` ⚡ **QUICK FIX**

**Purpose:** One-command fix for WhatsApp bot crash loop on Ubuntu server.

**Usage:**
```bash
sudo chmod +x scripts/fix-whatsapp-ubuntu.sh
sudo ./scripts/fix-whatsapp-ubuntu.sh
```

**What it does:**
- ✅ Installs all Chromium dependencies
- ✅ Installs required fonts
- ✅ Verifies Chromium installation
- ✅ Creates WhatsApp auth directory
- ✅ Sets environment variables

**Time:** ~2-3 minutes

---

### 2. `install-chromium-deps-ubuntu.sh`

**Purpose:** Detailed installation of Chromium dependencies.

**Usage:**
```bash
chmod +x scripts/install-chromium-deps-ubuntu.sh
./scripts/install-chromium-deps-ubuntu.sh
```

**What it does:**
- ✅ Updates package list
- ✅ Installs all Chromium libraries
- ✅ Installs system fonts for OCR
- ✅ Creates auth directory

**Time:** ~3-4 minutes

---

## Quick Start Guide

### First Time Setup on Ubuntu Server

1. **SSH into your Ubuntu server:**
   ```bash
   ssh user@192.168.239.154
   ```

2. **Navigate to application directory:**
   ```bash
   cd /var/www/billing
   ```

3. **Run the quick fix script:**
   ```bash
   sudo chmod +x scripts/fix-whatsapp-ubuntu.sh
   sudo ./scripts/fix-whatsapp-ubuntu.sh
   ```

4. **Rebuild and deploy:**
   ```bash
   npm run deploy:ubuntu
   ```

5. **Monitor logs:**
   ```bash
   pm2 logs billing-app
   ```

6. **Scan QR code** when it appears in logs

7. **Test the bot** by sending `/menu` via WhatsApp

---

## Troubleshooting

### Script Permission Denied

```bash
chmod +x scripts/*.sh
```

### Script Not Found

```bash
# Make sure you're in the right directory
pwd  # Should show: /var/www/billing

# Check if scripts exist
ls -la scripts/
```

### Still Getting Crash Loop

```bash
# Check if Chromium is installed
which chromium-browser

# Check PM2 logs for exact error
pm2 logs billing-app --lines 100

# Check system resources
free -h
df -h
```

### Need to Re-authenticate WhatsApp

```bash
# Remove old session
rm -rf .wwebjs_auth

# Restart application
pm2 restart billing-app

# Scan new QR code from logs
pm2 logs billing-app
```

---

## Additional Resources

- 📖 Full deployment guide: `DEPLOY_WHATSAPP_UBUNTU.md`
- 🔧 PM2 ecosystem config: `ecosystem.config.js`
- 📝 Application logs: `pm2 logs billing-app`

---

## Support

If scripts fail to fix the issue:

1. Run script with verbose output:
   ```bash
   bash -x scripts/fix-whatsapp-ubuntu.sh
   ```

2. Check for specific errors in output

3. Verify Ubuntu version compatibility:
   ```bash
   lsb_release -a
   ```

4. Contact support with complete error logs

---

**Version:** 2.3.16  
**Last Updated:** 2025-12-28  
**Tested On:** Ubuntu 20.04 LTS
