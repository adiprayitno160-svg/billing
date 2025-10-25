# ✅ Perbaikan Kasir - Print & Payments - SELESAI

## 🐛 Masalah yang Dilaporkan

### 1. **Payments Page** - Status dan Paket kadang sembunyi
- Field `status` dan `package_name` kadang tidak muncul
- Data customer tidak konsisten

### 2. **Print Group** - NaN di Total Amount
- "Print Semua Tagihan Jumlah: Rp NaN"
- `stats.total_amount` tidak di-parse dengan benar

### 3. **CSP Error** - Inline onclick blocked
```
Content-Security-Policy: The page's settings blocked an event handler (script-src-attr) 
from being executed because it violates the following directive: "script-src-attr 'unsafe-hashes'"

Source: printODC('thermal')
Source: printODC('a4')
```

## 🔧 Solusi yang Diterapkan

### 1. **Fix Print Group - NaN Issue**

**File:** `views/kasir/print-group.ejs`

**BEFORE:**
```ejs
Rp <%= (stats.total_amount || 0).toLocaleString('id-ID') %>
```

**Problem:** `stats.total_amount` mungkin string atau undefined, `toLocaleString()` gagal.

**AFTER:**
```ejs
Rp <%= new Intl.NumberFormat('id-ID').format(parseFloat(stats.total_amount) || 0) %>
```

**Fix:**
- ✅ Gunakan `parseFloat()` untuk convert ke number
- ✅ Fallback ke 0 jika undefined/NaN
- ✅ Gunakan `Intl.NumberFormat` untuk format yang aman

### 2. **Fix CSP Error - Print Group**

**File:** `views/kasir/print-group.ejs`

**BEFORE:**
```html
<button onclick="printODC('thermal')">Print Thermal</button>
<button onclick="printODC('a4')">Print A4</button>
```

**Problem:** Inline `onclick` handler melanggar CSP policy.

**AFTER:**
```html
<button id="btnPrintThermal">Print Thermal</button>
<button id="btnPrintA4">Print A4</button>

<script>
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('btnPrintThermal').addEventListener('click', function() {
        printODC('thermal');
    });
    
    document.getElementById('btnPrintA4').addEventListener('click', function() {
        printODC('a4');
    });
});
</script>
```

**Fix:**
- ✅ Hapus inline `onclick` handler
- ✅ Gunakan `addEventListener()` yang CSP-compliant
- ✅ Wrap dalam `DOMContentLoaded` untuk ensure DOM ready

### 3. **Fix CSP Error - Payments Page**

**File:** `views/kasir/payments.ejs`

**BEFORE:**
```html
<tr onclick='selectCustomerFromTable(<%= JSON.stringify(customer) %>)'>
```

**Problem:** Inline `onclick` handler melanggar CSP policy.

**AFTER:**
```html
<tr class="customer-row" data-customer='<%= JSON.stringify(customer) %>'>

<script>
document.addEventListener('DOMContentLoaded', function() {
    const customerRows = document.querySelectorAll('.customer-row');
    customerRows.forEach(row => {
        row.addEventListener('click', function() {
            const customerData = this.getAttribute('data-customer');
            if (customerData) {
                try {
                    const customer = JSON.parse(customerData);
                    selectCustomerFromTable(customer);
                } catch (e) {
                    console.error('Error parsing customer data:', e);
                }
            }
        });
    });
});
</script>
```

**Fix:**
- ✅ Gunakan `data-customer` attribute untuk store data
- ✅ Gunakan `addEventListener()` untuk handle click
- ✅ Wrap dalam `try-catch` untuk error handling
- ✅ Query selector untuk attach ke semua rows

### 4. **Fix Status Kadang Sembunyi**

**File:** `views/kasir/payments.ejs`

**BEFORE:**
```ejs
<% if (customer.is_isolated) { %>
    <span>Isolir</span>
<% } else { %>
    <span>Aktif</span>
<% } %>
```

**Problem:** Jika `customer.is_isolated` undefined, logic tidak konsisten.

