# 🚀 Auto Release Guide

Panduan menggunakan script auto-release untuk membuat GitHub Release otomatis.

---

## Prerequisites

### 1. Install GitHub CLI

**Windows:**
```powershell
winget install --id GitHub.cli
```

**macOS:**
```bash
brew install gh
```

**Linux (Debian/Ubuntu):**
```bash
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh
```

### 2. Login ke GitHub CLI

```bash
gh auth login
```

Pilih:
- GitHub.com
- HTTPS
- Login with web browser

---

## Usage

### Windows (PowerShell)

```powershell
# Patch release (1.0.0 → 1.0.1)
.\release.ps1 patch "Bug fixes"

# Minor release (1.0.1 → 1.1.0)
.\release.ps1 minor "New features added"

# Major release (1.1.0 → 2.0.0)
.\release.ps1 major "Breaking changes"
```

### Linux/macOS (Bash)

```bash
# Make script executable (first time only)
chmod +x release.sh

# Patch release (1.0.0 → 1.0.1)
./release.sh patch "Bug fixes"

# Minor release (1.0.1 → 1.1.0)
./release.sh minor "New features added"

# Major release (1.1.0 → 2.0.0)
./release.sh major "Breaking changes"
```

---

## Apa yang Dilakukan Script?

Script akan otomatis:

1. ✅ **Bump version** di `package.json` dan `VERSION` file
2. ✅ **Commit changes** dengan message "Release vX.X.X"
3. ✅ **Create git tag** (e.g., v1.0.1)
4. ✅ **Push ke GitHub** (code + tag)
5. ✅ **Generate changelog** dari commits
6. ✅ **Create GitHub Release** dengan notes lengkap
7. ✅ **Mark as latest** release

---

## Version Bumping Rules

| Type | From | To | When to Use |
|------|------|-----|-------------|
| **patch** | 1.0.0 | 1.0.1 | Bug fixes, small improvements |
| **minor** | 1.0.1 | 1.1.0 | New features (backward compatible) |
| **major** | 1.1.0 | 2.0.0 | Breaking changes |

---

## Example Workflow

### Scenario: Fix bug invoice template

```powershell
# 1. Fix bug di code
git add src/controllers/settings/companyController.ts
git commit -m "Fix: Invoice template view path"

# 2. Fix bug lainnya
git add ecosystem.config.js src/server.ts
git commit -m "Fix: PM2 config and HTTPS upgrade"

# 3. Buat release
.\release.ps1 patch "Fix invoice template and PM2 issues"
```

Output:
```
🚀 Starting Auto Release Process...

Current version: 1.0.0
New version: 1.0.1

📝 Updating package.json...
✓ VERSION file updated

📦 Committing changes...
🏷️  Creating git tag v1.0.1...
⬆️  Pushing to GitHub...
✓ Pushed to GitHub

📋 Generating changelog...
🎉 Creating GitHub Release...

✅ Release v1.0.1 berhasil dibuat!
🔗 https://github.com/adiprayitno160-svg/billing/releases/tag/v1.0.1

📢 Sekarang user bisa update dengan:
   1. Buka About page di aplikasi
   2. Klik 'Check for Updates'
   3. Klik 'Update Now'
```

---

## User Auto-Update

Setelah release dibuat, user di server bisa update dengan 2 cara:

### Cara 1: Via Web UI (Recommended)

1. Login ke aplikasi
2. Buka menu **About** atau **Settings**
3. Klik tombol **"Check for Updates"**
4. Jika ada update: **"Update Now"**
5. Aplikasi otomatis:
   - Backup database
   - Download release
   - Extract files
   - Run migrations
   - Restart PM2

### Cara 2: Manual (Traditional)

```bash
cd /opt/billing
git pull origin main
npm install
npm run build
pm2 restart billing-app
```

---

## Troubleshooting

### Error: gh command not found

Install GitHub CLI terlebih dahulu (lihat Prerequisites)

### Error: Not logged in

Jalankan: `gh auth login`

### Error: Permission denied

**Windows:**
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Linux/macOS:**
```bash
chmod +x release.sh
```

### Error: Git not clean

Commit atau stash changes dulu:
```bash
git status
git add .
git commit -m "Your changes"
```

---

## Best Practices

1. **Always test locally first** sebelum release
2. **Write meaningful commit messages** (akan jadi changelog)
3. **Use patch for bug fixes**, minor for features
4. **Create release dari branch `main`** yang stable
5. **Test auto-update** di development server dulu

---

## Release Notes Template

Script otomatis generate, tapi Anda bisa edit manual di GitHub:

```markdown
## Version 1.0.1

Fix invoice template and PM2 issues

### Changes:
- Fix: Invoice template view path
- Fix: PM2 config and HTTPS upgrade
- Fix: GitHub repo name for auto-update

### Installation:
```bash
cd /opt/billing
git pull origin main
npm install
npm run build
pm2 restart billing-app
```

### Auto-Update:
Buka halaman About di aplikasi, lalu klik "Check for Updates" → "Update Now"
```

---

## Advanced: Custom Release Notes

Edit script untuk custom format:

```bash
# Edit release.sh atau release.ps1
nano release.sh

# Cari bagian RELEASE_NOTES
# Customize sesuai kebutuhan
```

---

**Happy Releasing! 🎉**

