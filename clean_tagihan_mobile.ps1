$file = "c:\laragon\www\billing\views\billing\tagihan.ejs"
$content = [System.IO.File]::ReadAllText($file)
$lines = $content -split "`n"

# Cari blok Mobile Layout secara utuh
$startIdx = -1
$endIdx = -1
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match '<!-- Mobile Layout -->') { $startIdx = $i }
    # Cari penutup loop dan div yang sesuai (biasanya setelah forEach dan else block)
    if ($startIdx -ge 0 -and $lines[$i] -match '<!-- Pagination -->') {
        $endIdx = $i - 1
        break
    }
}

if ($startIdx -ge 0 -and $endIdx -ge 0) {
    Write-Host "Replacing mobile layout from line $($startIdx+1) to $($endIdx+1)"

    $newMobile = @'
    <!-- Mobile Layout -->
    <div class="md:hidden space-y-3">
        <% if (invoices && invoices.length > 0) { %>
            <div class="flex items-center justify-between bg-white p-4 rounded-3xl border border-slate-100 shadow-sm mb-2">
                <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pilih Semua</span>
                <input type="checkbox" id="selectAllMobile" class="w-6 h-6 rounded-lg border-slate-300 text-blue-600">
            </div>
            <% invoices.forEach(function(invoice) { %>
                <div class="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm relative overflow-hidden mb-3">
                    <div class="absolute top-3 right-3 z-20">
                        <input type="checkbox" class="invoice-checkbox w-5 h-5 rounded-lg border-slate-300 text-blue-600" value="<%= invoice.id %>">
                    </div>
                    
                    <div class="flex items-center gap-3 mb-3 pr-8">
                        <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400 text-sm flex-shrink-0">
                            <%= invoice.customer_name ? invoice.customer_name.charAt(0) : '?' %>
                        </div>
                        <div class="flex flex-col min-w-0">
                            <span class="text-sm font-black text-slate-800 leading-tight truncate"><%= invoice.customer_name %></span>
                            <span class="text-[10px] font-bold text-slate-400 truncate"><%= invoice.invoice_number %> &bull; <%= invoice.odc_name || 'NO AREA' %></span>
                        </div>
                    </div>

                    <div class="flex items-center justify-between mb-3 bg-slate-50 rounded-xl p-3">
                        <div class="flex flex-col">
                            <span class="text-[8px] font-black text-slate-400 uppercase">Total Tagihan</span>
                            <span class="text-sm font-black text-slate-900">Rp <%= new Intl.NumberFormat('id-ID').format(invoice.total_amount) %></span>
                        </div>
                        <div>
                            <% 
                                let mClass = 'bg-slate-200 text-slate-500'; 
                                let mLabel = invoice.status; 
                                if (invoice.status === 'paid') { mClass = 'bg-emerald-500 text-white'; mLabel = 'LUNAS'; }
                                else if (invoice.status === 'overdue') { mClass = 'bg-rose-500 text-white'; mLabel = 'EXPIRED'; }
                                else if (invoice.status === 'sent') { mClass = 'bg-blue-500 text-white'; mLabel = 'SENT'; }
                                else if (invoice.status === 'partial') { mClass = 'bg-amber-500 text-white'; mLabel = 'PARTIAL'; }
                            %>
                            <span class="text-[9px] font-black px-3 py-1 rounded-full <%= mClass %> uppercase"><%= mLabel %></span>
                        </div>
                    </div>

                    <div class="flex items-center justify-between mb-3">
                        <div class="flex flex-col">
                            <span class="text-[8px] font-black text-slate-400 uppercase">Jatuh Tempo</span>
                            <span class="text-[11px] font-bold text-slate-700"><%= new Date(invoice.due_date).toLocaleDateString('id-ID') %></span>
                        </div>
                    </div>

                    <div class="flex items-center gap-2 flex-wrap pt-3 border-t border-slate-100">
                        <button data-action="detail" data-invoice-id="<%= invoice.id %>" class="flex-1 min-w-[70px] h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all">
                            <i class="fas fa-eye text-[10px]"></i><span class="text-[9px] font-bold">Detail</span>
                        </button>
                        <% if (invoice.status !== 'paid') { %>
                        <button data-action="pay" data-invoice-id="<%= invoice.id %>" class="flex-1 min-w-[70px] h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all">
                            <i class="fas fa-wallet text-[10px]"></i><span class="text-[9px] font-bold">Bayar</span>
                        </button>
                        <% } %>
                        <button data-action="print" data-invoice-id="<%= invoice.id %>" class="flex-1 min-w-[70px] h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all">
                            <i class="fas fa-print text-[10px]"></i><span class="text-[9px] font-bold">Print</span>
                        </button>
                        <button data-action="send-wanew" data-invoice-id="<%= invoice.id %>" class="flex-1 min-w-[70px] h-9 rounded-xl bg-green-50 text-green-600 flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all">
                            <i class="fab fa-whatsapp text-[10px]"></i><span class="text-[9px] font-bold">WA</span>
                        </button>
                        <% if (invoice.customer_is_isolated) { %>
                        <button data-action="restore" data-customer-id="<%= invoice.customer_id %>" data-customer-name="<%= invoice.customer_name %>" class="flex-1 min-w-[70px] h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all">
                            <i class="fas fa-unlock text-[10px]"></i><span class="text-[9px] font-bold">Buka</span>
                        </button>
                        <% } else { %>
                        <button data-action="isolate" data-customer-id="<%= invoice.customer_id %>" data-customer-name="<%= invoice.customer_name %>" class="flex-1 min-w-[70px] h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all">
                            <i class="fas fa-lock text-[10px]"></i><span class="text-[9px] font-bold">Isolir</span>
                        </button>
                        <% } %>
                        <button data-action="delete" data-invoice-id="<%= invoice.id %>" class="flex-1 min-w-[70px] h-9 rounded-xl bg-red-50 text-red-500 flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all">
                            <i class="fas fa-trash text-[10px]"></i><span class="text-[9px] font-bold">Hapus</span>
                        </button>
                    </div>
                </div>
            <% }); %>
        <% } else { %>
            <div class="bg-white p-12 rounded-[2rem] flex flex-col items-center justify-center text-center">
                <div class="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-4">
                    <i class="fas fa-file-invoice text-3xl"></i>
                </div>
                <span class="text-xs font-black text-slate-400 uppercase tracking-widest tracking-tighter">Belum ada tagihan</span>
            </div>
        <% } %>
    </div>
'@

    $newLines = @()
    if ($startIdx -gt 0) { $newLines += $lines[0..($startIdx - 1)] }
    $newLines += $newMobile -split "`n"
    if ($endIdx -lt ($lines.Length - 1)) { $newLines += $lines[$endIdx..($lines.Length - 1)] }
    
    $newContent = $newLines -join "`n"
    [System.IO.File]::WriteAllText($file, $newContent)
    Write-Host "SUCCESS: Mobile layout cleaned up!"
}
else {
    Write-Host "FAILED: Could not find layout blocks"
}
