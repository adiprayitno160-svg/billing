
const fs = require('fs');
const path = 'c:/laragon/www/billing/src/services/billing/invoiceService.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Add loyalty_discount to subscription query
content = content.replace(/c\.custom_isolate_days_after_deadline/, function(match) {
    return `${match}, c.loyalty_discount`;
});

// 2. Add loyalty_discount to calculation in generateMonthlyInvoices (subscriptions)
content = content.replace(/const totalAmount = Math\.max\(0, baseSubtotal \+ deviceFee \+ ppnAmount \+ carryOverAmount - totalDiscount\);/, function(match) {
    return `const loyaltyDiscount = parseFloat(subscription.loyalty_discount || 0);\n                    const totalAmount = Math.max(0, baseSubtotal + deviceFee + ppnAmount + carryOverAmount - totalDiscount - loyaltyDiscount);`;
});

// 3. Add loyalty_discount to fallback customer query
content = content.replace(/SELECT c\.id as customer_id, c\.name as customer_name, c\.email, c\.phone, c\.account_balance,/, function(match) {
    return `SELECT c.id as customer_id, c.loyalty_discount, c.name as customer_name, c.email, c.phone, c.account_balance,`;
});

// 4. Add loyalty_discount to calculation in generateMonthlyInvoices (fallback)
content = content.replace(/const totalAmount = subtotal \+ deviceFee \+ ppnAmount \+ carryOverAmount;/, function(match) {
    return `const loyaltyDiscountFallback = parseFloat(customer.loyalty_discount || 0);\n                    const totalAmount = Math.max(0, subtotal + deviceFee + ppnAmount + carryOverAmount - loyaltyDiscountFallback);`;
});

fs.writeFileSync(path, content);
console.log('InvoiceService.ts updated with loyalty discount calculation during invoice generation');
