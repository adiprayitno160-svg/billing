#!/bin/bash

# Quick Release Script untuk v2.1.4
# Usage: ./release-v2.1.4.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "\n${GREEN}🚀 Starting Release v2.1.4...${NC}\n"

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ Error: GitHub CLI (gh) tidak terinstall!${NC}"
    echo -e "${CYAN}📥 Install dari: https://cli.github.com/${NC}"
    exit 1
fi

# Check if logged in to gh
if ! gh auth status &> /dev/null; then
    echo -e "${RED}❌ Error: Belum login ke GitHub CLI!${NC}"
    echo -e "${CYAN}🔐 Jalankan: gh auth login${NC}"
    exit 1
fi

echo -e "${GREEN}✅ GitHub CLI ready${NC}\n"

# Version
VERSION="2.1.4"

# Check if working directory is clean
echo -e "${CYAN}📋 Checking git status...${NC}"
if [[ -n $(git status --porcelain) ]]; then
    echo -e "\n${YELLOW}⚠️  You have uncommitted changes:${NC}"
    git status --short
    
    read -p "$(echo -e ${CYAN}'\nCommit these changes? (y/n): '${NC})" -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "\n${CYAN}📦 Staging all changes...${NC}"
        git add .
        
        read -p "$(echo -e ${CYAN}'💬 Commit message: '${NC})" COMMIT_MSG
        if [[ -z "$COMMIT_MSG" ]]; then
            COMMIT_MSG="Release v$VERSION - Multiple improvements"
        fi
        
        git commit -m "$COMMIT_MSG"
        echo -e "${GREEN}✅ Changes committed${NC}\n"
    else
        echo -e "\n${YELLOW}⚠️  Continuing without committing...${NC}\n"
    fi
fi

# Create git tag if not exists
echo -e "${CYAN}🏷️  Checking for existing tag...${NC}"
if git rev-parse "v$VERSION" >/dev/null 2>&1; then
    read -p "$(echo -e ${YELLOW}'⚠️  Tag v'$VERSION' already exists. Delete and recreate? (y/n): '${NC})" -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git tag -d "v$VERSION"
        git push origin ":refs/tags/v$VERSION" 2>/dev/null || true
        echo -e "${GREEN}✅ Old tag deleted${NC}\n"
    else
        echo -e "\n${RED}❌ Aborting release...${NC}\n"
        exit 1
    fi
fi

# Create new tag
echo -e "${CYAN}🏷️  Creating git tag v$VERSION...${NC}"
git tag -a "v$VERSION" -m "Release v$VERSION: UI/UX improvements and bug fixes"
echo -e "${GREEN}✅ Tag created${NC}\n"

# Push to GitHub
read -p "$(echo -e ${CYAN}'⬆️  Push to GitHub? (y/n): '${NC})" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${CYAN}⬆️  Pushing to GitHub...${NC}"
    git push origin main
    git push origin "v$VERSION"
    echo -e "${GREEN}✅ Pushed to GitHub${NC}\n"
else
    echo -e "${YELLOW}⚠️  Skipping push. You can push manually later with:${NC}"
    echo -e "   git push origin main"
    echo -e "   git push origin v$VERSION\n"
fi

