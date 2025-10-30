const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const excludeDirs = new Set([
  'node_modules','vendor','logs','whatsapp-session','dist','uploads','backups','.git'
]);

function isExcluded(fullPath) {
  const rel = path.relative(repoRoot, fullPath).split(path.sep);
  return rel.some(segment => excludeDirs.has(segment));
}

function listFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (isExcluded(full)) continue;
    if (entry.isDirectory()) {
      listFiles(full);
    } else if (entry.isFile()) {
      if (/\.(md|txt)$/i.test(entry.name)) tidyFile(full);
    }
  }
}

function tidyFile(filePath) {
  try {
    let raw = fs.readFileSync(filePath, 'utf8');
    const original = raw;
    // Normalize newlines to \n for processing
    raw = raw.replace(/\r\n?/g, '\n');
    // Split lines
    let lines = raw.split('\n');
    // Trim trailing whitespace on each line
    lines = lines.map(l => l.replace(/[\t ]+$/g, ''));
    // Remove trailing empty lines
    while (lines.length > 0 && /^\s*$/.test(lines[lines.length - 1])) {
      lines.pop();
    }
    // Join with \n and ensure single newline at EOF
    let out = lines.join('\n') + '\n';
    if (out !== original) {
      fs.writeFileSync(filePath, out, 'utf8');
      process.stdout.write(`tidy: ${path.relative(repoRoot, filePath)}\n`);
    }
  } catch (e) {
    // Silent skip on binary or unreadable files
  }
}

listFiles(repoRoot);
