const fs = require('fs');

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

const newStyle = `    <style>
        @page {
            size: 58mm auto;
            margin: 0;
        }

        @media print {
            body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                width: 58mm;
                margin: 0;
                padding: 0;
            }

            .no-print {
                display: none !important;
            }

            .page-break {
                page-break-after: always;
            }
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 8pt;
            line-height: 1.1;
            color: #000;
            width: 56mm;
            max-width: 58mm;
            font-weight: normal;
            padding-left: 3mm; /* Memberi jarak aman pada sisi kiri printer thermal */
        }
`;

files.forEach(file => {
    try {
        if (!fs.existsSync(file)) return;
        let content = fs.readFileSync(file, 'utf8');

        // Replace entire style block start until first class definition or something
        // OR better, replace from <style> to .receipt or .header or whatever is first
        // Let's use a simpler approach: replace from <style> to just before .receipt / .header
        content = content.replace(/<style>[\s\S]*?(?=\.receipt|\.header|\.sep|\.company)/, newStyle);

        fs.writeFileSync(file, content);
        console.log(`Fixed CSS in ${file}`);
    } catch (e) {
        console.log(`Error in ${file}: ${e.message}`);
    }
});
