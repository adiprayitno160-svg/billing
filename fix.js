const fs = require('fs');
let content = fs.readFileSync('views/billing/tagihan-print-all.ejs', 'utf-8');
const search = `                                                                    <!-- QR Code -->
                                                                    <div style="text-align: center; margin: 2mm 0;">
                                                                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=<%= encodeURIComponent('VERIFIED OK: ' + invoice.invoice_number + ' | ' + invoice.customer_name + ' | ' + invoice.total_amount) %>"
                                                                            style="width: 50px; height: 50px;" alt="QR">
                                                                        <div style="font-size: 5.5pt; margin-top: 1mm;">
                                                                            E-RECEIPT VERIFICATION</div>
                                                                    </div>

                                                                    <div class="footer">
                                                                        *** TERIMA KASIH ***<br>
                                                                        <% if (invoice.odc_name) { %>Area: <%= invoice.odc_name %><br><% } %>
                                                                    </div>`;
// Just use a regex to match it
content = content.replace(/<!-- QR Code -->[\s\S]*?<div class="footer">[\s\S]*?<\/div>/, '<!-- QR removed -->\n                                                                    <div class="footer"></div>');
fs.writeFileSync('views/billing/tagihan-print-all.ejs', content);
console.log("Done");
