# WhatsApp Bot Ubuntu Server Deployment Guide

## Problem
WhatsApp bot using `whatsapp-web.js` causes crash loop on Ubuntu server due to missing Chromium dependencies.

## Solution Steps

### 1. Install Chromium Dependencies on Ubuntu Server

SSH into your Ubuntu server and run:

```bash
cd /var/www/billing

# Make script executable
chmod +x scripts/install-chromium-deps-ubuntu.sh

# Run installation script
./scripts/install-chromium-deps-ubuntu.sh
```

This will install:
- ✅ All required Chromium libraries
- ✅ System fonts for better text recognition
- ✅ Create WhatsApp auth directory with proper permissions

### 2. Verify Chromium Installation

```bash
# Check if Chromium is installed
which chromium-browser

# Should output: /usr/bin/chromium-browser

# Test Chromium
chromium-browser --version
```

### 3. Rebuild and Deploy Application

```bash
cd /var/www/billing

# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build TypeScript
npm run build

# Restart PM2 with production environment
pm2 delete billing-app
pm2 start ecosystem.config.js --env production

# View logs
pm2 logs billing-app
```

### 4. Monitor WhatsApp Bot Initialization

```bash
# Follow logs in real-time
pm2 logs billing-app --lines 100

# You should see:
# ✅ "📱 Initializing WhatsApp Web service..."
# ✅ "📱 QR Code generated" (if not authenticated yet)
# ✅ "✅ WhatsApp connection opened successfully!" (after QR scan)
```

### 5. Scan QR Code (First Time Only)

If this is the first time or you need to re-authenticate:

**Option A: Via Application UI**
1. Navigate to: http://192.168.239.154:3001/admin/whatsapp
2. The QR code will be displayed on the page
3. Scan with WhatsApp on your phone

**Option B: Via Terminal Logs**
1. The QR code will be printed in the PM2 logs
2. View with: `pm2 logs billing-app`
3. Scan the ASCII QR code from terminal

### 6. Test WhatsApp Bot

Once authenticated, test the bot:

**From your registered customer WhatsApp:**
```
/menu
```

Expected response: Main menu with options (Tagihan, WiFi, Reboot, etc.)

### 7. Verify No Crash Loop

```bash
# Check application status
pm2 status

# Should show:
# │ billing-app │ online │ 0 │ (uptime > 30s)

# Check restart count
pm2 show billing-app | grep restart

# Restart count should stay at 0 or low number
```

## Troubleshooting

### Issue: "Failed to launch the browser process"

**Solution:**
```bash
# Install missing dependencies
sudo apt-get update
sudo apt-get install -y chromium-browser libgbm1 libnss3 libatk-bridge2.0-0
```

### Issue: "Error: spawn ENOENT chromium-browser"

**Solution:**
```bash
# Set Chromium path manually
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Or add to PM2 ecosystem config (already done in v2.3.15)
```

### Issue: "Timeout waiting for Chromium"

**Solution:**
```bash
# Increase timeout in WhatsAppService.ts (already set to 60s in v2.3.15)
# Or check system resources
free -h
top
```

### Issue: PM2 keeps restarting

**Solution:**
```bash
# View detailed error logs
pm2 logs billing-app --err --lines 500

# Check for specific errors and address them
# Common issues:
# - Missing dependencies (run install script)
# - Permissions (check .wwebjs_auth directory)
# - Memory (increase max_memory_restart in ecosystem.config.js)
```

### Issue: "Cannot find module 'whatsapp-web.js'"

**Solution:**
```bash
# Reinstall dependencies
cd /var/www/billing
rm -rf node_modules package-lock.json
npm install
npm run build
pm2 restart billing-app
```

## Environment Variables

Add to `.env` file on Ubuntu server (optional overrides):

```env
# Chromium executable path (auto-detected by default)
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# WhatsApp config
WHATSAPP_ENABLED=true
WHATSAPP_TIMEOUT=60000
```

## Performance Optimization

### Memory Management
```bash
# Monitor memory usage
pm2 monit

# If memory usage is high, adjust in ecosystem.config.js:
max_memory_restart: '750M'  # Reduce if needed
```

### Disable WhatsApp Bot (if needed)
```bash
# Temporarily disable WhatsApp bot without stopping app
# Comment out in src/server.ts:
# await WhatsAppService.initialize();
```

## Success Criteria

✅ Application runs without crash loop
✅ PM2 status shows "online" with stable uptime
✅ WhatsApp QR code generated successfully
✅ After scanning, bot responds to /menu command
✅ Bot can process payment verification images
✅ No "freeze" or "timeout" errors in logs

## Version Information

- **Application Version:** 2.3.15
- **Node.js:** v20.19.6
- **Ubuntu:** 20.04 LTS
- **PM2:** Latest
- **whatsapp-web.js:** v1.34.2
- **Puppeteer:** v24.26.0

## Support

If you encounter issues not covered above:

1. Check full logs: `pm2 logs billing-app --lines 1000`
2. Check server resources: `htop` or `top`
3. Verify all dependencies installed: `./scripts/install-chromium-deps-ubuntu.sh`
4. Contact support with complete error logs

---

**Last Updated:** 2025-12-28 (v2.3.15)
**Status:** ✅ Ready for deployment
