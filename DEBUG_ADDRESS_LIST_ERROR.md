# 🔍 DEBUG: Error "Gagal mengambil data dari Mikrotik"

## 🚨 **MASALAH:**

Page `/prepaid/address-list` menampilkan error:
```
Gagal mengambil data dari Mikrotik
```

Padahal Mikrotik sudah terhubung di Settings.

---

## ✅ **FIX SUDAH DIBUAT - BETTER ERROR HANDLING!**

Controller sudah diupdate dengan:
- ✅ Better error logging
- ✅ Detailed error messages
- ✅ Fallback untuk database query
- ✅ Individual try-catch untuk setiap address list
- ✅ Debug info di console logs

---

## 🚀 **CARA FIX (3 LANGKAH):**

### **1. Compile TypeScript:**
```bash
npm run build
```

### **2. Restart Server:**
```bash
pm2 restart billing-system
```

### **3. Check Logs & Test:**
```bash
# Watch logs real-time
pm2 logs billing-system --lines 50

# Di browser lain, buka:
# http://192.168.239.126:3000/prepaid/address-list
```

---

## 📊 **CEK LOGS UNTUK DEBUG:**

Setelah restart, buka page `/prepaid/address-list` lalu cek logs:

```bash
pm2 logs billing-system --lines 50
```

**Logs yang BENAR:**
```
[AddressList] Connecting to Mikrotik: 192.168.1.1
[AddressList] Fetching prepaid-no-package list...
[AddressList] Found 0 entries in prepaid-no-package
[AddressList] Fetching prepaid-active list...
[AddressList] Found 0 entries in prepaid-active
✅ Page loaded successfully
```

**Logs JIKA ADA ERROR:**
```
[AddressList] Connecting to Mikrotik: 192.168.1.1
[AddressList] Fetching prepaid-no-package list...
❌ [AddressList] Error fetching no-package list: Connection timeout
❌ Koneksi Mikrotik error: Connection timeout
```

---

## 🔍 **POSSIBLE ERRORS & SOLUTIONS:**

### **Error 1: "Connection timeout"**

**Penyebab:**
- Mikrotik API tidak enabled
- Firewall block API port
- IP/Port salah

**Solusi:**

**Di Mikrotik Terminal:**
```routeros
# 1. Check API service
/ip service print where name=api

# Expected output:
# name="api" port=8728 disabled=no

# 2. Jika disabled=yes, enable:
/ip service enable api

# 3. Check firewall
/ip firewall filter print where chain=input

# Pastikan tidak ada rule yang block port 8728
```

---

### **Error 2: "Login failed" atau "Authentication error"**

**Penyebab:**
- Username/password salah
- User tidak punya API permission

**Solusi:**

**Di Mikrotik Terminal:**
```routeros
# Check user & group
/user print

# Pastikan user punya group 'full' atau 'api'
# Jika tidak, update:
/user set admin group=full

# Atau buat user khusus API:
/user add name=api_user password=your_password group=full
```

Lalu update di **Settings > Mikrotik** dengan username/password yang benar.

---

### **Error 3: "Cannot connect to host"**

**Penyebab:**
- IP Mikrotik salah
- Network tidak reachable
- Mikrotik offline

**Solusi:**

**Test dari server billing:**
```bash
# Ping Mikrotik
ping 192.168.1.1 -c 5

# Test telnet ke API port
telnet 192.168.1.1 8728
# Atau
nc -zv 192.168.1.1 8728
```

**Expected:**
```
Connection to 192.168.1.1 8728 port [tcp/*] succeeded!
```

Jika gagal:
- Cek IP Mikrotik benar
- Cek network routing
- Cek firewall di server billing

---

### **Error 4: "Address list not found"**

**Penyebab:**
- Address list `prepaid-no-package` atau `prepaid-active` belum dibuat

**Solusi:**

**TIDAK PERLU MANUAL!** 

Address list otomatis dibuat saat:
1. Setup Mikrotik via One-Click Setup
2. Atau saat customer di-migrasi ke prepaid
3. Atau saat paket di-aktivasi

**Tapi jika mau manual create:**
```routeros
# Di Mikrotik Terminal:
/ip firewall address-list add list=prepaid-no-package address=0.0.0.0 comment="Dummy entry"
/ip firewall address-list add list=prepaid-active address=0.0.0.0 comment="Dummy entry"
```

---

## 🧪 **TESTING:**

### **Test 1: Check Mikrotik API dari Command Line**

Install `node-routeros` test:

