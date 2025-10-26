# 📋 System Requirements

Dokumen ini menjelaskan detail requirement sistem untuk menjalankan Billing System.

---

## 🖥️ Server Requirements

### Operating System

#### ✅ Supported OS

| Operating System | Version | Status | Notes |
|-----------------|---------|--------|-------|
| **Ubuntu Server** | 20.04 LTS | ✅ Tested | Recommended |
| **Ubuntu Server** | 22.04 LTS | ✅ Tested | Recommended |
| **Debian** | 10 (Buster) | ✅ Tested | Stable |
| **Debian** | 11 (Bullseye) | ✅ Tested | Recommended |
| **Debian** | 12 (Bookworm) | ✅ Tested | Latest |
| **CentOS** | 7 | ⚠️ Limited | EOL Soon |
| **CentOS** | 8 Stream | ✅ Tested | Stable |
| **Rocky Linux** | 8 | ✅ Tested | CentOS Alternative |
| **AlmaLinux** | 8 | ✅ Tested | CentOS Alternative |

#### ❌ Not Supported

- Windows Server (requires WSL)
- macOS (development only)
- Raspberry Pi OS (limited support)

---

## 💻 Hardware Requirements

### Minimum Specifications

Untuk **demo/testing** dengan < 100 customers:

```
CPU:     2 vCPU / 2 Cores @ 2.0 GHz
RAM:     2 GB
Storage: 20 GB HDD
Network: 100 Mbps
```

**Cost Estimate**: ~$5-10/month VPS

**Suitable For**:
- Testing & development
- Small RT/RW Net (< 50 customers)
- Demo purposes

### Recommended Specifications

Untuk **production** dengan 100-500 customers:

```
CPU:     4 vCPU / 4 Cores @ 2.4 GHz
RAM:     4 GB
Storage: 40 GB SSD
Network: 1 Gbps
```

**Cost Estimate**: ~$15-25/month VPS

**Suitable For**:
- Small to medium ISP (100-500 customers)
- RT/RW Net with multiple locations
- Production environment

### High-Performance Specifications

Untuk **production** dengan 500+ customers:

```
CPU:     8+ vCPU / 8+ Cores @ 3.0 GHz
RAM:     8+ GB
Storage: 80+ GB NVMe SSD
Network: 10 Gbps
```

**Cost Estimate**: ~$50-100/month VPS or dedicated server

**Suitable For**:
- Medium to large ISP (500+ customers)
- Multiple MikroTik routers
- High transaction volume
- Advanced features enabled

---

## 📊 Storage Requirements

### Application Files

```
Node Modules:     ~200 MB
Application Code:  ~50 MB
Compiled Dist:     ~30 MB
Total App Size:    ~280 MB
```

### Database Size Estimation

| Customers | Transactions/Month | Est. DB Size/Year |
|-----------|-------------------|-------------------|
| 50        | 150               | ~50 MB            |
| 100       | 300               | ~100 MB           |
| 500       | 1,500             | ~500 MB           |
| 1,000     | 3,000             | ~1 GB             |
| 5,000     | 15,000            | ~5 GB             |

### Log Files

```
PM2 Logs:      ~10 MB/day
Nginx Logs:    ~50 MB/day (with traffic)
MySQL Logs:    ~20 MB/day
Total Logs:    ~80 MB/day (~2.4 GB/month)
```

**Recommendation**: Setup log rotation to keep only 30 days

### Backup Storage

```
Database Backup:    2x current DB size
File Backup:        1x application size
Recommended Total:  5-10 GB for backups
```

### Total Storage Calculation

| Customer Count | App + DB | Logs (30d) | Backups | **Total** |
|----------------|----------|------------|---------|-----------|
| 50             | ~1 GB    | ~2.4 GB    | ~2 GB   | **~6 GB** |
| 100            | ~1.5 GB  | ~2.4 GB    | ~3 GB   | **~7 GB** |
| 500            | ~3 GB    | ~5 GB      | ~6 GB   | **~15 GB** |
| 1,000          | ~5 GB    | ~8 GB      | ~10 GB  | **~25 GB** |
| 5,000          | ~10 GB   | ~15 GB     | ~20 GB  | **~50 GB** |

---

## 🔧 Software Requirements

### Core Dependencies

#### Node.js

```
Required:  Node.js 18.x LTS
Minimum:   Node.js 18.0.0
Maximum:   Node.js 20.x
Status:    ✅ Required
```

**Why 18.x?**
- Long-term support (LTS)
- Stable performance
- Security updates until 2025
- Compatible with all dependencies

**Installation:**
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node -v  # Should show v18.x.x
npm -v   # Should show v9.x.x
```

#### Database

**MySQL 8.0+**
```
Required:  MySQL 8.0 or higher
Minimum:   MySQL 8.0.0
Status:    ✅ Recommended
Features:  Better performance, JSON support
```

**MariaDB 10.5+**
```
Required:  MariaDB 10.5 or higher
Minimum:   MariaDB 10.5.0
Status:    ✅ Alternative
Features:  MySQL drop-in replacement
```

**Installation:**
```bash
# MySQL
sudo apt install -y mysql-server

