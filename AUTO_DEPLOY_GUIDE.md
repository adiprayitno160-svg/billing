# 🚀 AUTO DEPLOY GUIDE

Panduan lengkap untuk menggunakan auto-deploy script.

---

## 📋 AVAILABLE SCRIPTS

### 1. **DEPLOY-NOW.bat** (Windows - Paling Mudah!)
- ✅ **Recommended untuk Windows users**
- Double-click langsung jalan
- Tidak perlu command line

### 2. **auto-deploy.ps1** (Windows PowerShell)
- Untuk Windows advanced users
- Bisa custom parameter
- Lebih flexible

### 3. **auto-deploy.sh** (Linux/Mac)
- Untuk Linux/Mac/WSL
- Bash script
- Cross-platform

---

## 🎯 CARA PAKAI

### ✨ OPSI 1: Windows (TERMUDAH!)

**Double-click file ini:**
```
DEPLOY-NOW.bat
```

**That's it!** Script akan:
1. Connect ke server via SSH
2. Pull latest code dari GitHub
3. Restart PM2
4. Show status

**Screenshot expected:**
```
═══════════════════════════════════════════════════════════
🚀 AUTO DEPLOY v2.0.8.1 - Billing System
═══════════════════════════════════════════════════════════

Target Server: root@192.168.239.126
Project Path: /opt/billing

🔄 Starting deployment...
📂 Navigating to project directory...
✅ Current directory: /opt/billing
📥 Fetching latest changes...
📦 Pulling updates...
🔍 Checking version: 2.0.8
🔄 Restarting PM2...
✅ PM2 Status: online

═══════════════════════════════════════════════════════════
✅ DEPLOYMENT COMPLETED!
═══════════════════════════════════════════════════════════
```

---

### ⚡ OPSI 2: PowerShell (Windows Advanced)

**Buka PowerShell, lalu:**

```powershell
# Default (root@192.168.239.126)
.\auto-deploy.ps1

# Custom server
.\auto-deploy.ps1 -ServerIP "10.0.0.100" -ServerUser "admin"

# Custom project path
.\auto-deploy.ps1 -ProjectPath "/var/www/billing"
```

**Parameters:**
- `ServerIP`: IP address server (default: 192.168.239.126)
- `ServerUser`: SSH username (default: root)
- `ProjectPath`: Project directory (default: /opt/billing)

---

### 🐧 OPSI 3: Bash Script (Linux/Mac)

**Buka Terminal, lalu:**

```bash
# Make executable
chmod +x auto-deploy.sh

# Run default
./auto-deploy.sh

# Custom server
./auto-deploy.sh 10.0.0.100 admin

# Or with environment variables
SERVER_IP=10.0.0.100 SERVER_USER=admin ./auto-deploy.sh
```

---

## 📦 WHAT IT DOES

Auto-deploy script akan:

1. ✅ **Connect to server** via SSH
2. ✅ **Navigate** to project directory
3. ✅ **Fetch tags** from GitHub
4. ✅ **Pull latest code** from main branch
5. ✅ **Check version** (display current version)
6. ✅ **Restart PM2** application
7. ✅ **Verify status** (show PM2 status)
8. ✅ **Show logs** (last 10 lines)

**Total time:** ~10-20 seconds

---

## ⚙️ REQUIREMENTS

### Windows:
- ✅ Windows 10/11
- ✅ OpenSSH Client (built-in di Windows 10+)
- ✅ SSH key atau password untuk server
- ✅ PowerShell (built-in)

### Linux/Mac:
- ✅ Bash shell
- ✅ OpenSSH client (pre-installed)
- ✅ SSH key atau password untuk server

---

## 🔐 SSH SETUP

### Option 1: SSH Key (Recommended)

**Generate SSH key:**
```bash
ssh-keygen -t rsa -b 4096
```

**Copy to server:**
```bash
ssh-copy-id root@192.168.239.126
```

**Test:**
```bash
ssh root@192.168.239.126
```

Kalau bisa login tanpa password → ✅ Ready!

---

### Option 2: Password

Script akan prompt password setiap deploy.

**Pro:** Mudah setup  
**Con:** Harus input password setiap kali

---

## 🧪 TESTING

### After Deploy:

1. **Open browser:**
   ```
   http://192.168.239.126:3000/prepaid/dashboard
   ```

2. **Hard refresh:**
   - Windows: `Ctrl + F5`
   - Mac: `Cmd + Shift + R`

3. **Test Interface Traffic:**
   - Scroll to "Interface Traffic Realtime"
   - Select interface
   - Click "Start Monitor"
   - Wait 15-20 seconds
   - ✅ Graph should be smooth (no 0 jumps)

4. **Test Address List:**
   ```
   http://192.168.239.126:3000/prepaid/address-list
   ```
   - ✅ Should load without "belum dikonfigurasi" error

---

## 🆘 TROUBLESHOOTING

### ❌ "SSH not found"

**Windows:**
```powershell
# Install OpenSSH Client
Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0
```

**Linux/Mac:**
```bash
# Ubuntu/Debian
sudo apt install openssh-client

# Mac (should be pre-installed)
# If not: brew install openssh
```

---

### ❌ "Connection refused"