```bash
# Buat file test-mikrotik-api.js
cat > test-mikrotik-api.js << 'EOF'
const RouterOSAPI = require('node-routeros').RouterOSAPI;

async function test() {
  const api = new RouterOSAPI({
    host: '192.168.1.1',      // ← Ganti dengan IP Mikrotik Anda
    port: 8728,
    user: 'admin',            // ← Ganti dengan username Mikrotik
    password: 'your_password', // ← Ganti dengan password Mikrotik
    timeout: 10000
  });

  try {
    console.log('🔌 Connecting to Mikrotik...');
    await api.connect();
    console.log('✅ Connected!');

    console.log('📋 Getting address-list...');
    const list = await api.write('/ip/firewall/address-list/print', ['?list=prepaid-no-package']);
    console.log('✅ Result:', list);

    api.close();
    console.log('✅ Test SUCCESS!');
  } catch (error) {
    console.error('❌ Test FAILED:', error.message);
  }
}

test();
EOF

# Run test
node test-mikrotik-api.js
```

**Expected output:**
```
🔌 Connecting to Mikrotik...
✅ Connected!
📋 Getting address-list...
✅ Result: []
✅ Test SUCCESS!
```

---

### **Test 2: Check dari Browser**

1. Compile & restart server
2. Buka: `http://192.168.239.126:3000/prepaid/address-list`
3. Seharusnya tampil:

```
✅ Mikrotik Connection
   Host: 192.168.1.1 | Port: 8728

prepaid-no-package (0 IPs)
[Tidak ada IP dalam list ini]

prepaid-active (0 IPs)
[Tidak ada IP dalam list ini]
```

---

## 📋 **CHECKLIST DEBUG:**

- [ ] TypeScript compiled: `npm run build`
- [ ] Server restarted: `pm2 restart billing-system`
- [ ] Mikrotik API enabled: `/ip service print`
- [ ] Firewall tidak block port 8728
- [ ] Username/password Mikrotik benar
- [ ] Network reachable: `ping 192.168.1.1`
- [ ] Telnet test berhasil: `telnet 192.168.1.1 8728`
- [ ] Check logs: `pm2 logs billing-system`
- [ ] Test page: `/prepaid/address-list`

---

## 🚀 **QUICK FIX SCRIPT:**

```bash
#!/bin/bash
# Quick fix untuk address-list error

echo "🔧 Fixing address-list page..."

# 1. Compile
echo "1️⃣ Compiling TypeScript..."
npm run build

# 2. Restart
echo "2️⃣ Restarting server..."
pm2 restart billing-system

# 3. Wait
echo "⏳ Waiting 3 seconds..."
sleep 3

# 4. Test Mikrotik connection
echo "3️⃣ Testing Mikrotik connection..."
MIKROTIK_IP="192.168.1.1"  # ← Ganti dengan IP Mikrotik Anda
ping -c 2 $MIKROTIK_IP && echo "✅ Ping OK" || echo "❌ Ping FAILED"

# 5. Show logs
echo "4️⃣ Recent logs:"
pm2 logs billing-system --lines 20 --nostream

echo ""
echo "✅ Done! Now test: http://192.168.239.126:3000/prepaid/address-list"
echo "📊 Watch logs: pm2 logs billing-system"
```

Save sebagai `fix-address-list.sh` dan run:
```bash
chmod +x fix-address-list.sh
./fix-address-list.sh
```

---

## 💡 **COMMON ISSUES:**

### **1. Mikrotik Settings di Database Salah**

Check:
```sql
SELECT * FROM mikrotik_settings;
```

Verify:
- `host` → IP Mikrotik yang benar
- `username` → Username yang benar
- `password` → Password yang benar (encrypted)
- `api_port` → 8728 (default)
- `is_active` → 1

---

### **2. Mikrotik API Tidak Enabled**

Fix:
```routeros
/ip service enable api
/ip service set api port=8728
```

---

### **3. Firewall Block API**

Check:
```routeros
/ip firewall filter print where chain=input and dst-port=8728
```

Jika ada rule yang drop/reject, disable atau adjust.

---

## 🎯 **SETELAH FIX:**

**Error message sekarang lebih detail:**

Sebelum:
```
❌ Gagal mengambil data dari Mikrotik
```

Sesudah:
```
❌ Koneksi Mikrotik error: Connection timeout to 192.168.1.1:8728
```

**Dengan info:**
- IP & Port Mikrotik yang digunakan
- Error message spesifik
- Link ke edit settings

---

## ✅ **COMPILE & RESTART SEKARANG!**

```bash
npm run build
pm2 restart billing-system
pm2 logs billing-system --lines 30
```

**Lalu buka:** `/prepaid/address-list`

**Check logs untuk error detail!** 📊

