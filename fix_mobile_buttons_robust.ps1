$file = "c:\laragon\www\billing\views\billing\tagihan.ejs"
$content = [System.IO.File]::ReadAllText($file)

# 1. Update the buttons to use onclick directly for better mobile reliability
# Re-writing the mobile buttons block with handleTagihanAction call
$newMobileButtons = @'
                    <div class="flex items-center gap-2 flex-wrap pt-3 border-t border-slate-100">
                        <button onclick="handleTagihanAction(this, 'detail', '<%= invoice.id %>')" class="flex-1 min-w-[70px] h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all">
                            <i class="fas fa-eye text-[10px]"></i><span class="text-[9px] font-bold">Detail</span>
                        </button>
                        <% if (invoice.status !== 'paid') { %>
                        <button onclick="handleTagihanAction(this, 'pay', '<%= invoice.id %>')" class="flex-1 min-w-[70px] h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all">
                            <i class="fas fa-wallet text-[10px]"></i><span class="text-[9px] font-bold">Bayar</span>
                        </button>
                        <% } %>
                        <button onclick="handleTagihanAction(this, 'print', '<%= invoice.id %>')" class="flex-1 min-w-[70px] h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all">
                            <i class="fas fa-print text-[10px]"></i><span class="text-[9px] font-bold">Print</span>
                        </button>
                        <button onclick="handleTagihanAction(this, 'send-wanew', '<%= invoice.id %>')" class="flex-1 min-w-[70px] h-9 rounded-xl bg-green-50 text-green-600 flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all">
                            <i class="fab fa-whatsapp text-[10px]"></i><span class="text-[9px] font-bold">WA</span>
                        </button>
                        <% if (invoice.customer_is_isolated) { %>
                        <button onclick="handleTagihanAction(this, 'restore', null, '<%= invoice.customer_id %>', '<%= invoice.customer_name %>')" class="flex-1 min-w-[70px] h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all">
                            <i class="fas fa-unlock text-[10px]"></i><span class="text-[9px] font-bold">Buka</span>
                        </button>
                        <% } else { %>
                        <button onclick="handleTagihanAction(this, 'isolate', null, '<%= invoice.customer_id %>', '<%= invoice.customer_name %>')" class="flex-1 min-w-[70px] h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all">
                            <i class="fas fa-lock text-[10px]"></i><span class="text-[9px] font-bold">Isolir</span>
                        </button>
                        <% } %>
                        <button onclick="handleTagihanAction(this, 'delete', '<%= invoice.id %>')" class="flex-1 min-w-[70px] h-9 rounded-xl bg-red-50 text-red-500 flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all">
                            <i class="fas fa-trash text-[10px]"></i><span class="text-[9px] font-bold">Hapus</span>
                        </button>
                    </div>
'@

# Find the block and replace
# We use a simpler regex for the replacement
$pattern = '(?s)<div class="flex items-center gap-2 flex-wrap pt-3 border-t border-slate-100">.*?<\/div>\s+<\/div>\s+<% \}); %>'
$replacement = "$newMobileButtons`n                    </div>`n                </div>`n            <% }); %>"

if ($content -match $pattern) {
    $content = $content -replace $pattern, $replacement
    Write-Host "Buttons updated to use onclick!"
}
else {
    Write-Host "Could not find buttons pattern!"
}

# 2. Add the handleTagihanAction function to the script block
$scriptFunc = @'
        // Global handler for all actions, especially for mobile
        window.handleTagihanAction = async (btn, action, id, customerId, customerName) => {
            console.log('Action triggered:', action, id, customerId, customerName);
            
            // Prevent multiple clicks
            if (btn && btn.disabled) return;

            switch (action) {
                case 'detail': 
                    location.href = `/billing/tagihan/${id}`; 
                    break;
                case 'pay': 
                    location.href = `/billing/tagihan/${id}/pay`; 
                    break;
                case 'print': 
                    // Direct opening for mobile to avoid popup blocker
                    const printUrl = `/billing/tagihan/${id}/print?format=thermal`;
                    const printWin = window.open(printUrl, '_blank');
                    if (!printWin || printWin.closed || typeof printWin.closed=='undefined') {
                        // If popup blocked, use location.href as fallback
                        location.href = printUrl;
                    }
                    break;
                case 'send-wanew':
                    const ok = await Swal.fire({ 
                        title: 'Kirim WhatsApp?', 
                        text: "Kirim rincian tagihan via WA?", 
                        icon: 'question', 
                        showCancelButton: true,
                        confirmButtonText: 'Ya, Kirim',
                        cancelButtonText: 'Batal'
                    });
                    if (ok.isConfirmed) {
                        if (btn) btn.disabled = true;
                        Swal.fire({ title: 'Mengirim...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                        try {
                            const res = await fetch(`/billing/tagihan/${id}/send-whatsapp`, { method: 'POST' });
                            const data = await res.json();
                            Swal.fire(data.success ? 'Berhasil' : 'Gagal', data.message, data.success ? 'success' : 'error');
                        } catch (e) {
                            Swal.fire('Error', e.message, 'error');
                        } finally {
                            if (btn) btn.disabled = false;
                        }
                    }
                    break;
                case 'isolate':
                case 'restore':
                    const label = action === 'isolate' ? 'Isolir' : 'Pulihkan';
                    const { value: reason } = await Swal.fire({
                        title: `${label} Pelanggan?`,
                        text: `Alasan untuk ${customerName || 'Pelanggan'}:`,
                        input: 'text',
                        inputValue: action === 'isolate' ? 'Tunggakan pembayaran' : 'Sudah bayar',
                        showCancelButton: true
                    });
                    if (reason) {
                        Swal.fire({ title: 'Memproses...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                        const res = await fetch(`/billing/customer/${action}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ customerId, reason })
                        });
                        const d = await res.json();
                        if (d.success) location.reload();
                        else Swal.fire('Gagal', d.message, 'error');
                    }
                    break;
                case 'delete':
                    const del = await Swal.fire({ 
                        title: 'Hapus Tagihan?', 
                        text: 'Data tidak bisa dikembalikan!', 
                        icon: 'warning', 
                        showCancelButton: true,
                        confirmButtonColor: '#d33'
                    });
                    if (del.isConfirmed) {
                        const res = await fetch(`/billing/tagihan/${id}`, { method: 'DELETE' });
                        const d = await res.json();
                        if (d.success) location.reload();
                        else Swal.fire('Gagal', d.message, 'error');
                    }
                    break;
            }
        };
'@

# Inject the function into the start of the <script> block
$scriptPattern = '<script>\s+document.addEventListener\(''DOMContentLoaded'', \(\) => \{'
$replacementScript = "<script>`n" + $scriptFunc + "`n        document.addEventListener('DOMContentLoaded', () => {"
$content = $content -replace $scriptPattern, $replacementScript

[System.IO.File]::WriteAllText($file, $content)
