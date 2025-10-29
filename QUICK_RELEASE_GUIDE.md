# 🚀 Quick Release Guide - v2.0.3

## ⚡ Auto Release (Recommended)

### Windows:
```bash
# Double-click atau run:
release-v2.0.3.bat
```

### Linux/Mac:
```bash
# Make executable & run:
chmod +x release-v2.0.3.sh
./release-v2.0.3.sh
```

**That's it!** Script akan otomatis:
1. ✅ Add & commit semua perubahan
2. ✅ Push ke GitHub
3. ✅ Create release v2.0.3 dengan notes
4. ✅ Set as latest release

---

## 📋 Prerequisites

1. **GitHub CLI installed:**
   - Download: https://cli.github.com/
   - Windows: `winget install GitHub.cli`
   - Mac: `brew install gh`
   - Linux: `sudo apt install gh`

2. **Authenticated:**
   ```bash
   gh auth login
   ```

3. **Git configured:**
   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "your@email.com"
   ```

---

## 🎯 What Gets Released

### Version: **2.0.3**

### Changes:
- ⚡ 90% faster prepaid pages
- 🔧 Auto-fix database system
- 📦 Aggressive caching
- 🏥 Health monitoring
- 🐛 Multiple bug fixes

### Files:
- **4 core files** optimized
- **5 documentation** files
- **3 SQL migration** files
- **4 utility scripts**
- **2 version files** (package.json, VERSION)

---

## ✅ After Release

### Verify on GitHub:
1. Go to: `https://github.com/YOUR_USERNAME/billing-system/releases`
2. Check: v2.0.3 is marked as "Latest"
3. Verify: Release notes are correct
4. Test: Download source code (zip/tar.gz)

### Update Documentation:
Update your repository's main README.md if needed:
```markdown
## Latest Version: v2.0.3
- 90% faster prepaid pages
- Auto-fix database
- See [CHANGELOG](CHANGELOG_v2.0.3.md)
```

---

## 👥 User Installation

Users can install/update dengan:

### New Installation:
```bash
# Download release
wget https://github.com/YOUR_USERNAME/billing-system/archive/refs/tags/v2.0.3.tar.gz
tar -xzf v2.0.3.tar.gz
cd billing-system-2.0.3

# Install
npm install
cp env.example .env
# Edit .env dengan kredensial Anda

# Build & run
npm run build
pm2 start ecosystem.config.js
```

### Upgrade from v2.0.2:
```bash
# Pull latest
git pull origin main

# Install dependencies (jika ada yang baru)
npm install

# Build
npm run build

# Restart
pm2 restart billing-system

# Verify auto-fix
pm2 logs billing-system --lines 20
```

**Look for:**
```
🔧 [AutoFix] Checking prepaid_packages table...
✅ [AutoFix] prepaid_packages table is OK
```

---

## 🐛 Troubleshooting

### Error: "Tag already exists"
```bash
# Delete local tag
git tag -d v2.0.3

# Delete remote tag
git push origin :refs/tags/v2.0.3

# Re-run release script
release-v2.0.3.bat
```

### Error: "Authentication failed"
```bash
# Re-authenticate
gh auth logout
gh auth login
```

### Error: "Permission denied"
Make sure you have:
- Write access to repository
- GitHub token with `repo` scope

---

## 📊 Release Checklist

Before release:
- [x] Version bumped (2.0.2 → 2.0.3)
- [x] CHANGELOG created
- [x] Release notes prepared
- [x] All code compiled successfully
- [x] Auto-fix tested locally
- [x] Documentation updated

After release:
- [ ] Verify release on GitHub
- [ ] Test download links
- [ ] Update README (if needed)
- [ ] Announce to users
- [ ] Monitor feedback
- [ ] Watch for issues

---

## 🎉 Success!

Once released, users will see:

**On GitHub Releases:**
```
v2.0.3 - Performance Boost & Auto-Fix
Latest    Oct 28, 2025

⚡ 90% faster prepaid pages!
🔧 Auto-fix database system
📦 Aggressive caching
🐛 Multiple bug fixes

[Download Source Code (zip)]
[Download Source Code (tar.gz)]
```

**On Update Check (in app):**
```
🎉 New version available!

Current: v2.0.2
Latest: v2.0.3

What's New:
• 90% faster prepaid pages
• Auto-fix database
• Better MikroTik handling

[Update Now]
```

---

**Ready to release?**

Run:
- **Windows:** `release-v2.0.3.bat`
- **Linux/Mac:** `./release-v2.0.3.sh`

🚀 **Good luck!**

