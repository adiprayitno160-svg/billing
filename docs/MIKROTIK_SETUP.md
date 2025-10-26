# 🔌 MikroTik Integration Setup

Panduan lengkap integrasi Billing System dengan MikroTik RouterOS.

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Prerequisites](#-prerequisites)
- [MikroTik Configuration](#-mikrotik-configuration)
- [Application Configuration](#-application-configuration)
- [Features](#-features)
- [Testing](#-testing)
- [Troubleshooting](#-troubleshooting)
- [Advanced Configuration](#-advanced-configuration)

---

## 🌟 Overview

Billing System dapat terintegrasi dengan MikroTik RouterOS untuk:

- ✅ **Auto Create PPPoE Secret** - Otomatis buat user saat registrasi
- ✅ **Auto Isolate** - Isolasi pelanggan telat bayar
- ✅ **Auto Unblock** - Unblock otomatis setelah bayar
- ✅ **Bandwidth Monitoring** - Monitor penggunaan bandwidth real-time
- ✅ **Queue Management** - Manajemen queue otomatis
- ✅ **Address List Management** - Kelola address list untuk isolasi

---

## 📋 Prerequisites

### MikroTik Requirements

| Requirement | Minimum | Recommended |
|------------|---------|-------------|
| **RouterOS Version** | 6.40 | 7.x latest |
| **Architecture** | Any | arm64/x86 |
| **License** | Level 4 | Level 5+ |
| **RAM** | 128MB | 256MB+ |
| **API Service** | Enabled | Enabled + SSL |

### Network Access

- Billing server dapat akses MikroTik via IP
- Port 8728 (API) atau 8729 (API-SSL) terbuka
- Username dengan privilege API, write, read

---

## 🔧 MikroTik Configuration

### Step 1: Enable API Service

**Via Winbox:**
```
1. IP → Services
2. Cari "api" atau "api-ssl"
3. Enable service
4. Set port: 8728 (API) atau 8729 (API-SSL)
5. Available From: 0.0.0.0/0 (atau restrict IP billing server)
```

**Via Terminal:**
```bash
# Enable API
/ip service enable api
/ip service set api port=8728

# Enable API-SSL (lebih aman)
/ip service enable api-ssl
/ip service set api-ssl port=8729 certificate=auto

# Check status
/ip service print
```

### Step 2: Create API User

**Buat user khusus untuk API:**

**Via Terminal:**
```bash
# Create user group dengan privilege API
/user group add name=api_group policy=api,read,write,test

# Create user
/user add name=billing_api password=strong_password_here group=api_group

# Verify
/user print detail
```

**Via Winbox:**
```
1. System → Users
2. Klik [+] Add New
3. Name: billing_api
4. Password: strong_password_here
5. Group: full (atau buat custom group)
6. Allowed Address: IP billing server (optional, untuk keamanan)
7. Click OK
```

### Step 3: Create PPPoE Server (Jika Belum Ada)

**Via Terminal:**
```bash
# Add PPPoE server
/interface pppoe-server server
add interface=ether2 service-name=internet disabled=no

# Create IP pool untuk PPPoE
/ip pool add name=pppoe-pool ranges=10.10.10.2-10.10.10.254

# Create PPPoE profile
/ppp profile
add name=pppoe-profile \
    local-address=10.10.10.1 \
    remote-address=pppoe-pool \
    dns-server=8.8.8.8,8.8.4.4 \
    use-compression=yes \
    use-encryption=yes

# Verify
/interface pppoe-server server print
```

### Step 4: Create Queue Tree Structure (Optional)

Untuk bandwidth management:

```bash
# Create parent queue
/queue tree
add name=download parent=global max-limit=100M
add name=upload parent=global max-limit=100M

# Queues akan dibuat otomatis per customer oleh billing system
```

### Step 5: Create Address List for Isolation

```bash
# Create address list untuk isolasi
/ip firewall address-list
add list=isolir comment="Customers yang di-isolir"

# Create firewall filter untuk block internet
/ip firewall filter
add chain=forward src-address-list=isolir action=reject \
    reject-with=icmp-network-unreachable \
    comment="Block Isolir"

# Allow akses ke IP billing (agar bisa login & bayar)
/ip firewall filter
add chain=forward src-address-list=isolir \
    dst-address=192.168.1.100 action=accept \
    place-before=0 \
    comment="Allow akses ke Billing"
```

---

## ⚙️ Application Configuration

### Configure .env

Edit file `.env` di billing system:

```env
# MikroTik Configuration
MIKROTIK_HOST=192.168.1.1
MIKROTIK_PORT=8728
MIKROTIK_USER=billing_api
MIKROTIK_PASSWORD=strong_password_here

# Use SSL (jika menggunakan api-ssl)
MIKROTIK_USE_SSL=false

# PPPoE Profile name
MIKROTIK_PPPOE_PROFILE=pppoe-profile

# Queue Tree parent
MIKROTIK_QUEUE_PARENT=global

# Address list untuk isolasi
MIKROTIK_ISOLIR_LIST=isolir

# Auto sync interval (minutes)
MIKROTIK_SYNC_INTERVAL=5
```

### Test Connection

Setelah konfigurasi, test koneksi:

**Via Billing System UI:**
```
1. Login sebagai admin
2. Menu: Settings → MikroTik
3. Klik "Test Connection"
4. Status harus: ✅ Connected
```

**Via Terminal (Node.js script):**
```bash
cd /var/www/billing
node -e "
const RouterOSAPI = require('node-routeros').RouterOSAPI;
const api = new RouterOSAPI({
    host: '192.168.1.1',
    user: 'billing_api',
    password: 'strong_password_here',
    port: 8728
});
api.connect().then(() => {
    console.log('✅ Connected to MikroTik!');
    api.write('/system/identity/print').then((data) => {
        console.log('Router Identity:', data[0].name);
        api.close();
    });
}).catch(err => {
    console.error('❌ Connection failed:', err.message);
});
"
```

---

## ✨ Features

### 1. Auto Create PPPoE Secret

**Saat registrasi customer baru:**
```
1. Admin input data pelanggan di billing
2. Sistem otomatis create PPPoE secret di MikroTik
3. Username: sesuai input (ex: customer001)
4. Password: auto generate atau manual
5. Profile: sesuai paket (ex: 10Mbps)
6. Comment: ID pelanggan billing
```

**MikroTik Command Yang Dijalankan:**
```bash
/ppp secret add \
    name=customer001 \
    password=rahasia123 \
    service=pppoe \
    profile=10Mbps \
    comment="Billing ID: 123"
```

### 2. Auto Isolate

**Saat tagihan jatuh tempo + grace period:**
```
1. Sistem cek tagihan yang lewat jatuh tempo
2. Add IP customer ke address-list "isolir"
3. Customer tidak bisa akses internet
4. Customer tetap bisa akses billing untuk bayar
```

**MikroTik Command Yang Dijalankan:**
```bash
/ip firewall address-list add \
    list=isolir \
    address=10.10.10.50 \
    comment="customer001 - Telat bayar"
```

### 3. Auto Unblock

**Saat customer bayar:**
```
1. Kasir input pembayaran
2. Status invoice berubah "Paid"
3. Sistem otomatis remove dari address-list "isolir"
4. Customer langsung bisa internet lagi
```

**MikroTik Command Yang Dijalankan:**
```bash
/ip firewall address-list remove [find address=10.10.10.50]
```

### 4. Bandwidth Monitoring

**Real-time monitoring:**
```
1. Dashboard admin menampilkan bandwidth usage
2. Data diambil dari MikroTik via API
3. Update setiap 30 detik
4. Grafik usage per customer
```

**MikroTik Query Yang Dijalankan:**
```bash
/interface monitor-traffic pppoe-customer001 once
# Returns: tx-bits-per-second, rx-bits-per-second
```

### 5. Queue Management

**Auto create/update queue:**
```
1. Sistem baca speed dari paket customer
2. Create/update queue di MikroTik
3. Max-limit sesuai paket
4. Burst enabled (optional)
```

**MikroTik Command Yang Dijalankan:**
```bash
/queue simple add \
    name=customer001 \
    target=10.10.10.50/32 \
    max-limit=10M/10M \
    burst-limit=15M/15M \
    burst-threshold=7M/7M \
    burst-time=30s/30s
```

---

## 🧪 Testing

### Test Checklist

- [ ] **API Connection**
  ```bash
  # Check dari billing system
  curl http://your-billing/api/mikrotik/test
  ```

- [ ] **Create PPPoE Secret**
  ```bash
  # Buat customer baru di billing
  # Check di MikroTik: /ppp secret print
  ```

- [ ] **Isolate Customer**
  ```bash
  # Set invoice ke overdue
  # Check: /ip firewall address-list print
  ```

- [ ] **Unblock Customer**
  ```bash
  # Bayar invoice
  # Check: /ip firewall address-list print
  # IP customer harus hilang dari list
  ```

- [ ] **Bandwidth Monitor**
  ```bash
  # Check dashboard billing
  # Bandwidth usage harus muncul
  ```

---

## 🐛 Troubleshooting

### Connection Failed

**Error:** `Cannot connect to MikroTik`

**Solutions:**
```bash
# 1. Check API service enabled
/ip service print

# 2. Check firewall
/ip firewall filter print

# 3. Test dari billing server
telnet 192.168.1.1 8728

# 4. Check user privileges
/user print detail
```

### Authentication Failed

**Error:** `Login failed`

**Solutions:**
```bash
# 1. Verify username/password
/user print

# 2. Check user group has API access
/user group print

# 3. Check allowed address
/user set billing_api address=0.0.0.0/0
```

### PPPoE Secret Not Created

**Error:** `Failed to create PPPoE secret`

**Solutions:**
```bash
# 1. Check PPPoE server enabled
/interface pppoe-server server print

# 2. Check profile exists
/ppp profile print

# 3. Check user has write permission
/user group print
```

### Customer Not Isolated

**Error:** `Isolasi tidak berfungsi`

**Solutions:**
```bash
# 1. Check address list exists
/ip firewall address-list print where list=isolir

# 2. Check firewall rule exists
/ip firewall filter print

# 3. Check rule order (harus sebelum allow all)
/ip firewall filter move [find comment="Block Isolir"] 0

# 4. Check IP customer benar
/ppp active print
```

### Bandwidth Monitor Not Working

**Solutions:**
```bash
# 1. Check interface name benar
/interface print

# 2. Test manual query
/interface monitor-traffic [interface] once

# 3. Check billing cron job running
pm2 logs billing-system | grep bandwidth
```

---

## 🔒 Security Best Practices

### 1. Use API-SSL

```bash
# Enable API-SSL
/ip service enable api-ssl
/ip service disable api

# Update .env
MIKROTIK_PORT=8729
MIKROTIK_USE_SSL=true
```

### 2. Restrict API Access by IP

```bash
# Only allow billing server
/user set billing_api address=192.168.1.100/32

# Or subnet
/user set billing_api address=192.168.1.0/24
```

### 3. Use Strong Password

```bash
# Generate strong password
openssl rand -base64 24

# Set di MikroTik
/user set billing_api password=generated_password_here
```

### 4. Create Dedicated User Group

```bash
# Create minimal privilege group
/user group add name=billing_api \
    policy=api,read,write,test,!local,!telnet,!ssh,!ftp,!reboot,!password

# Assign to user
/user set billing_api group=billing_api
```

### 5. Enable Audit Log

```bash
# Log all API access
/system logging add topics=api action=memory
/system logging print
```

---

## 🚀 Advanced Configuration

### Multiple MikroTik Support

Untuk manage multiple router:

**Database Schema:**
```sql
CREATE TABLE mikrotik_routers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100),
    host VARCHAR(50),
    port INT DEFAULT 8728,
    username VARCHAR(50),
    password VARCHAR(255),
    location VARCHAR(100),
    status ENUM('active','inactive') DEFAULT 'active'
);
```

**Configuration:**
```env
# Main router
MIKROTIK_HOST=192.168.1.1

# Additional routers akan diambil dari database
```

### Load Balancing

Setup multiple PPPoE servers:

```bash
# Router 1
/interface pppoe-server server add interface=ether2 service-name=internet

# Router 2
/interface pppoe-server server add interface=ether2 service-name=internet

# Billing system will distribute customers evenly
```

### Backup MikroTik Config

```bash
# Auto backup sebelum perubahan
/system backup save name=before-billing-sync

# Download via API
/system backup download filename=before-billing-sync.backup
```

---

## 📊 Performance Optimization

### 1. Cache API Responses

Billing system akan cache:
- Active connections: 30 seconds
- Bandwidth data: 30 seconds
- Static data: 5 minutes

### 2. Batch Operations

Update multiple customers sekaligus:
```javascript
// Batch add to isolir list
const customers = [customer1, customer2, customer3];
await mikrotik.batchAddToAddressList(customers, 'isolir');
```

### 3. Queue Optimization

```bash
# Use simple queue instead of queue tree untuk performa lebih baik
/queue simple
# Faster processing, easier management
```

---

## 📚 API Reference

### Available Functions

```javascript
// Test connection
await mikrotik.testConnection()

// PPPoE Secret
await mikrotik.createPPPoESecret(username, password, profile)
await mikrotik.updatePPPoESecret(username, newPassword)
await mikrotik.deletePPPoESecret(username)
await mikrotik.getPPPoESecrets()

// Active Sessions
await mikrotik.getActiveSessions()
await mikrotik.disconnectSession(username)

// Address List
await mikrotik.addToAddressList(ip, list, comment)
await mikrotik.removeFromAddressList(ip, list)
await mikrotik.getAddressList(list)

// Queue
await mikrotik.createQueue(name, target, maxLimit)
await mikrotik.updateQueue(name, maxLimit)
await mikrotik.deleteQueue(name)

// Monitoring
await mikrotik.getBandwidthUsage(interface)
await mikrotik.getSystemResource()
```

---

## 📞 Support

Need help with MikroTik integration?

- 📖 [MikroTik Wiki](https://wiki.mikrotik.com)
- 💬 [MikroTik Forum](https://forum.mikrotik.com)
- 🐛 [Report Issue](https://github.com/adiprayitno160-svg/billing/issues)

---

**Last Updated**: January 26, 2025  
**Version**: 1.0.0

[← Back to Documentation](../README_INSTALLATION.md)

