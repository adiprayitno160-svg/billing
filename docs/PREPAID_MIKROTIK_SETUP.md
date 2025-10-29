# 🔥 Mikrotik Setup untuk Prepaid Portal System

## 📋 Overview

Dokumentasi ini menjelaskan cara setup Mikrotik untuk sistem prepaid portal dengan **forced redirect** tanpa menggunakan Hotspot. Sistem ini support:

- ✅ **PPPoE** (IP dinamis dengan profile-based control)
- ✅ **Static IP** (IP fixed dengan address-list control)

---

## 🎯 Konsep Sistem

### Alur Kerja

```
Customer Prepaid TANPA Paket
    ↓
PPPoE: Profile "prepaid-no-package" (128k, address-list auto)
Static: IP ditambah ke address-list "prepaid-no-package"
    ↓
Firewall NAT Redirect → Portal Prepaid
    ↓
Firewall Filter Block → Hanya bisa akses portal
    ↓
Customer Login → Beli Paket → Bayar
    ↓
PPPoE: Profile di-update ke "prepaid-20mbps" (full speed)
Static: IP dipindah ke address-list "prepaid-active"
    ↓
Internet AKTIF Penuh! 🎉
```

---

## ⚙️ Step 1: Create PPPoE Profiles (Untuk PPPoE Users)

### Profile 1: Prepaid No Package (Redirect State)

```routeros
/ppp profile
add name="prepaid-no-package" \
    local-address=10.10.10.1 \
    remote-address=pppoe-pool \
    rate-limit=128k/128k \
    address-list=prepaid-no-package \
    dns-server=8.8.8.8,8.8.4.4 \
    only-one=yes \
    comment="Prepaid users without active package - redirect to portal"
```

**Penjelasan:**
- `rate-limit=128k/128k` - Speed sangat lambat, cuma cukup buat buka portal
- `address-list=prepaid-no-package` - **AUTO** masuk address-list saat connect
- `only-one=yes` - Satu user hanya bisa login sekali

### Profile 2-N: Prepaid Active Packages

```routeros
# Paket 10 Mbps
/ppp profile
add name="prepaid-10mbps" \
    local-address=10.10.10.1 \
    remote-address=pppoe-pool \
    rate-limit=10M/10M \
    address-list=prepaid-active \
    dns-server=8.8.8.8,8.8.4.4 \
    only-one=yes \
    comment="Prepaid 10Mbps package"

# Paket 20 Mbps
/ppp profile
add name="prepaid-20mbps" \
    local-address=10.10.10.1 \
    remote-address=pppoe-pool \
    rate-limit=20M/20M \
    address-list=prepaid-active \
    dns-server=8.8.8.8,8.8.4.4 \
    only-one=yes \
    comment="Prepaid 20Mbps package"

# Paket 50 Mbps
/ppp profile
add name="prepaid-50mbps" \
    local-address=10.10.10.1 \
    remote-address=pppoe-pool \
    rate-limit=50M/50M \
    address-list=prepaid-active \
    dns-server=8.8.8.8,8.8.4.4 \
    only-one=yes \
    comment="Prepaid 50Mbps package"
```

**Note:** Buat profile sesuai dengan paket yang dijual di sistem billing.

---

## 🔥 Step 2: Setup Firewall NAT (Redirect Rules)

### NAT Rule 1: Redirect HTTP ke Portal

```routeros
/ip firewall nat
add chain=dstnat \
    src-address-list=prepaid-no-package \
    protocol=tcp \
    dst-port=80 \
    action=dst-nat \
    to-addresses=192.168.1.10 \
    to-ports=3000 \
    comment="Redirect prepaid no-package HTTP to billing portal"
```

**Ganti:**
- `192.168.1.10` - IP server billing Anda
- `3000` - Port server billing

### NAT Rule 2: Redirect HTTPS ke Portal (Optional)

```routeros
/ip firewall nat
add chain=dstnat \
    src-address-list=prepaid-no-package \
    protocol=tcp \
    dst-port=443 \
    action=dst-nat \
    to-addresses=192.168.1.10 \
    to-ports=3000 \
    comment="Redirect prepaid no-package HTTPS to billing portal"
```

**Note:** HTTPS redirect akan ada SSL warning, tapi tetap berfungsi.

---

## 🛡️ Step 3: Setup Firewall Filter (Block Rules)

### Filter Rule 1: Allow DNS

```routeros
/ip firewall filter
add chain=forward \
    src-address-list=prepaid-no-package \
    protocol=udp \
    dst-port=53 \
    action=accept \
    comment="Allow DNS for prepaid no-package" \
    place-before=0
```

### Filter Rule 2: Allow Access to Billing Server

```routeros
/ip firewall filter
add chain=forward \
    src-address-list=prepaid-no-package \
    dst-address=192.168.1.10 \
    action=accept \
    comment="Allow prepaid no-package to access billing portal" \
    place-before=1
```

**Ganti:** `192.168.1.10` dengan IP server billing Anda

### Filter Rule 3: Block All Other Internet

