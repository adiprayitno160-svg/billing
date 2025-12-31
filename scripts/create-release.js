const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const versionFile = path.join(rootDir, 'VERSION');
const packageFile = path.join(rootDir, 'package.json');

// Read current version
let currentVersion = '0.0.0';
if (fs.existsSync(versionFile)) {
    currentVersion = fs.readFileSync(versionFile, 'utf8').trim();
} else {
    // Try package.json if VERSION file doesn't exist
    const pkg = require(packageFile);
    currentVersion = pkg.version || '0.0.0';
}

console.log(`Current version: ${currentVersion}`);

// Parse version
const parts = currentVersion.split('.').map(Number);
if (parts.length !== 3) {
    console.error('Invalid version format. Expected X.Y.Z');
    process.exit(1);
}

// Increment patch (Strict sequential)
parts[2]++;

const newVersion = parts.join('.');
console.log(`New version: ${newVersion}`);

// Update VERSION file
fs.writeFileSync(versionFile, newVersion);

// Update package.json
const packageJson = require(packageFile);
packageJson.version = newVersion;
fs.writeFileSync(packageFile, JSON.stringify(packageJson, null, 2));

// Create Release Note
const releaseNoteFile = path.join(rootDir, `RELEASE_NOTES_v${newVersion}.md`);
const date = new Date().toISOString().split('T')[0];
const template = `# Release Notes v${newVersion}
Date: ${date}

## New Features
- [ ] Feature 1
- [ ] Feature 2

## Improvements
- [ ] Improvement 1

## Fixes
- [ ] Fix 1
`;

fs.writeFileSync(releaseNoteFile, template);

console.log(`Successfully updated to version ${newVersion}`);
console.log(`Created release note: ${releaseNoteFile}`);
