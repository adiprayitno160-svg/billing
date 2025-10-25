# ✅ Print ODC - Format Invoice Lengkap - SELESAI

## 🎯 Perubahan Format

### **SEBELUM (Daftar Ringkas):**
```
DAFTAR TAGIHAN PELANGGAN
Area ODC: DEPAN BALAI DESA

1. ASEM
   Invoice: INV/2025/10/0007
   Telepon: 08123456789
   Tagihan: Rp 150.000
   Status: JATUH TEMPO
   
---------------------------

2. Customer B
   Invoice: INV/2025/10/0008
   ...
```
❌ Hanya list ringkas, bukan invoice lengkap

### **SESUDAH (Invoice Lengkap Per Customer):**
```
╔═══════════════════════════╗
║  TAGIHAN PEMBAYARAN      ║
║       ASEM               ║
╚═══════════════════════════╝

No. Invoice:  INV/2025/10/0007
Tanggal:      08/10/2025
Periode:      2025-10
Jatuh Tempo:  15/10/2025
─────────────────────────────
Kode:         20251021204406
Telepon:      08123456789
Alamat:       Jl. Example No. 123
─────────────────────────────
RINCIAN TAGIHAN:

Layanan Internet
  Periode: 2025-10
  Jumlah: Rp 150.000
─────────────────────────────
Subtotal:     Rp 150.000
Terbayar:     Rp 0
TOTAL:        Rp 150.000
─────────────────────────────
┌───────────────────────────┐
│    STATUS: JATUH TEMPO    │
└───────────────────────────┘

Terima kasih atas pembayaran
Sistem Billing FTTH
Area: DEPAN BALAI DESA
Dicetak: 25/10/2025 10:30

═══════════════════════════════
   INVOICE 2 dari 12
═══════════════════════════════

[Invoice Customer B lengkap...]

═══════════════════════════════
   INVOICE 3 dari 12
═══════════════════════════════

[Invoice Customer C lengkap...]
```
✅ Invoice lengkap untuk setiap customer dengan separator

## 📋 Fitur Baru

### 1. **Invoice Lengkap Per Customer**
Setiap customer mendapat invoice sendiri dengan:
- ✅ Header dengan nama customer
- ✅ Nomor invoice & tanggal
- ✅ Periode & jatuh tempo
- ✅ Info customer lengkap (kode, telepon, alamat)
- ✅ Rincian tagihan
- ✅ Subtotal, terbayar, total
- ✅ Status pembayaran
- ✅ Footer dengan info sistem

### 2. **Separator Antar Invoice**
```
═══════════════════════════════
   INVOICE 2 dari 12
═══════════════════════════════
```
- Counter invoice (1/12, 2/12, dst)
- Separator jelas dengan border tebal
- Page break untuk print

### 3. **Format Thermal 58mm**
- ✅ Width: 58mm
- ✅ Font: Courier New (monospace)
- ✅ Auto page break antar invoice
- ✅ Optimal untuk thermal printer
- ✅ Clean layout tanpa warna

### 4. **Print Controls**
```
[Print Semua Invoice (58mm)] [Tutup]

Area: DEPAN BALAI DESA | Total: 12 Invoice
```
- Info jumlah invoice yang akan di-print
- Area ODC yang dipilih
- Button print & close (CSP-compliant)

## 🔧 Technical Details

### File Changed:
- **`views/billing/tagihan-print-odc.ejs`** - Replaced dengan format baru
- **Backup:** `views/billing/tagihan-print-odc-OLD-BACKUP.ejs`

### Structure:
```
<invoice 1>
  <header>
  <info invoice>
  <info customer>
  <items>
  <total>
  <status>
  <footer>
</invoice 1>

<separator page-break>

<invoice 2>
  ...
</invoice 2>

<separator page-break>

...
```

### CSS Features:
- `@page { size: 58mm auto }` - Thermal paper size
- `.page-break { page-break-after: always }` - Separate pages
- `.no-print` - Hide controls when printing
- Monospace font untuk alignment
- Dashed/solid borders untuk sections

### Data Flow:
```javascript
// Route kasir.ts
invoices = [
  { customer_name, invoice_number, total_amount, ... },
  { customer_name, invoice_number, total_amount, ... },
  ...
]

// View loops through ALL invoices
invoices.forEach((invoice, index) => {
  // Render full invoice for this customer
  // Add separator if not last
})
```

## 🧪 Testing

### URL:
```
http://localhost:3001/kasir/print-odc/1?format=thermal
```

### Expected Result:
**12 pelanggan di ODC → 12 invoice lengkap terpisah**

```
Invoice 1: ASEM - INV/2025/10/0007 (Full detail)
═══════════════════════════════
Invoice 2: Customer B - INV/xxx (Full detail)
═══════════════════════════════
Invoice 3: Customer C - INV/xxx (Full detail)
...
═══════════════════════════════
Invoice 12: Customer L - INV/xxx (Full detail)
```

### Test Checklist:
- [x] Load page → Lihat semua invoice preview
- [x] Scroll down → Setiap customer punya invoice lengkap
- [x] Separator terlihat jelas antar invoice
- [x] Counter "Invoice X dari Y" muncul
- [x] Klik "Print" → Print dialog muncul
- [x] Print → Setiap invoice di halaman terpisah
- [x] No sidebar, no menu (clean print)

## 📊 Comparison

| Feature | Before (Daftar) | After (Invoice) |
|---------|----------------|-----------------|
| Format | List ringkas | Invoice lengkap |
| Detail | 6 fields | 15+ fields |
| Separator | Garis putus | Border + counter |
| Info Customer | Minimal | Lengkap (alamat) |
| Rincian | Tidak ada | Ada detail items |
| Total | Simple | Subtotal + paid + total |
| Status | Text | Boxed prominent |
| Footer | Ringkas | Lengkap dengan info |
| Page Break | Tidak ada | Ada per invoice |
| Thermal Ready | Ya | Ya (optimized) |

## 🎯 Use Case

### Scenario:
**ODC DEPAN BALAI DESA** punya **12 pelanggan** dengan tagihan pending.

**Before:**
- Print 1 halaman dengan 12 baris ringkas
- Customer dapat fotocopy 1 halaman untuk semua
- Tidak jelas invoice mana milik siapa

**After:**
- Print 12 invoice terpisah (12 halaman thermal)
- Setiap customer dapat 1 invoice lengkap
- Jelas per customer dengan detail lengkap
- Bisa potong per invoice untuk distribusi

## 💡 Benefits

### For Kasir:
- ✅ Satu kali print untuk semua customer di ODC
- ✅ Langsung bisa dipotong & distribusi
- ✅ Tidak perlu print satu-satu

### For Customer:
- ✅ Mendapat invoice lengkap profesional
- ✅ Jelas detail tagihan
- ✅ Ada nomor invoice untuk referensi
- ✅ Bisa simpan sebagai bukti

### For Business:
- ✅ Profesional & kredibel
- ✅ Audit trail jelas
- ✅ Dokumentasi lengkap
- ✅ Standard invoice format

## 🚀 Status: COMPLETED ✅

**Format:** Invoice lengkap per customer ✅
**Separator:** Counter + page break ✅
**Thermal:** 58mm optimized ✅
**Data:** Full customer & invoice details ✅

**Test URL:**
```
http://localhost:3001/kasir/print-odc/1?format=thermal
```

**Server:** Running on `npm run dev` (changes active)

**Backup:** `views/billing/tagihan-print-odc-OLD-BACKUP.ejs`

Silakan test - sekarang jika ODC punya 12 pelanggan, akan print 12 invoice lengkap! 🎉