```routeros
/ip firewall filter
add chain=forward \
    src-address-list=prepaid-no-package \
    action=drop \
    comment="Block internet for prepaid without package" \
    place-before=2
```

### Filter Rule 4: Allow Full Internet for Active Prepaid

```routeros
/ip firewall filter
add chain=forward \
    src-address-list=prepaid-active \
    action=accept \
    comment="Allow full internet for prepaid active" \
    place-before=0
```

**Note:** Rule ini harus di posisi **PALING ATAS** (place-before=0)

---

## 📊 Step 4: Verify Configuration

### Check PPPoE Profiles

```routeros
/ppp profile print
```

Expected output:
```
0  default
1  prepaid-no-package    rate-limit=128k/128k  address-list=prepaid-no-package
2  prepaid-10mbps        rate-limit=10M/10M    address-list=prepaid-active
3  prepaid-20mbps        rate-limit=20M/20M    address-list=prepaid-active
```

### Check Address Lists

```routeros
/ip firewall address-list print
```

Expected output (saat ada user aktif):
```
0  prepaid-no-package   10.10.10.50   dynamic
1  prepaid-active       10.10.10.51   dynamic
```

**Note:** Address-list akan terisi otomatis saat user connect PPPoE

### Check NAT Rules

```routeros
/ip firewall nat print
```

### Check Filter Rules

```routeros
/ip firewall filter print where comment~"prepaid"
```

---

## 🧪 Step 5: Testing

### Test 1: PPPoE Customer Without Package

1. Migrate customer ke prepaid di billing system
2. Customer reconnect PPPoE → dapat profile `prepaid-no-package`
3. Check di Mikrotik:
   ```routeros
   /ppp active print detail
   ```
   Harus muncul: `address-list=prepaid-no-package`
4. Customer buka browser → **otomatis redirect ke portal prepaid**
5. Speed test: **harus cuma 128k**

### Test 2: Customer Buy Package

1. Customer login portal → beli paket 20Mbps
2. Billing system update profile → `prepaid-20mbps`
3. Billing system disconnect user (force reconnect)
4. Customer reconnect → dapat profile `prepaid-20mbps`
5. Check di Mikrotik:
   ```routeros
   /ppp active print detail
   ```
   Harus muncul: `address-list=prepaid-active`
6. Speed test: **harus 20Mbps**
7. Internet: **full access, no redirect**

### Test 3: Static IP Customer

1. Add IP manual ke address-list:
   ```routeros
   /ip firewall address-list add list=prepaid-no-package address=192.168.1.100 comment="Test customer"
   ```
2. Dari IP tersebut, buka browser → redirect ke portal
3. Remove dari list:
   ```routeros
   /ip firewall address-list remove [find address=192.168.1.100]
   ```
4. Internet harus langsung normal

---

## 🔧 Troubleshooting

### Problem 1: Redirect tidak berfungsi

**Cek:**
```routeros
/ip firewall nat print where comment~"prepaid"
/ip firewall address-list print where list=prepaid-no-package
```

**Solusi:**
- Pastikan customer ada di address-list `prepaid-no-package`
- Pastikan NAT rule ada dan enabled
- Test dengan disable rule lain yang mungkin conflict

### Problem 2: DNS tidak resolve

**Cek:**
```routeros
/ip firewall filter print where comment~"DNS"
```

**Solusi:**
- Pastikan filter rule untuk DNS (port 53) ada di **ATAS** rule block
- Test: `ping 8.8.8.8` harus bisa dari customer

### Problem 3: Tidak bisa akses portal billing

**Cek:**
```routeros
/ip firewall filter print where dst-address=192.168.1.10
```

**Solusi:**
- Pastikan filter rule allow ke billing server ada
- Test: `ping 192.168.1.10` dari customer
- Cek apakah billing server running di port 3000

### Problem 4: Profile tidak update setelah beli paket

**Cek di Mikrotik:**
```routeros
/ppp secret print where name=username@inet
/ppp active print where name=username@inet
```

**Solusi:**
- Pastikan billing system berhasil update profile
- Manual disconnect user: `/ppp active remove [find name=username@inet]`
- User reconnect otomatis dengan profile baru

---

## 📈 Monitoring & Logs

### Monitor Active PPPoE Connections

```routeros
/ppp active print detail
```

### Monitor Address-List

```routeros
/ip firewall address-list print where list~"prepaid"
```

### Check NAT Statistics

```routeros
/ip firewall nat print stats where comment~"prepaid"
```

### Enable Firewall Logging (Optional)

```routeros
# Log NAT redirect
/ip firewall nat set [find comment="Redirect prepaid no-package HTTP"] log=yes log-prefix="PREPAID-REDIRECT"

# Log blocked traffic
/ip firewall filter set [find comment="Block internet for prepaid"] log=yes log-prefix="PREPAID-BLOCK"

# View logs
/log print where message~"PREPAID"
```

---

## 🚀 Best Practices

