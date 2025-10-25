# ✅ Perbaikan Akses Print Thermal Kasir - SELESAI

## 🔒 Masalah

Ketika kasir mencoba print thermal dari halaman `/kasir/print-group`, mendapat error **"Akses Ditolak"** karena:

1. Link print mengarah ke `/billing/tagihan/print-*` 
2. Route billing mungkin memerlukan auth berbeda atau tidak accessible oleh kasir
3. Kasir seharusnya punya route print sendiri yang sudah ter-protect oleh kasir auth middleware

## ✅ Solusi

### 1. Tambahkan Route Print di Kasir Routes
**File:** `src/routes/kasir.ts`

Menambahkan 2 route baru yang berfungsi sebagai proxy dengan auth kasir:

```typescript
// Print ODC dengan auth kasir
GET /kasir/print-odc/:odc_id?format=thermal|a4

// Print All dengan auth kasir  
GET /kasir/print-all?format=thermal|a4
```

**Fitur:**
- ✅ Protected by kasir auth middleware
- ✅ Support thermal (58mm) dan A4 format
- ✅ Filter invoices (hanya status: sent, partial, overdue)
- ✅ Query parameter: period, format
- ✅ Render view yang sama dengan billing routes

### 2. Update View Print Group
**File:** `views/kasir/print-group.ejs`

Mengganti semua link dari `/billing/tagihan/print-*` menjadi `/kasir/print-*`:

**Before:**
```html
<a href="/billing/tagihan/print-all?format=thermal">
<a href="/billing/tagihan/print-odc/{id}?format=thermal">
```

**After:**
```html
<a href="/kasir/print-all?format=thermal">
<a href="/kasir/print-odc/{id}?format=thermal">
```

### 3. Buat View A4 Format
**Files Created:**
- `views/billing/tagihan-print-odc-a4.ejs` - Print ODC format A4
- `views/billing/tagihan-print-all-a4.ejs` - Print All format A4

**Features A4 View:**
- ✅ Layout A4 dengan margin proper
- ✅ Header dengan info ODC/Summary
- ✅ Table dengan borders
- ✅ Grouped by ODC untuk print-all
- ✅ Grand total calculation
- ✅ Print button
- ✅ Professional styling

### 4. Update Billing Routes (Bonus)
**File:** `src/routes/billing.ts`

Menambahkan support format parameter di billing routes juga:
- ✅ `/billing/tagihan/print-odc/:id?format=thermal|a4`
- ✅ `/billing/tagihan/print-all?format=thermal|a4`

## 📊 Route Structure

### Kasir Routes (Protected by Kasir Auth)
```
GET /kasir/print-group                  → Halaman pilih ODC
GET /kasir/print-odc/:id?format=thermal → Print thermal per ODC
GET /kasir/print-odc/:id?format=a4      → Print A4 per ODC
GET /kasir/print-all?format=thermal     → Print thermal semua
GET /kasir/print-all?format=a4          → Print A4 semua
```

### Billing Routes (Public/Admin)
```
GET /billing/tagihan/print-odc/:id?format=thermal
GET /billing/tagihan/print-odc/:id?format=a4
GET /billing/tagihan/print-all?format=thermal
GET /billing/tagihan/print-all?format=a4
```

## 🔧 Technical Details

### Query Filters
```sql
-- Default filter: hanya pending invoices
WHERE i.status IN ('sent', 'partial', 'overdue')

-- Optional filters:
- period: Filter by invoice period
- odc_id: Filter by ODC
- search: Search customer name/phone/invoice number
- status: Override default status filter
```

### Format Support
- **thermal**: 58mm thermal paper, Courier New font, minimal styling
- **a4**: A4 paper, Arial font, tables with borders, professional layout

### View Selection Logic
```typescript
const viewName = format === 'thermal' 
    ? 'billing/tagihan-print-odc' 
    : 'billing/tagihan-print-odc-a4';
```

## 🧪 Testing Guide

### 1. Test Print All Thermal
```
1. Login sebagai kasir
2. Buka: http://localhost:3001/kasir/print-group
3. Klik "Print Thermal (58mm)" di box "Print Semua Tagihan"
4. ✅ Harus buka window baru dengan format thermal
5. ✅ Klik print atau Ctrl+P untuk print
```

### 2. Test Print All A4
```
1. Di halaman yang sama
2. Klik "Print A4" di box "Print Semua Tagihan"
3. ✅ Harus buka window baru dengan format A4
4. ✅ Terlihat professional dengan table borders
```

### 3. Test Print ODC Thermal
```
1. Pilih ODC dari dropdown
2. Klik "Print Thermal (58mm)"
3. ✅ Harus buka window dengan tagihan ODC tersebut
4. ✅ Format thermal 58mm
```

### 4. Test Print ODC A4
```
1. Pilih ODC dari dropdown
2. Klik "Print A4"
3. ✅ Harus buka window dengan tagihan ODC tersebut
4. ✅ Format A4 dengan table
```

### 5. Test Print dari Card ODC
```
1. Scroll ke "Daftar ODC"
2. Klik tombol "Thermal" atau "A4" di card ODC
3. ✅ Harus langsung print ODC tersebut
4. ✅ Tidak perlu pilih dropdown
```

## 📋 Format Comparison

### Thermal (58mm)
```
- Width: 58mm
- Font: Courier New, 8pt
- Style: Minimal, monospace
- Borders: Dashed lines (-------)
- Best for: Thermal printer
- Page break: Auto by printer
```

### A4 Format
```
- Size: A4 (210mm x 297mm)
- Font: Arial, 10pt
- Style: Professional, borders
- Tables: Full borders with header
- Best for: Laser/Inkjet printer
- Page break: CSS @page
```

## ✅ Checklist Testing

- [x] Print All Thermal berfungsi
- [x] Print All A4 berfungsi
- [x] Print ODC Thermal dari dropdown
- [x] Print ODC A4 dari dropdown
- [x] Print ODC Thermal dari card
- [x] Print ODC A4 dari card
- [x] Tidak ada error "Akses Ditolak"
- [x] Data tagihan muncul dengan benar
- [x] Filter status (pending only) berfungsi
- [x] Statistik di halaman print-group akurat

## 🎯 Benefits

1. **Security**: Route print sekarang protected by kasir auth
2. **Clean URLs**: Kasir punya namespace sendiri `/kasir/*`
3. **Flexibility**: Support 2 format (thermal & A4)
4. **User Friendly**: Langsung klik print tanpa perlu setup
5. **Professional**: A4 format untuk presentation/filing

## 📝 Notes

- Server akan auto-restart (ts-node-dev)
- Thermal format optimal untuk printer thermal 58mm
- A4 format bisa disave as PDF dari print dialog
- Filter default: hanya tagihan pending (sent, partial, overdue)
- Grand total otomatis dihitung
- Grouped by ODC untuk easy reading

## 🚀 Status: COMPLETED ✅

Semua issue akses print thermal sudah diperbaiki dan berfungsi dengan baik!

**Login Test:**
```
URL: http://localhost:3001/kasir/login
Username: kasir
Password: kasir

Then go to: http://localhost:3001/kasir/print-group
```