**Check server is running:**
```bash
ping 192.168.239.126
```

**Check SSH port:**
```bash
telnet 192.168.239.126 22
```

**Try manual SSH:**
```bash
ssh root@192.168.239.126
```

---

### ❌ "Permission denied"

**Check SSH key:**
```bash
ssh -v root@192.168.239.126
```

**Or use password:**
- Script akan prompt password
- Input password server

**Setup SSH key:**
```bash
ssh-keygen
ssh-copy-id root@192.168.239.126
```

---

### ❌ "git pull failed"

**Manual fix di server:**
```bash
ssh root@192.168.239.126
cd /opt/billing
git status
git reset --hard HEAD
git pull origin main
```

---

### ❌ "PM2 not found"

**Install PM2 di server:**
```bash
ssh root@192.168.239.126
npm install -g pm2
```

---

## 💡 TIPS

### 1. **Use SSH Key**
Setup sekali, deploy tanpa password selamanya.

```bash
ssh-keygen -t rsa -b 4096
ssh-copy-id root@192.168.239.126
```

### 2. **Create Alias**
Buat shortcut untuk deploy cepat.

**PowerShell:**
```powershell
# Add to $PROFILE
function Deploy-Billing { .\auto-deploy.ps1 }
Set-Alias deploy Deploy-Billing
```

**Bash:**
```bash
# Add to ~/.bashrc or ~/.zshrc
alias deploy='./auto-deploy.sh'
```

Usage:
```bash
deploy  # Just type this!
```

### 3. **Multiple Servers**
Simpan config untuk multiple servers.

**PowerShell:**
```powershell
# Deploy to production
.\auto-deploy.ps1 -ServerIP "192.168.1.100"

# Deploy to staging
.\auto-deploy.ps1 -ServerIP "192.168.1.200"
```

### 4. **Schedule Auto-Deploy**
Windows Task Scheduler atau cron untuk auto-deploy rutin.

**Cron example:**
```bash
# Deploy every day at 2 AM
0 2 * * * cd /path/to/billing && ./auto-deploy.sh
```

---

## 📊 DEPLOYMENT LOG

Auto-deploy akan menampilkan:

```
═══════════════════════════════════════════════════════════
🚀 AUTO DEPLOY v2.0.8.1 - Billing System
═══════════════════════════════════════════════════════════

Target Server: root@192.168.239.126
Project Path: /opt/billing

🔄 Step 1: Connecting to server...

🔄 Starting deployment...

📂 Step 2: Navigating to project directory...
✅ Current directory: /opt/billing

📥 Step 3: Fetching latest changes from GitHub...
From https://github.com/adiprayitno160-svg/billing
 * branch            main       -> FETCH_HEAD

📦 Step 4: Pulling updates...
Updating 200f765..6cc0e17
Fast-forward
 1 file changed, 56 insertions(+), 8 deletions(-)

🔍 Step 5: Checking version...
Current version: 2.0.8

🔄 Step 6: Restarting PM2 application...
[PM2] [billing-app](0) ✓

✅ Step 7: Verifying PM2 status...
┌────┬──────────────┬─────────┬────────┐
│ id │ name         │ version │ status │
├────┼──────────────┼─────────┼────────┤
│ 0  │ billing-app  │ 2.0.8   │ online │
└────┴──────────────┴─────────┴────────┘

📋 Step 8: Showing recent logs...
[billing-app] Server started on port 3000

═══════════════════════════════════════════════════════════
✅ DEPLOYMENT COMPLETED!
═══════════════════════════════════════════════════════════

🧪 Testing URLs:
  Dashboard: http://192.168.239.126:3000/prepaid/dashboard
  Address List: http://192.168.239.126:3000/prepaid/address-list

💡 Remember to:
  1. Hard refresh browser (Ctrl+F5)
  2. Wait 15-20 seconds for smooth graph
```

---

## ✅ SUCCESS INDICATORS

Deploy berhasil jika:
- ✅ No error messages
- ✅ PM2 status shows "online"
- ✅ Version matches latest (2.0.8 atau lebih)
- ✅ Logs show "Server started"

---

## 🎯 QUICK REFERENCE

### Windows (Easiest):
```
Double-click: DEPLOY-NOW.bat
```

### Windows (PowerShell):
```powershell
.\auto-deploy.ps1
```

### Linux/Mac:
```bash
chmod +x auto-deploy.sh && ./auto-deploy.sh
```

### Manual (Traditional):
```bash
ssh root@192.168.239.126
cd /opt/billing && git pull origin main && pm2 restart billing-app
```

---

## 📞 SUPPORT

**If deployment fails:**
1. Check error message in console
2. Try manual SSH: `ssh root@192.168.239.126`
3. Check PM2 logs: `pm2 logs billing-app`
4. Review troubleshooting section above

**For help:**
- Check: `AUTO_DEPLOY_GUIDE.md` (this file)
- Check: `HOTFIX_INTERFACE_TRAFFIC_v2.0.8.1.txt`
- Check: PM2 logs on server

---

**Version:** 2.0.8.1  
**Last Updated:** October 29, 2025  
**Status:** Production Ready ✅

**Happy Auto-Deploying!** 🚀✨