### 1. Bandwidth Management
- Set rate-limit di profile PPPoE
- Jangan terlalu pelit dengan `prepaid-no-package` (min 128k)
- Customer butuh speed minimal untuk load portal

### 2. Security
- Gunakan `only-one=yes` di semua profile
- Monitor login attempts: `/log print where topics~"ppp"`
- Set firewall rule di atas untuk protect billing server

### 3. Performance
- Gunakan address-list daripada src-address langsung di firewall
- Address-list lebih cepat untuk banyak user
- Hindari terlalu banyak filter rules

### 4. Backup Configuration
```routeros
/export file=backup-prepaid-config
```

---

## 📝 Configuration Template

### Complete Setup Script

```routeros
# ========================================
# PREPAID PORTAL SYSTEM - COMPLETE SETUP
# ========================================

# Variables (GANTI SESUAI ENVIRONMENT ANDA)
:local billingIP "192.168.1.10"
:local billingPort "3000"
:local poolName "pppoe-pool"
:local localAddress "10.10.10.1"

# ========================================
# 1. CREATE PPPoE PROFILES
# ========================================

/ppp profile
add name="prepaid-no-package" \
    local-address=$localAddress \
    remote-address=$poolName \
    rate-limit=128k/128k \
    address-list=prepaid-no-package \
    dns-server=8.8.8.8,8.8.4.4 \
    only-one=yes \
    comment="Prepaid users without package"

add name="prepaid-10mbps" \
    local-address=$localAddress \
    remote-address=$poolName \
    rate-limit=10M/10M \
    address-list=prepaid-active \
    dns-server=8.8.8.8,8.8.4.4 \
    only-one=yes

add name="prepaid-20mbps" \
    local-address=$localAddress \
    remote-address=$poolName \
    rate-limit=20M/20M \
    address-list=prepaid-active \
    dns-server=8.8.8.8,8.8.4.4 \
    only-one=yes

add name="prepaid-50mbps" \
    local-address=$localAddress \
    remote-address=$poolName \
    rate-limit=50M/50M \
    address-list=prepaid-active \
    dns-server=8.8.8.8,8.8.4.4 \
    only-one=yes

# ========================================
# 2. CREATE NAT REDIRECT RULES
# ========================================

/ip firewall nat
add chain=dstnat \
    src-address-list=prepaid-no-package \
    protocol=tcp dst-port=80 \
    action=dst-nat \
    to-addresses=$billingIP to-ports=$billingPort \
    comment="Redirect prepaid HTTP to portal"

add chain=dstnat \
    src-address-list=prepaid-no-package \
    protocol=tcp dst-port=443 \
    action=dst-nat \
    to-addresses=$billingIP to-ports=$billingPort \
    comment="Redirect prepaid HTTPS to portal"

# ========================================
# 3. CREATE FILTER RULES
# ========================================

/ip firewall filter

# Allow full internet for active prepaid (MUST BE FIRST!)
add chain=forward \
    src-address-list=prepaid-active \
    action=accept \
    comment="Allow full internet for prepaid active" \
    place-before=0

# Allow DNS for no-package prepaid
add chain=forward \
    src-address-list=prepaid-no-package \
    protocol=udp dst-port=53 \
    action=accept \
    comment="Allow DNS for prepaid no-package"

# Allow access to billing portal
add chain=forward \
    src-address-list=prepaid-no-package \
    dst-address=$billingIP \
    action=accept \
    comment="Allow access to billing portal"

# Block all other internet for no-package prepaid
add chain=forward \
    src-address-list=prepaid-no-package \
    action=drop \
    comment="Block internet for prepaid without package"

# ========================================
# DONE!
# ========================================
:put "Prepaid portal system setup completed!"
:put "Billing Server: $billingIP:$billingPort"
```

**Cara pakai:**
1. Copy script ke notepad
2. Edit variabel di bagian atas (billingIP, dll)
3. Copy-paste ke Mikrotik terminal
4. Done!

---

## 🎓 FAQ

### Q: Apakah bisa pakai Hotspot?
**A:** Bisa, tapi tidak perlu. System ini lebih simple dan fleksibel.

### Q: Bagaimana jika customer punya IP static?
**A:** Billing system akan add IP ke address-list `prepaid-no-package` secara manual.

### Q: Apakah user perlu login ulang PPPoE setelah beli paket?
**A:** Ya, billing system akan force disconnect dan user reconnect otomatis (< 5 detik).

### Q: Bagaimana cara rollback ke postpaid?
**A:** Di billing system ada fitur migrate back ke postpaid. Profile akan dikembalikan ke profile postpaid normal.

### Q: Apakah address-list akan penuh jika banyak user?
**A:** Tidak. Address-list dynamic dari PPPoE profile akan otomatis hilang saat user disconnect.

---

## 📞 Support

Jika ada masalah dalam setup:
1. Check log Mikrotik: `/log print`
2. Check billing system logs
3. Test dengan 1 customer dulu sebelum deploy ke semua

---

**✅ Setup Complete!** Sistem prepaid portal dengan forced redirect siap digunakan! 🎉

