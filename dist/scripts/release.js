"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
/**
 * Release Versioning Script
 * Usage: npx ts-node src/scripts/release.ts [patch|minor|major]
 */
const packagePath = (0, path_1.join)(__dirname, '../../package.json');
const versionPath = (0, path_1.join)(__dirname, '../../VERSION');
const versionMajorPath = (0, path_1.join)(__dirname, '../../VERSION_MAJOR');
function updateVersion() {
    const type = process.argv[2] || 'patch';
    if (!(0, fs_1.existsSync)(packagePath)) {
        console.error('❌ package.json not found');
        return;
    }
    const pkg = JSON.parse((0, fs_1.readFileSync)(packagePath, 'utf-8'));
    const currentVersion = pkg.version;
    const parts = currentVersion.split('.');
    if (parts.length !== 3) {
        console.error('❌ Invalid version format in package.json');
        return;
    }
    let [major, minor, patch] = parts.map(Number);
    if (type === 'major') {
        major++;
        minor = 0;
        patch = 0;
    }
    else if (type === 'minor') {
        minor++;
        patch = 0;
    }
    else {
        patch++;
    }
    const nextVersion = `${major}.${minor}.${patch}`;
    // Update package.json
    pkg.version = nextVersion;
    (0, fs_1.writeFileSync)(packagePath, JSON.stringify(pkg, null, 2) + '\n');
    // Update VERSION files
    (0, fs_1.writeFileSync)(versionPath, nextVersion);
    (0, fs_1.writeFileSync)(versionMajorPath, nextVersion);
    console.log(`✅ Version bumped: ${currentVersion} ➔ ${nextVersion} (${type})`);
    // Create release notes template
    const releaseNotesPath = (0, path_1.join)(__dirname, `../../RELEASE_NOTES_v${nextVersion}.md`);
    if (!(0, fs_1.existsSync)(releaseNotesPath)) {
        const template = `# Release Notes v${nextVersion}\nDate: ${new Date().toISOString().split('T')[0]}\n\n## New Features\n- [ ] Feature 1\n\n## Improvements\n- [ ] Improvement 1\n\n## Fixes\n- [ ] Fix 1\n`;
        (0, fs_1.writeFileSync)(releaseNotesPath, template);
        console.log(`📝 Release notes template created: RELEASE_NOTES_v${nextVersion}.md`);
    }
}
updateVersion();
//# sourceMappingURL=release.js.map