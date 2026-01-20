#!/usr/bin/env node
/**
 * MikroTik Queue Fix Patch
 * Automatically fixes queue type issues in the application
 */

const fs = require('fs');
const path = require('path');

// Queue type mappings to fix
const QUEUE_FIXES = {
    'pcq-download-default': 'pcq',
    'pcq-upload-default': 'pcq', 
    'pcq-default': 'pcq',
    'ethernet-default': 'ethernet',
    'wireless-default': 'wireless'
};

console.log('🔍 Scanning for queue type issues...');

// Function to scan and fix files
function scanAndFix(directory) {
    const files = fs.readdirSync(directory);
    
    files.forEach(file => {
        const filePath = path.join(directory, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            // Skip node_modules and dist folders
            if (!['node_modules', 'dist', '.git'].includes(file)) {
                scanAndFix(filePath);
            }
        } else if (file.endsWith('.ts') || file.endsWith('.js')) {
            try {
                let content = fs.readFileSync(filePath, 'utf8');
                let modified = false;
                
                // Check for problematic queue types
                Object.entries(QUEUE_FIXES).forEach(([badType, goodType]) => {
                    const regex = new RegExp(`(['"])${badType}(['"])`, 'g');
                    if (regex.test(content)) {
                        content = content.replace(regex, `$1${goodType}$2`);
                        modified = true;
                        console.log(`🔧 Fixed ${badType} -> ${goodType} in ${filePath}`);
                    }
                });
                
                // Also check for queue property assignments
                const queueAssignmentRegex = /(queue\s*:.*?)['"]([^'"]*)['"]/g;
                let match;
                while ((match = queueAssignmentRegex.exec(content)) !== null) {
                    const fullMatch = match[0];
                    const queueValue = match[2];
                    
                    if (QUEUE_FIXES[queueValue]) {
                        const newValue = QUEUE_FIXES[queueValue];
                        const fixedMatch = fullMatch.replace(queueValue, newValue);
                        content = content.replace(fullMatch, fixedMatch);
                        modified = true;
                        console.log(`🔧 Fixed queue assignment ${queueValue} -> ${newValue} in ${filePath}`);
                    }
                }
                
                if (modified) {
                    fs.writeFileSync(filePath, content, 'utf8');
                    console.log(`✅ Updated ${filePath}`);
                }
                
            } catch (error) {
                // Skip files that can't be read/written
                console.log(`⚠️  Skipped ${filePath}: ${error.message}`);
            }
        }
    });
}

// Run the fix
try {
    console.log('🚀 Starting queue type fix...');
    scanAndFix(path.join(__dirname, 'src'));
    console.log('🎉 Queue type fix completed!');
    console.log('\n📝 Summary of changes:');
    Object.entries(QUEUE_FIXES).forEach(([from, to]) => {
        console.log(`  • ${from} → ${to}`);
    });
    console.log('\n💡 Next steps:');
    console.log('  1. Test the application to verify queue creation works');
    console.log('  2. Check MikroTik to confirm queues are created correctly');
    console.log('  3. If issues persist, verify MikroTik connection settings');
} catch (error) {
    console.error('❌ Fix failed:', error.message);
    process.exit(1);
}