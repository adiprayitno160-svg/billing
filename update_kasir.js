const fs = require('fs');
let code = fs.readFileSync('src/controllers/kasirController.ts', 'utf8');

// Replace status IN ('sent', 'partial', 'overdue', 'hutang') with status IN ('sent', 'overdue')
code = code.replace(/status IN \('sent', 'partial', 'overdue', 'hutang'\)/g, "status IN ('sent', 'overdue')");

// Replace status IN ('sent', 'partial', 'overdue') with status IN ('sent', 'overdue')
code = code.replace(/status IN \('sent', 'partial', 'overdue'\)/g, "status IN ('sent', 'overdue')");

fs.writeFileSync('src/controllers/kasirController.ts', code);
console.log('kasirController.ts updated');