**AFTER:**
```ejs
<% 
const customerStatus = customer.status || 'active';
const isIsolated = customer.is_isolated || customerStatus === 'isolated';
%>
<% if (isIsolated) { %>
    <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
        <i class="fas fa-ban mr-1"></i>Isolir
    </span>
<% } else { %>
    <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <i class="fas fa-check-circle mr-1"></i>Aktif
    </span>
<% } %>
```

**Fix:**
- ✅ Set default value: `customer.status || 'active'`
- ✅ Check both `is_isolated` field dan `status === 'isolated'`
- ✅ Pastikan badge selalu tampil (Isolir atau Aktif)
- ✅ Consistent styling dengan class Tailwind

### 5. **Bonus - Package Name Always Show**

**BEFORE:**
```ejs
<%= customer.package_name %>
```

**Problem:** Blank jika undefined.

**AFTER:**
```ejs
<%= customer.package_name || '-' %>
```

**Fix:**
- ✅ Fallback ke `-` jika tidak ada package

## 📋 Files Updated

1. ✅ `views/kasir/print-group.ejs`
   - Fixed NaN issue with parseFloat
   - Removed inline onclick (CSP fix)
   - Added event listeners

2. ✅ `views/kasir/payments.ejs`
   - Removed inline onclick (CSP fix)
   - Added event listeners for customer rows
   - Fixed status logic with defaults
   - Ensured package_name always shows

## 🧪 Testing

### Test Print Group:
```
http://localhost:3001/kasir/print-group
```

**Checklist:**
- [x] Total Amount tidak lagi NaN
- [x] Print Thermal button berfungsi (no CSP error)
- [x] Print A4 button berfungsi (no CSP error)
- [x] Dropdown ODC pilih → Print → Open tab baru
- [x] Format currency: Rp 150.000 (not NaN)

### Test Payments:
```
http://localhost:3001/kasir/payments
```

**Checklist:**
- [x] Tabel customer tampil semua kolom
- [x] Status selalu tampil (Aktif/Isolir)
- [x] Package name tampil atau `-`
- [x] Klik baris customer → Fill form (no CSP error)
- [x] Search customer berfungsi

### Test CSP Console:
1. Buka Developer Tools → Console
2. Cek tidak ada error CSP
3. Test semua button dan click interaction

**Expected:** ✅ No CSP errors

## 🔍 Technical Details

### CSP Policy Issue:
```
Content-Security-Policy: script-src-attr 'unsafe-hashes'
```

**Problem:** Inline event handlers (onclick, onload, dll) diblock karena security policy.

**Solution:** 
- Hapus semua inline handlers
- Gunakan `addEventListener()` dalam `<script>` tag
- Data pass via `data-*` attributes, bukan function parameters

### Number Formatting:
```javascript
// BAD - Can fail with string or undefined
(value).toLocaleString('id-ID')

// GOOD - Always works
new Intl.NumberFormat('id-ID').format(parseFloat(value) || 0)
```

### Event Delegation Pattern:
```javascript
// Wait for DOM ready
document.addEventListener('DOMContentLoaded', function() {
    // Query all elements
    const elements = document.querySelectorAll('.customer-row');
    
    // Attach listeners
    elements.forEach(element => {
        element.addEventListener('click', function() {
            // Handle click
        });
    });
});
```

## 🎯 Benefits

### Security:
- ✅ CSP-compliant code
- ✅ No inline event handlers
- ✅ Safer against XSS attacks

### Reliability:
- ✅ No more NaN values
- ✅ Consistent status display
- ✅ Proper error handling

### User Experience:
- ✅ All buttons work without CSP warnings
- ✅ Consistent data display
- ✅ Smooth interactions

## 🚀 Status: COMPLETED ✅

Semua masalah telah diperbaiki:
- ✅ Print Group: NaN → Proper currency format
- ✅ Print Group: CSP error → Event listeners
- ✅ Payments: CSP error → Event listeners
- ✅ Payments: Status kadang sembunyi → Always visible
- ✅ Payments: Package name → Fallback to `-`

**Test URLs:**
```
Login: http://localhost:3001/kasir/login (kasir/kasir)
Print Group: http://localhost:3001/kasir/print-group
Payments: http://localhost:3001/kasir/payments
```

**Server:** Running on `npm run dev` (auto-reload active)


