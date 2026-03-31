const fs = require('fs');
const path = require('path');

const files = [
    'views/billing/tagihan-print-all.ejs',
    'views/billing/tagihan-print-thermal.ejs',
    'views/billing/tagihan-print.ejs',
    'views/billing/tagihan-print-odc.ejs',
    'views/kasir/receipt.ejs',
    'views/invoice/template-thermal.ejs',
    'views/invoice/template-wireless.ejs',
    'views/billing/tagihan-print-invoice-template.ejs'
];

files.forEach(file => {
    try {
        if (!fs.existsSync(file)) return;
        let content = fs.readFileSync(file, 'utf8');

        // 1. UPDATE CSS for 58mm and Left Padding
        content = content.replace(/@page\s*{[\s\S]*?}/, `@page {
            size: 58mm auto;
            margin: 0;
        }`);

        content = content.replace(/@media print\s*{[\s\S]*?body\s*{[\s\S]*?}/, `@media print {
            body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                width: 58mm;
                margin: 0;
                padding: 0;
            }
        }`);

        content = content.replace(/body\s*{[\s\S]*?font-family:[\s\S]*?}/, `body {
            font-family: 'Arial', 'Helvetica', sans-serif;
            font-size: 8pt;
            line-height: 1.1;
            color: #000;
            width: 56mm;
            max-width: 58mm;
            font-weight: normal;
            padding-left: 2.5mm; /* IMPORTANT: Fix left cutoff */`);

        // 2. REMOVE ID PEL, PERIODE, ALAMAT rows (Regex based on typical structure)
        // Match rows with ID PEL, Periode, Alamat labels
        content = content.replace(/<div class="row">[\s\S]*?<span class="lbl">ID PEL<\/span>[\s\S]*?<\/div>/g, '');
        content = content.replace(/<div class="row">[\s\S]*?<span class="lbl">Periode<\/span>[\s\S]*?<\/div>/g, '');
        content = content.replace(/<% if \(invoice\.customer_address\) { %>[\s\S]*?Alamat[\s\S]*?<% } %>/g, '');
        content = content.replace(/<div class="row">[\s\S]*?<span class="lbl">Alamat<\/span>[\s\S]*?<\/div>/g, '');

        // 3. REMOVE Section Titles
        content = content.replace(/<div class="section-title">PELANGGAN<\/div>/g, '');
        content = content.replace(/<div class="section-title">RINCIAN TAGIHAN<\/div>/g, '');
        content = content.replace(/<!-- Items -->/g, '');

        // 4. REMOVE Area references (to address "Area masih saja muncul")
        content = content.replace(/<% if \(invoice\.odc_name\) { %>[\s\S]*?Area[\s\S]*?<% } %>/g, '');
        content = content.replace(/Area: <%= invoice\.odc_name %>/, '');
        content = content.replace(/Area: <%= odc\.name %>/, '');

        // 5. REMOVE QR CODE and FOOTER TEXT
        content = content.replace(/<!-- QR Code -->[\s\S]*?<div class="footer">[\s\S]*?<\/div>/g, '<div class="footer"></div>');
        content = content.replace(/\*\*\* TERIMA KASIH \*\*\*/g, '');

        fs.writeFileSync(file, content);
        console.log(`Processed ${file}`);
    } catch (e) {
        console.log(`Error processing ${file}: ${e.message}`);
    }
});
