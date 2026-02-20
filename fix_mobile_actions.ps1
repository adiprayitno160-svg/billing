$file = "c:\laragon\www\billing\views\billing\tagihan.ejs"
$content = [System.IO.File]::ReadAllText($file)
$lines = $content -split "`n"

# Find the action buttons section in mobile layout (lines 449-462 area)
# We want to replace from "flex items-center justify-between" (due date + buttons row) to closing </div> of card
$startIdx = -1
$endIdx = -1

for ($i = 0; $i -lt $lines.Length; $i++) {
    # Find the due date + actions row (after the amount/status row)
    if ($lines[$i] -match 'flex items-center justify-between' -and $startIdx -eq -1 -and $i -gt 440 -and $i -lt 470) {
        # Check previous line has closing </div> from amount section
        if ($lines[$i - 1].Trim() -eq '</div>') {
            $startIdx = $i
            Write-Host "Found action row start at line $($i+1): $($lines[$i].Trim().Substring(0, [Math]::Min(60, $lines[$i].Trim().Length)))"
        }
    }
    # Find closing </div> of the card
    if ($startIdx -ge 0 -and $i -gt $startIdx -and $lines[$i].Trim() -eq '</div>' -and $lines[$i + 1].Trim() -eq '</div>') {
        $endIdx = $i + 1  # Include the card closing div
        Write-Host "Found card end at line $($i+2)"
        break
    }
}

if ($startIdx -ge 0 -and $endIdx -ge 0) {
    Write-Host "Replacing lines $($startIdx+1) to $($endIdx+1)"

    $newBlock = @'
                        <div class="flex items-center justify-between mb-3">
                            <div class="flex flex-col">
                                <span class="text-[8px] font-black text-slate-400 uppercase">Jatuh Tempo</span>
                                <span class="text-[11px] font-bold text-slate-700"><%= new Date(invoice.due_date).toLocaleDateString('id-ID') %></span>
                            </div>
                        </div>
                        <div class="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100">
                            <button data-action="detail" data-invoice-id="<%= invoice.id %>" class="flex-1 min-w-0 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all">
                                <i class="fas fa-eye text-[10px]"></i><span class="text-[9px] font-bold">Detail</span>
                            </button>
                            <% if (invoice.status !=='paid') { %>
                            <button data-action="pay" data-invoice-id="<%= invoice.id %>" class="flex-1 min-w-0 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all">
                                <i class="fas fa-wallet text-[10px]"></i><span class="text-[9px] font-bold">Bayar</span>
                            </button>
                            <% } %>
                            <button data-action="print" data-invoice-id="<%= invoice.id %>" class="flex-1 min-w-0 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all">
                                <i class="fas fa-print text-[10px]"></i><span class="text-[9px] font-bold">Print</span>
                            </button>
                            <button data-action="send-wanew" data-invoice-id="<%= invoice.id %>" class="flex-1 min-w-0 h-9 rounded-xl bg-green-50 text-green-600 flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all">
                                <i class="fab fa-whatsapp text-[10px]"></i><span class="text-[9px] font-bold">WA</span>
                            </button>
                            <% if (invoice.customer_is_isolated) { %>
                            <button data-action="restore" data-customer-id="<%= invoice.customer_id %>" data-customer-name="<%= invoice.customer_name %>" class="flex-1 min-w-0 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all">
                                <i class="fas fa-unlock text-[10px]"></i><span class="text-[9px] font-bold">Buka</span>
                            </button>
                            <% } else { %>
                            <button data-action="isolate" data-customer-id="<%= invoice.customer_id %>" data-customer-name="<%= invoice.customer_name %>" class="flex-1 min-w-0 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all">
                                <i class="fas fa-lock text-[10px]"></i><span class="text-[9px] font-bold">Isolir</span>
                            </button>
                            <% } %>
                            <button data-action="delete" data-invoice-id="<%= invoice.id %>" class="flex-1 min-w-0 h-9 rounded-xl bg-red-50 text-red-500 flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all">
                                <i class="fas fa-trash text-[10px]"></i><span class="text-[9px] font-bold">Hapus</span>
                            </button>
                        </div>
                    </div>
'@

    $newLines = @()
    if ($startIdx -gt 0) {
        $newLines += $lines[0..($startIdx - 1)]
    }
    $newLines += $newBlock -split "`n"
    if ($endIdx -lt ($lines.Length - 1)) {
        $newLines += $lines[($endIdx + 1)..($lines.Length - 1)]
    }

    $newContent = $newLines -join "`n"
    [System.IO.File]::WriteAllText($file, $newContent)
    Write-Host "SUCCESS: Mobile action buttons replaced!"
}
else {
    Write-Host "FAILED: startIdx=$startIdx endIdx=$endIdx"
    Write-Host "Trying alternative approach..."
    
    # Alternative: search for the ellipsis-v button line
    for ($i = 440; $i -lt 470; $i++) {
        if ($lines[$i] -match 'ellipsis-v') {
            Write-Host "Found ellipsis at line $($i+1)"
        }
        if ($lines[$i] -match 'Jatuh Tempo') {
            Write-Host "Found Jatuh Tempo at line $($i+1)"
        }
    }
}