# Release Notes
RELEASE_NOTES=$(cat <<'EOF'
## 🎉 Version 2.1.4

Rilis ini fokus pada perbaikan sistem update, konsistensi UI, dan peningkatan WhatsApp bot.

### ✨ Fitur Baru & Perbaikan

#### 🔄 Sistem Update
- **Fix Update Redirect**: Setelah update selesai, tidak lagi menampilkan "unable to connect"
- **Auto-redirect ke About**: User otomatis diarahkan ke halaman About setelah update berhasil
- **Visual Progress**: Loading indicator dengan step-by-step progress (✅ checkmarks)
- **Real-time Status**: Update status langsung terlihat saat proses berlangsung
- **Success Notification**: Notifikasi hijau muncul setelah redirect berhasil
- **Smart Timeout Handling**: Fallback handling jika server butuh waktu lebih lama

#### 🎨 UI/UX Improvements
- **Fix Header Double**: Perbaikan header ganda pada halaman billing
  - Riwayat Tagihan (tagihan.ejs)
  - Pelacakan Hutang (debt-tracking.ejs)
  - Billing Report (reports.ejs)
- **Real-time Clock**: Jam digital di header kanan atas dengan format HH:MM:SS
- **Layout About Page**: Changelog (2 kolom) dan Update Terbaru (1 kolom kanan)
- **Konsistensi Layout**: Semua halaman billing menggunakan layout yang sama

#### 📱 WhatsApp Bot Enhancements
- **Filter Status WhatsApp**: Bot tidak merespon status/story WhatsApp (status@broadcast)
- **Filter Pesan Grup**: Bot tidak merespon pesan di grup WhatsApp (@g.us)
- **Filter Self Message**: Bot tidak membalas pesan dari dirinya sendiri
- **Better Message Handling**: Penanganan pesan yang lebih baik dan akurat

### 📦 Perubahan File
- `VERSION` → 2.1.4
- `VERSION_MAJOR` → 2.1.4
- `VERSION_HOTFIX` → 2.1.4
- `package.json` → 2.1.4
- `src/services/whatsapp/WhatsAppWebService.ts` - WhatsApp bot filters
- `views/about/index.ejs` - Update system improvements
- `views/billing/*.ejs` - Layout consistency fixes
- `views/partials/header.ejs` - Real-time clock

### 🚀 Cara Update

#### Via Auto-Update (Recommended):
1. Login ke aplikasi billing
2. Buka menu **Tentang Aplikasi** (About)
3. Klik tombol **"Cek Update"**
4. Klik **"Update Sekarang"**
5. Tunggu hingga proses selesai (1-2 menit)
6. Aplikasi akan otomatis refresh ke halaman About
7. Notifikasi hijau akan muncul jika berhasil

#### Via Manual Update:
```bash
cd /opt/billing  # atau path instalasi Anda
git fetch origin
git checkout v2.1.4
npm install
npm run build
pm2 restart billing-app
```

#### Via Git Pull:
```bash
cd /opt/billing
git pull origin main
npm install
npm run build
pm2 restart billing-app
```

### 🐛 Bug Fixes
- Fixed: Unable to connect setelah update
- Fixed: Header ganda pada halaman billing
- Fixed: WhatsApp bot merespon status WhatsApp
- Fixed: WhatsApp bot merespon pesan grup
- Fixed: Layout tidak konsisten antar halaman

### 📝 Technical Details
- Improved update flow dengan checkServerAndRedirect()
- Enhanced loading indicator dengan step completion
- URL parameter handling untuk success/timeout notification
- Visual feedback untuk setiap tahap update process
- Better error handling dan fallback mechanism

### 🔗 Links
- **Repository**: https://github.com/adiprayitno160-svg/billing
- **Issues**: https://github.com/adiprayitno160-svg/billing/issues
- **Documentation**: Check /docs folder in repository

### ⚠️ Breaking Changes
Tidak ada breaking changes pada rilis ini.

### 📸 Preview
- ✅ Update system dengan progress indicator
- ✅ Success notification setelah update
- ✅ Real-time clock di header
- ✅ Konsisten layout billing pages

---

**Full Changelog**: https://github.com/adiprayitno160-svg/billing/compare/v2.1.3...v2.1.4
EOF
)

# Create GitHub Release
echo -e "${CYAN}🎉 Creating GitHub Release v$VERSION...${NC}"
if gh release create "v$VERSION" \
    --title "Release v$VERSION - Update System & UI Improvements" \
    --notes "$RELEASE_NOTES" \
    --latest; then
    
    echo -e "\n${GREEN}✅ Release v$VERSION berhasil dibuat!${NC}"
    echo -e "${CYAN}🔗 https://github.com/adiprayitno160-svg/billing/releases/tag/v$VERSION${NC}\n"
    
    echo -e "${CYAN}📢 Users sekarang bisa update dengan:${NC}"
    echo -e "   1. Buka halaman About di aplikasi"
    echo -e "   2. Klik 'Cek Update'"
    echo -e "   3. Klik 'Update Sekarang'"
    echo -e "   4. Tunggu hingga redirect otomatis ke About"
    echo -e "   5. Lihat notifikasi hijau 'Update Berhasil!'\n"
else
    echo -e "\n${RED}❌ Error creating release${NC}"
    echo -e "\n${CYAN}You can create it manually with:${NC}"
    echo -e "gh release create v$VERSION --title 'Release v$VERSION' --notes-file RELEASE_NOTES.md --latest\n"
    exit 1
fi

echo -e "${GREEN}🎊 Done!${NC}\n"


