import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Release Versioning Script
 * Usage: npx ts-node src/scripts/release.ts [patch|minor|major]
 */

const packagePath = join(__dirname, '../../package.json');
const versionPath = join(__dirname, '../../VERSION');
const versionMajorPath = join(__dirname, '../../VERSION_MAJOR');

function updateVersion() {
    const type = process.argv[2] || 'patch';

    if (!existsSync(packagePath)) {
        console.error('❌ package.json not found');
        return;
    }

    const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
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
    } else if (type === 'minor') {
        minor++;
        patch = 0;
    } else {
        patch++;
    }

    const nextVersion = `${major}.${minor}.${patch}`;

    // Update package.json
    pkg.version = nextVersion;
    writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');

    // Update VERSION files
    writeFileSync(versionPath, nextVersion);
    writeFileSync(versionMajorPath, nextVersion);

    console.log(`✅ Version bumped: ${currentVersion} ➔ ${nextVersion} (${type})`);

    // Create release notes template
    const releaseNotesPath = join(__dirname, `../../RELEASE_NOTES_v${nextVersion}.md`);
    if (!existsSync(releaseNotesPath)) {
        const template = `# Release Notes v${nextVersion}\nDate: ${new Date().toISOString().split('T')[0]}\n\n## New Features\n- [ ] Feature 1\n\n## Improvements\n- [ ] Improvement 1\n\n## Fixes\n- [ ] Fix 1\n`;
        writeFileSync(releaseNotesPath, template);
        console.log(`📝 Release notes template created: RELEASE_NOTES_v${nextVersion}.md`);
    }
}

updateVersion();