# MariaDB
sudo apt install -y mariadb-server
```

#### Process Manager

**PM2**
```
Required:  PM2 Latest
Status:    ✅ Required
Purpose:   Process management, auto-restart, clustering
```

**Installation:**
```bash
sudo npm install -g pm2
pm2 --version
```

### Optional Dependencies

#### Nginx (Recommended)

```
Purpose:   Reverse proxy, SSL termination, load balancing
Status:    ⭐ Highly Recommended
Version:   1.18.0+
```

**Benefits:**
- Better performance
- SSL/TLS support
- Static file serving
- Load balancing
- DDoS protection

**Installation:**
```bash
sudo apt install -y nginx
```

#### Certbot (SSL)

```
Purpose:   Free SSL certificates from Let's Encrypt
Status:    ⭐ Recommended for production
Version:   Latest
```

**Installation:**
```bash
sudo apt install -y certbot python3-certbot-nginx
```

#### Git

```
Purpose:   Version control, deployment
Status:    ✅ Required for deployment
Version:   2.x+
```

**Installation:**
```bash
sudo apt install -y git
```

---

## 🌐 Network Requirements

### Port Requirements

| Port | Protocol | Service | Required | Purpose |
|------|----------|---------|----------|---------|
| 3000 | TCP | Node.js | ✅ Yes | Application |
| 80 | TCP | HTTP | ⭐ Recommended | Web access |
| 443 | TCP | HTTPS | ⭐ Recommended | Secure web |
| 3306 | TCP | MySQL | ✅ Yes | Database |
| 22 | TCP | SSH | ✅ Yes | Remote access |
| 8728 | TCP | MikroTik | ⚠️ If using | MikroTik API |
| 8729 | TCP | MikroTik SSL | ⚠️ If using | Secure API |

### Firewall Configuration

**Ubuntu/Debian (UFW):**
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 3000/tcp  # App (if no Nginx)
sudo ufw enable
```

**CentOS/RHEL (firewalld):**
```bash
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

### Bandwidth Requirements

| User Count | Min Bandwidth | Recommended | Peak Traffic |
|------------|---------------|-------------|--------------|
| < 100      | 10 Mbps       | 50 Mbps     | ~1-2 GB/day  |
| 100-500    | 50 Mbps       | 100 Mbps    | ~5-10 GB/day |
| 500-1000   | 100 Mbps      | 500 Mbps    | ~20-50 GB/day|
| 1000+      | 500 Mbps      | 1 Gbps      | ~100+ GB/day |

### External API Access

Application requires internet access to:

| Service | Required | Purpose |
|---------|----------|---------|
| **GitHub** | ⚠️ Deployment | Code updates |
| **npm Registry** | ✅ Yes | Package installation |
| **Payment Gateway** | ⚠️ If enabled | Process payments |
| **Telegram API** | ⚠️ If enabled | Notifications |
| **Email SMTP** | ⚠️ If enabled | Email sending |
| **MikroTik Router** | ⚠️ If enabled | Router management |

---

## 🔐 Security Requirements

### SSL Certificate

**Production Environment:**
```
Required:  SSL/TLS Certificate
Type:      Let's Encrypt (Free) or Commercial
Status:    ⭐ Highly Recommended
```

**Why SSL?**
- Encrypted communication
- Customer trust
- Payment security
- SEO benefits

### Database Security

```bash
# Secure MySQL installation
sudo mysql_secure_installation

# Requirements:
✅ Set root password
✅ Remove anonymous users
✅ Disallow root login remotely
✅ Remove test database
✅ Reload privilege tables
```

### Application Security

**Environment Variables:**
```bash
# Secure .env file
chmod 600 .env
chown app_user:app_user .env
```

**Session Secret:**
```bash
# Generate strong secret
openssl rand -base64 32

# Add to .env
SESSION_SECRET=generated_secret_here
```

### Firewall

```
Required:  Enabled firewall
Options:   UFW (Ubuntu) or firewalld (CentOS)
Status:    ✅ Required
Rules:     Only open necessary ports
```

---

## 👥 User Requirements

### System Users

**Application User (Recommended):**
```bash
# Create dedicated user
sudo useradd -r -m -s /bin/bash billing
sudo usermod -aG sudo billing

# Run application as this user
sudo -u billing pm2 start app
```

**Why dedicated user?**
- Security isolation
- Permission management
- Audit trail
- Better resource control

### Database Users

```sql
-- Application user (normal operations)
CREATE USER 'billing_user'@'localhost' IDENTIFIED BY 'strong_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON billing_system.* TO 'billing_user'@'localhost';

-- Admin user (schema changes)
CREATE USER 'billing_admin'@'localhost' IDENTIFIED BY 'admin_password';
GRANT ALL PRIVILEGES ON billing_system.* TO 'billing_admin'@'localhost';

