# 📊 Speed Profiles Management Guide

## 🎯 **APA ITU SPEED PROFILES?**

**Speed Profiles** = **PPPoE Profiles di Mikrotik** dengan rate-limit untuk manage speed PPPoE customers.

---

## 🔍 **SPEED PROFILES VS ADDRESS LIST:**

| Feature | Speed Profiles | Address List |
|---------|---------------|--------------|
| **Untuk** | PPPoE Customers | Static IP Customers |
| **Lokasi** | Mikrotik PPPoE Profiles | Mikrotik Address List |
| **Speed Control** | Built-in rate-limit | Via Queue/Simple Queue |
| **Assignment** | Auto via profile name | Manual add IP |
| **Use Case** | Profile-based management | IP-based management |

---

## ✅ **SPEED PROFILES = PPPOE ONLY!**

### **Untuk PPPoE Customers:**
✅ Gunakan **Speed Profiles** (page `/prepaid/speed-profiles`)
- Create profile: `prepaid-10mbps`, `prepaid-20mbps`, etc
- Set rate-limit: `10M/10M`, `20M/20M`, etc
- Assign to customer via profile name

### **Untuk Static IP Customers:**
✅ Gunakan **Address List** (page `/prepaid/address-list`)
- Add IP ke `prepaid-active` atau `prepaid-no-package`
- Speed controlled via Simple Queue (manual setup di Mikrotik)

---

## 🚀 **CARA PAKAI SPEED PROFILES:**

### **Step 1: Buka Page**

```
http://192.168.239.126:3000/prepaid/speed-profiles
```

---

### **Step 2: Tambah Profile Baru**

**Form Fields:**
- **Profile Name:** `prepaid-100mbps` (nama profile di Mikrotik)
- **Download Speed:** `100` (dalam Mbps)
- **Upload Speed:** `100` (dalam Mbps)
- **Address List:** `prepaid-active` (optional, untuk firewall grouping)
- **Comment:** `Profile prepaid 100Mbps` (optional)

**Klik:** "Tambah Profile"

---

### **Step 3: Profile Otomatis Dibuat di Mikrotik**

Sistem otomatis create PPPoE profile di Mikrotik:

```routeros
/ppp profile
add name=prepaid-100mbps \
    rate-limit=100M/100M \
    address-list=prepaid-active \
    only-one=yes \
    comment="Profile prepaid 100Mbps"
```

---

### **Step 4: Assign ke Customer**

**Cara 1: Saat Create Paket**

Di page **Paket Prepaid** (`/prepaid/packages`):
- **Nama Paket:** Paket 100Mbps 30 Hari
- **Download:** 100 Mbps
- **Upload:** 100 Mbps
- **Mikrotik Profile Name:** `prepaid-100mbps` ← Link ke speed profile!
- **Harga & Durasi:** Sesuai kebutuhan

**Saat customer beli paket ini, otomatis:**
1. PPPoE profile di-update ke `prepaid-100mbps`
2. Customer disconnect & reconnect
3. Speed berubah jadi 100Mbps!

---

**Cara 2: Manual Update di Mikrotik**

```routeros
# Update PPPoE secret
/ppp secret set [find name=customer_username] profile=prepaid-100mbps

# Disconnect customer (force reconnect)
/ppp active remove [find name=customer_username]
```

---

## 📊 **CONTOH SPEED PROFILES:**

### **Profile 1: No Package (Redirect)**
```
Profile Name: prepaid-no-package
Download: 0.128 Mbps (128 Kbps)
Upload: 0.128 Mbps (128 Kbps)
Address List: prepaid-no-package
Comment: Prepaid without package - redirect to portal
```

**Use Case:** Customer belum beli paket, internet slow, redirect ke portal

---

### **Profile 2: Paket 10Mbps**
```
Profile Name: prepaid-10mbps
Download: 10 Mbps
Upload: 10 Mbps
Address List: prepaid-active
Comment: Prepaid 10Mbps package
```

**Use Case:** Customer beli paket 10Mbps

---

### **Profile 3: Paket 50Mbps**
```
Profile Name: prepaid-50mbps
Download: 50 Mbps
Upload: 50 Mbps
Address List: prepaid-active
Comment: Prepaid 50Mbps package
```

**Use Case:** Customer beli paket premium 50Mbps

---

## 🎨 **UI FEATURES:**

### **1. View All Profiles**
- Table view dengan semua PPPoE profiles dari Mikrotik
- Highlight prepaid profiles (nama mengandung "prepaid")
- Show rate-limit, address-list, comment

