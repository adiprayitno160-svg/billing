#!/bin/bash

# Auto Release Script untuk Billing System
# Usage: ./release.sh [major|minor|patch] "Release message"

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) tidak terinstall!${NC}"
    echo "Install dengan: https://cli.github.com/"
    exit 1
fi

# Check if logged in to gh
if ! gh auth status &> /dev/null; then
    echo -e "${RED}Error: Belum login ke GitHub CLI!${NC}"
    echo "Jalankan: gh auth login"
    exit 1
fi

# Get version type (major, minor, patch)
VERSION_TYPE=${1:-patch}
RELEASE_MESSAGE=${2:-"Bug fixes and improvements"}

# Validate version type
if [[ ! "$VERSION_TYPE" =~ ^(major|minor|patch)$ ]]; then
    echo -e "${RED}Error: Version type harus major, minor, atau patch${NC}"
    echo "Usage: ./release.sh [major|minor|patch] \"Release message\""
    exit 1
fi

echo -e "${GREEN}🚀 Starting Auto Release Process...${NC}\n"

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${YELLOW}Current version: ${CURRENT_VERSION}${NC}"

# Calculate new version
IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR=${VERSION_PARTS[0]}
MINOR=${VERSION_PARTS[1]}
PATCH=${VERSION_PARTS[2]}

case $VERSION_TYPE in
    major)
        MAJOR=$((MAJOR + 1))
        MINOR=0
        PATCH=0
        ;;
    minor)
        MINOR=$((MINOR + 1))
        PATCH=0
        ;;
    patch)
        PATCH=$((PATCH + 1))
        ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"
echo -e "${GREEN}New version: ${NEW_VERSION}${NC}\n"

# Update package.json
echo -e "${YELLOW}📝 Updating package.json...${NC}"
npm version $NEW_VERSION --no-git-tag-version

# Update VERSION file
echo $NEW_VERSION > VERSION
echo -e "${GREEN}✓ VERSION file updated${NC}"

# Commit changes
echo -e "\n${YELLOW}📦 Committing changes...${NC}"
git add package.json package-lock.json VERSION
git commit -m "Release v${NEW_VERSION}"

# Create git tag
echo -e "${YELLOW}🏷️  Creating git tag v${NEW_VERSION}...${NC}"
git tag -a "v${NEW_VERSION}" -m "Release v${NEW_VERSION}: ${RELEASE_MESSAGE}"

# Push to GitHub
echo -e "${YELLOW}⬆️  Pushing to GitHub...${NC}"
git push origin main
git push origin "v${NEW_VERSION}"

echo -e "${GREEN}✓ Pushed to GitHub${NC}"

# Get recent commits for changelog
echo -e "\n${YELLOW}📋 Generating changelog...${NC}"
CHANGELOG=$(git log --pretty=format:"- %s" $(git describe --tags --abbrev=0 HEAD^)..HEAD 2>/dev/null || git log --pretty=format:"- %s" -10)

# Create GitHub Release
echo -e "${YELLOW}🎉 Creating GitHub Release...${NC}"

RELEASE_NOTES="## Version ${NEW_VERSION}

${RELEASE_MESSAGE}

### Changes:
${CHANGELOG}

### Installation:
\`\`\`bash
cd /opt/billing
git pull origin main
npm install
npm run build
pm2 restart billing-app
\`\`\`

### Auto-Update:
Buka halaman About di aplikasi, lalu klik \"Check for Updates\" → \"Update Now\"
"

gh release create "v${NEW_VERSION}" \
    --title "Release v${NEW_VERSION}" \
    --notes "$RELEASE_NOTES" \
    --latest

echo -e "\n${GREEN}✅ Release v${NEW_VERSION} berhasil dibuat!${NC}"
echo -e "${GREEN}🔗 https://github.com/adiprayitno160-svg/billing/releases/tag/v${NEW_VERSION}${NC}"
echo -e "\n${YELLOW}📢 Sekarang user bisa update dengan:${NC}"
echo -e "   1. Buka About page di aplikasi"
echo -e "   2. Klik 'Check for Updates'"
echo -e "   3. Klik 'Update Now'"

