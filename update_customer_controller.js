
const fs = require('fs');
const path = 'c:/laragon/www/billing/src/controllers/customerController.ts';
let content = fs.readFileSync(path, 'utf8');

// Add loyalty_discount to destructuring
content = content.replace(/const \{([\s\S]+?)auto_pay_date/m, function(match, p1) {
    return `const {${p1}auto_pay_date, loyalty_discount`;
});

// Add loyalty_discount to update mapping
content = content.replace(/if \(req\.body\.grace_period !== undefined\) \{([\s\S]+?)\}/m, function(match, p1) {
    return `${match}\n            if (loyalty_discount !== undefined) {\n                updateFields.push('loyalty_discount = ?');\n                updateValues.push(Number(loyalty_discount) || 0);\n            }`;
});

fs.writeFileSync(path, content);
console.log('CustomerController.ts updated');