### **2. Create Profile**
- Form untuk create profile baru
- Auto-generate rate-limit dari download/upload speed
- Optional address-list & comment

### **3. Edit Profile**
- Modal popup untuk edit existing profile
- Update download/upload speed
- Update address-list & comment
- **Profile name TIDAK BISA diubah!**

### **4. Delete Profile**
- Delete profile dari Mikrotik
- Confirmation dialog
- **Default profiles (default, default-encryption) TIDAK BISA dihapus!**

---

## ⚠️ **IMPORTANT NOTES:**

### **1. Profile Name Convention**

**Recommended format:**
```
prepaid-{speed}mbps
```

**Examples:**
- `prepaid-10mbps`
- `prepaid-20mbps`
- `prepaid-50mbps`
- `prepaid-100mbps`
- `prepaid-no-package`

---

### **2. Rate-Limit Format**

System auto-convert:
- **Input:** Download: 10, Upload: 10
- **Output:** Rate-limit: `10M/10M`

Format di Mikrotik: `{upload}M/{download}M`

---

### **3. Address List**

**Optional tapi recommended:**
- `prepaid-active` - untuk customer dengan paket aktif
- `prepaid-no-package` - untuk customer tanpa paket

**Gunanya:**
- Firewall filter rules berdasarkan address-list
- NAT redirect untuk prepaid-no-package
- Allow internet untuk prepaid-active

---

### **4. Only One**

Auto-set ke `yes`:
- Customer hanya bisa login 1x concurrent
- Prevent sharing account

---

### **5. Don't Delete Active Profiles!**

**Before delete:**
1. Check apakah ada customer yang pakai profile ini
2. Check di Mikrotik: `/ppp secret print where profile=prepaid-10mbps`
3. Jika ada, migrate customer ke profile lain dulu
4. Baru delete profile

---

## 🧪 **TESTING:**

### **Test 1: Create Profile**

1. Buka `/prepaid/speed-profiles`
2. Fill form:
   - Name: `test-5mbps`
   - Download: 5
   - Upload: 5
   - Address List: prepaid-active
3. Klik "Tambah Profile"
4. **Expected:** Profile muncul di table

**Verify di Mikrotik:**
```routeros
/ppp profile print where name=test-5mbps
```

---

### **Test 2: Edit Profile**

1. Klik icon **Edit** (✏️) di table
2. Ubah speed jadi 10 Mbps
3. Klik "Update Profile"
4. **Expected:** Rate-limit update jadi `10M/10M`

**Verify:**
```routeros
/ppp profile print detail where name=test-5mbps
```

---

### **Test 3: Delete Profile**

1. Klik icon **Delete** (🗑️)
2. Confirm
3. **Expected:** Profile hilang dari table & Mikrotik

**Verify:**
```routeros
/ppp profile print where name=test-5mbps
# Should return: no results
```

---

## 📋 **CHECKLIST SETUP:**

- [ ] Compile TypeScript: `npm run build`
- [ ] Restart server: `pm2 restart billing-system`
- [ ] Buka page: `/prepaid/speed-profiles`
- [ ] Mikrotik connection OK
- [ ] View profiles berhasil
- [ ] Create profile test
- [ ] Edit profile test
- [ ] Delete profile test
- [ ] Link dengan prepaid packages

---

## 🎯 **INTEGRATION DENGAN PREPAID PACKAGES:**

### **Flow:**

1. **Admin create speed profile:** `prepaid-20mbps` (20M/20M)
2. **Admin create prepaid package:**
   - Nama: Paket 20Mbps 30 Hari
   - **Mikrotik Profile Name:** `prepaid-20mbps` ← Link!
   - Harga: Rp 250.000
   - Durasi: 30 hari

3. **Customer beli paket:**
   - Customer login portal
   - Pilih "Paket 20Mbps 30 Hari"
   - Bayar

4. **System auto-activate:**
   - Update PPPoE secret: profile = `prepaid-20mbps`
   - Disconnect customer (force reconnect)
   - Customer reconnect dengan profile baru
   - Speed langsung 20Mbps! ✅

---

## 🚀 **READY TO USE!**

**Compile & restart:**
```bash
npm run build
pm2 restart billing-system
```

**Test:**
```
http://192.168.239.126:3000/prepaid/speed-profiles
```

**Expected:**
- ✅ Page loads
- ✅ Show all PPPoE profiles from Mikrotik
- ✅ Create/Edit/Delete works
- ✅ Integration dengan prepaid packages

**Speed Profiles Management sudah ready! 🎉**

