# 🚀 Direct Deploy Guide

Panduan deploy langsung dari local Windows ke server Debian tanpa perlu create GitHub Release.

---

## Workflow Development

### Old Way (Ribet):
```
Local fix → Commit → Push → Create Release → Server: git pull → rebuild → restart
```

### New Way (Easy):
```
Local fix → .\deploy.ps1 → Done! ✅
```

---

## Setup (One Time Only)

### 1. Setup SSH Key (Opsional tapi Recommended)

**Di Windows PowerShell:**

```powershell
# Generate SSH key (jika belum punya)
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
# Tekan Enter 3x (pakai default path, tanpa passphrase)

# Copy public key
cat ~\.ssh\id_rsa.pub | clip
```

**Di Server Debian:**

```bash
# Paste public key ke authorized_keys
mkdir -p ~/.ssh
echo "PASTE_PUBLIC_KEY_HERE" >> ~/.ssh/.authorized_keys
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

**Test SSH tanpa password:**

```powershell
ssh root@192.168.239.126
# Seharusnya langsung masuk tanpa diminta password
```

---

### 2. Customize Deploy Script (Opsional)

Edit `deploy.ps1`, ubah default values:

```powershell
param(
    [string]$ServerIP = "192.168.239.126",  # ← Ganti IP server Anda
    [string]$ServerUser = "root",            # ← Ganti user jika bukan root
    [string]$ServerPath = "/opt/billing"    # ← Ganti path jika beda
)
```

---

## Usage

### Deploy Biasa

```powershell
# Di folder billing (Windows)
.\deploy.ps1
```

Script akan otomatis:
- ✅ Push ke GitHub
- ✅ Pull di server
- ✅ Install dependencies
- ✅ Build TypeScript
- ✅ Build Tailwind CSS
- ✅ Restart PM2

---

### Deploy ke IP Berbeda

```powershell
.\deploy.ps1 -ServerIP "10.0.0.100"
```

---

### Deploy dengan User Berbeda

```powershell
.\deploy.ps1 -ServerUser "debian" -ServerIP "192.168.1.100"
```

---

## Typical Workflow

### Scenario: Fix Bug di Local

```powershell
# 1. Edit code di Windows
code src/controllers/aboutController.ts

# 2. Test di local
npm run dev

# 3. Commit changes
git add .
git commit -m "Fix: something"

# 4. Deploy ke server
.\deploy.ps1

# 5. Test di server
# Buka browser: http://SERVER_IP:3000
```

---

### Scenario: Update CSS/View Only

Kalau hanya update view atau CSS (tidak perlu npm install):

```powershell
# 1. Edit view
code views/about/index.ejs

# 2. Deploy
.\deploy.ps1

# Deploy script tetap rebuild CSS & restart PM2
```

---

## Troubleshooting

### Error: ssh command not found

Install OpenSSH di Windows:

```powershell
# Windows 10/11 (Run as Administrator)
Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0
```

Atau download: https://www.openssh.com/

---

### Error: Permission denied (publickey)

Setup SSH key dulu (lihat Setup section), atau input password manual setiap kali.

---

### Error: git pull failed

Mungkin ada conflict di server. Fix manual:

```bash
# Di server
cd /opt/billing
git status
git stash  # Simpan perubahan lokal
git pull origin main
git stash pop  # Restore perubahan (jika perlu)
```

---

### Error: npm run build failed

Cek error di output. Biasanya:
- TypeScript compile error → Fix di code
- Missing dependencies → Jalankan `npm install`

---

## Best Practices

### 1. Always Commit Before Deploy

```powershell
git add .
git commit -m "Description"
.\deploy.ps1
```

### 2. Test di Local Dulu

```powershell
npm run dev
# Test di http://localhost:3000
# Kalau OK, baru deploy
```

### 3. Check Server Logs After Deploy

```powershell
ssh root@192.168.239.126 'pm2 logs billing-app --lines 20'
```

### 4. Use GitHub Release for Major Updates

Deploy script untuk development. Untuk production release:

```powershell
# Setelah testing OK, buat release
.\release.ps1 patch "Bug fixes description"
```

---

## Deploy vs Release

| | Deploy Script | Release Script |
|---|---|---|
| **Untuk** | Development/Testing | Production |
| **Command** | `.\deploy.ps1` | `.\release.ps1` |
| **Ke mana** | Direct ke 1 server | GitHub Release |
| **User update** | Otomatis (1 server) | Klik "Update Now" di About |
| **Version bump** | Tidak | Ya (1.0.0 → 1.0.1) |
| **Changelog** | Tidak | Ya |

---

## Example Workflow

### Development Cycle

```powershell
# Morning: Start working
git pull origin main

# Fix bugs/add features
code .

# Test locally
npm run dev

# Looks good? Deploy!
git add .
git commit -m "Fix: invoice template"
.\deploy.ps1

# More fixes?
# Repeat: edit → commit → deploy

# End of day: Create release
.\release.ps1 patch "Daily bug fixes"
```

---

## Advanced: Deploy to Multiple Servers

Create config file `deploy-config.json`:

```json
{
  "servers": [
    {
      "name": "Production",
      "ip": "192.168.1.100",
      "user": "root"
    },
    {
      "name": "Staging",
      "ip": "192.168.1.101",
      "user": "debian"
    }
  ]
}
```

Then modify script to read from config... (TODO)

---

**Happy Deploying! 🚀**