-- Backup user (read-only)
CREATE USER 'billing_backup'@'localhost' IDENTIFIED BY 'backup_password';
GRANT SELECT, LOCK TABLES ON billing_system.* TO 'billing_backup'@'localhost';
```

---

## 🔌 Integration Requirements

### MikroTik RouterOS

**For MikroTik integration:**

```
MikroTik Version:  6.x or 7.x
API Access:        Enabled
API Port:          8728 (or 8729 for SSL)
User Permissions:  write, read, api
Connection:        Direct network access required
```

**Test Connection:**
```bash
# From application server
telnet mikrotik-ip 8728
```

### Payment Gateway

**Supported Gateways:**

| Gateway | Status | Requirements |
|---------|--------|--------------|
| **Midtrans** | ✅ Ready | API keys, merchant account |
| **Xendit** | ✅ Ready | API key |
| **Tripay** | ✅ Ready | API key, private key |
| **Manual** | ✅ Always | None |

**Configuration:**
```env
# Midtrans
MIDTRANS_SERVER_KEY=your_key
MIDTRANS_CLIENT_KEY=your_key
MIDTRANS_IS_PRODUCTION=false

# Xendit
XENDIT_API_KEY=your_key

# Tripay
TRIPAY_API_KEY=your_key
TRIPAY_PRIVATE_KEY=your_key
```

### Messaging

**Telegram Bot:**
```
Requirements:  Bot token from @BotFather
API Access:    Internet connection to api.telegram.org
Status:        Optional
```

**WhatsApp:**
```
Requirements:  Phone number for WhatsApp Web
Status:        Optional
Note:          Uses WhatsApp Web.js (automated browser)
```

**Email:**
```
Requirements:  SMTP server credentials
Ports:         587 (TLS) or 465 (SSL)
Status:        Optional
```

---

## 🧪 Testing Environment

### Development Requirements

```
CPU:     2 Cores
RAM:     4 GB
Storage: 20 GB
OS:      Ubuntu 22.04 / Windows 10 with WSL2 / macOS
```

### Software for Development

```bash
# Code Editor
- VS Code (recommended)
- WebStorm
- Sublime Text

# Tools
- Git
- Postman (API testing)
- MySQL Workbench
- Terminal/iTerm2
```

### Testing Database

```sql
-- Separate testing database
CREATE DATABASE billing_system_test;
```

---

## 📈 Scaling Considerations

### Vertical Scaling (Single Server)

| Load Level | CPU | RAM | Storage | Max Customers |
|------------|-----|-----|---------|---------------|
| Low        | 2C  | 2GB | 20GB    | ~100          |
| Medium     | 4C  | 4GB | 40GB    | ~500          |
| High       | 8C  | 8GB | 80GB    | ~1000         |
| Very High  | 16C | 16GB| 160GB   | ~2000         |

### Horizontal Scaling (Future)

**Coming in v2.0:**
- Load balancer support
- Database replication
- Redis session store
- Microservices architecture

---

## ✅ Pre-Installation Checklist

Before installing, ensure you have:

**Server:**
- [ ] Server with supported OS installed
- [ ] Root or sudo access
- [ ] Static IP address or domain name
- [ ] Firewall configured

**Software:**
- [ ] Node.js 18.x installed
- [ ] MySQL/MariaDB installed
- [ ] PM2 installed
- [ ] Nginx installed (optional)
- [ ] Git installed

**Network:**
- [ ] Ports opened in firewall
- [ ] Internet connection available
- [ ] MikroTik accessible (if using)

**Security:**
- [ ] SSL certificate ready (for production)
- [ ] Strong passwords generated
- [ ] Backup plan prepared

**Information Ready:**
- [ ] Database credentials
- [ ] Session secret
- [ ] MikroTik credentials (if using)
- [ ] Payment gateway keys (if using)
- [ ] Email/Telegram credentials (if using)

---

## 🎯 Recommended VPS Providers

### Budget-Friendly ($5-15/month)

- **DigitalOcean** - droplets starting $6/month
- **Vultr** - VPS starting $5/month
- **Linode** - shared CPU starting $5/month
- **Contabo** - VPS starting $4/month

### Indonesia-Based

- **Niagahoster** - Cloud VPS
- **IDCloudHost** - VPS Indonesia
- **Dewaweb** - Cloud Server
- **Qwords** - Cloud VPS

### Enterprise

- **AWS EC2** - t3.small or larger
- **Google Cloud** - e2-medium or larger
- **Microsoft Azure** - B2s or larger

---

## 📞 Need Help?

If you're unsure about requirements:

1. Start with **Recommended Specifications**
2. Monitor resource usage for 1 month
3. Scale up if needed
4. Contact support for custom sizing

**Performance Monitoring:**
```bash
# CPU & RAM usage
htop

# Disk usage
df -h

# Application metrics
pm2 monit
```

---

**Last Updated**: January 26, 2025  
**Version**: 1.0.0

[← Back to Installation Guide](./README_INSTALLATION.md)

