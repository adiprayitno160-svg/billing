
const fs = require('fs');
const path = 'c:/laragon/www/billing/src/controllers/kasirController.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Add loyalty_discount to customer query in processPaymentTransaction
content = content.replace(/SELECT\s+id,\s+customer_code,\s+name,\s+phone,\s+email,\s+address,/, function(match) {
    return `SELECT id, loyalty_discount, customer_code, name, phone, email, address,`;
});

// 2. Add Loyalty Bonus logic inside processPaymentTransaction invoice loop
const insertAfter = `const invoiceRemaining = parseFloat(invoice.remaining_amount || invoice.total_amount);`;
const bonusCode = `
                // --- Apply Loyalty Bonus (Discount) ---
                const loyaltyDiscount = parseFloat(customer.loyalty_discount || 0);
                if (loyaltyDiscount > 0 && invoiceRemaining > 0 && paymentType !== 'debt') {
                    const discountToApply = Math.min(loyaltyDiscount, invoiceRemaining);
                    console.log(\`[KasirController] Applying loyalty bonus of \${discountToApply} to invoice \${invoice.invoice_number}\`);
                    
                    // Insert 'discount' payment record
                    await conn.query(\`
                        INSERT INTO payments (invoice_id, payment_method, amount, payment_date, gateway_status, notes, created_by, created_at)
                        VALUES (?, 'loyalty_bonus', ?, NOW(), 'completed', ?, ?, NOW())
                    \`, [invoice.id, discountToApply, 'Bonus Loyalitas (Potongan Selamanya)', kasirId]);
                    
                    // Update invoice paid_amount and remaining_amount
                    await conn.query(\`
                        UPDATE invoices SET 
                            paid_amount = paid_amount + ?, 
                            remaining_amount = remaining_amount - ?,
                            status = (CASE WHEN remaining_amount - ? <= 0 THEN 'paid' ELSE 'partial' END),
                            updated_at = NOW()
                        WHERE id = ?
                    \`, [discountToApply, discountToApply, discountToApply, invoice.id]);
                    
                    // Recalculate remaining for subsequent payments (cash/balance)
                    invoice.remaining_amount = invoiceRemaining - discountToApply;
                }
`;

// Note: I'll try to find line 1327: const invoiceRemaining = parseFloat(invoice.remaining_amount || invoice.total_amount);
content = content.replace(insertAfter, insertAfter + bonusCode);

// 3. Update redirect after payment
content = content.replace(/return res\.redirect\(\`\/kasir\/receipt\/\$\{paymentResult\.paymentId\}\`\);/, function(match) {
    return `return res.redirect(\`/kasir/payments?success_payment_id=\${paymentResult.paymentId}\`);`;
});

// 4. Update getReceiptData to filter out loyalty_bonus
content = content.replace(/const \[allPayments\] = await conn\.query<RowDataPacket\[\]\>\(\n\s+`SELECT p\.\*, i\.invoice_number, i\.period FROM payments p/, function(match) {
    return match.replace('FROM payments p', "WHERE p.payment_method != 'loyalty_bonus' FROM payments p").replace("WHERE p.payment_method != 'loyalty_bonus' FROM", "FROM");
});
// Re-check filter logic in getReceiptData. Better to filter in EJS or in the query.
// Actually, I'll filter in the query by adding AND payment_method != 'loyalty_bonus'

fs.writeFileSync(path, content);
console.log('KasirController.ts updated with Loyalty Bonus and Redirects');
