const fs = require('fs');
const path = 'c:/laragon/www/billing/views/partials/sidebar.ejs';

try {
    const data = fs.readFileSync(path, 'utf8');
    const lines = data.split(/\r?\n/);

    // Verify start line
    const startLineIndex = 584 - 1; // 1-based to 0-based
    const endLineIndex = 712 - 1;   // 1-based to 0-based

    console.log(`Line ${startLineIndex + 1}: ${lines[startLineIndex]}`);
    console.log(`Line ${endLineIndex + 1}: ${lines[endLineIndex]}`);
    console.log(`Line ${endLineIndex + 2}: ${lines[endLineIndex + 1]}`); // Should be the arrow svg

    if (lines[startLineIndex].trim() === '<!-- Monitoring Section (Moved) -->' &&
        lines[endLineIndex + 1].includes('accounting-arrow')) {

        console.log('Target found. Removing lines...');

        // Remove lines from startLineIndex to endLineIndex (inclusive)
        lines.splice(startLineIndex, (endLineIndex - startLineIndex + 1));

        fs.writeFileSync(path, lines.join('\n'), 'utf8');
        console.log('File updated successfully.');
    } else {
        console.error('Validation failed. Lines do not match expected content.');
        console.log('Expected Start: <!-- Monitoring Section (Moved) -->');
        console.log('Actual Start:', lines[startLineIndex]);
        console.log('Expected Next after End: ...accounting-arrow...');
        console.log('Actual Next after End:', lines[endLineIndex + 1]);
    }

} catch (e) {
    console.error('Error:', e);
}
