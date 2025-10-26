# 🚀 Billing System - Installation Guide

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/typescript-%3E%3D5.0.0-blue.svg)

**Modern Internet Service Provider (ISP) Billing Management System**

[Features](#-features) • [Requirements](#-system-requirements) • [Installation](#-installation-options) • [Documentation](#-documentation) • [Support](#-support)

</div>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [System Requirements](#-system-requirements)
- [Installation Options](#-installation-options)
- [Quick Start](#-quick-start)
- [Documentation](#-documentation)
- [Screenshots](#-screenshots)
- [Technology Stack](#-technology-stack)
- [Contributing](#-contributing)
- [License](#-license)
- [Support](#-support)

---

## 🌟 Overview

**Billing System** adalah aplikasi manajemen billing modern untuk Internet Service Provider (ISP) yang terintegrasi dengan MikroTik RouterOS. Sistem ini menyediakan solusi lengkap untuk mengelola pelanggan, paket internet, tagihan, pembayaran, dan monitoring jaringan.

### 🎯 Main Goals

- **Mudah Digunakan** - Interface yang intuitif dan user-friendly
- **Terintegrasi** - Koneksi langsung dengan MikroTik API
- **Otomatis** - Isolasi/unblock otomatis berdasarkan status pembayaran
- **Lengkap** - Dari registrasi pelanggan hingga laporan keuangan
- **Modern** - Teknologi terkini dengan performa tinggi

---

## ✨ Features

### 👥 Customer Management
- ✅ Registrasi pelanggan baru
- ✅ Manajemen data pelanggan
- ✅ Riwayat pembayaran & aktivitas
- ✅ Customer portal untuk cek tagihan
- ✅ Sistem tiket support

### 📦 Package Management
- ✅ Paket prepaid & postpaid
- ✅ Multiple speed profiles
- ✅ FUP (Fair Usage Policy)
- ✅ Paket custom per pelanggan
- ✅ Promo & diskon

### 💰 Billing & Payment
- ✅ Generate tagihan otomatis
- ✅ Multiple payment methods
- ✅ Payment gateway integration (Midtrans, Xendit, Tripay)
- ✅ Kasir/POS system
- ✅ Invoice & receipt generation
- ✅ Reminder otomatis

### 🔌 MikroTik Integration
- ✅ Sinkronisasi PPPoE secrets
- ✅ Auto isolasi pelanggan telat bayar
- ✅ Auto unblock setelah pembayaran
- ✅ Monitoring bandwidth real-time
- ✅ Address list management
- ✅ Queue management

### 📊 Reports & Analytics
- ✅ Laporan keuangan
- ✅ Statistik pelanggan
- ✅ Analisis pendapatan
- ✅ Monitoring pembayaran
- ✅ Export ke Excel/PDF

### 📢 Notifications
- ✅ Telegram bot notifications
- ✅ WhatsApp notifications (via WhatsApp Web)
- ✅ Email notifications
- ✅ SMS gateway integration

### 🛡️ Security & Access Control
- ✅ Role-based access (Admin, Kasir, Teknisi)
- ✅ Activity logging
- ✅ Session management
- ✅ Backup & restore

---

## 📋 System Requirements

### Minimum Requirements

| Component | Requirement |
|-----------|-------------|
| **OS** | Ubuntu 20.04+ / Debian 10+ / CentOS 7+ |
| **RAM** | 2GB |
| **CPU** | 2 Cores |
| **Storage** | 20GB |
| **Node.js** | 18.x LTS |
| **Database** | MySQL 8.0+ / MariaDB 10.5+ |

### Recommended Requirements

| Component | Requirement |
|-----------|-------------|
| **OS** | Ubuntu 22.04 LTS |
| **RAM** | 4GB+ |
| **CPU** | 4 Cores+ |
| **Storage** | 40GB+ SSD |
| **Node.js** | 18.x LTS |
| **Database** | MySQL 8.0+ / MariaDB 10.6+ |

### Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Edge 90+
- ✅ Safari 14+

---

## 🚀 Installation Options

Kami menyediakan 2 metode instalasi:

### 1️⃣ Native Installation (Recommended)

Install langsung di server Ubuntu/Debian/CentOS tanpa panel.

**Keuntungan:**
- ✅ Performa maksimal
- ✅ Full control
- ✅ Lightweight
- ✅ Cocok untuk production

📖 **[Panduan Lengkap: INSTALL_NATIVE.md](./INSTALL_NATIVE.md)**

### 2️⃣ aaPanel Installation

Install menggunakan aaPanel web hosting control panel.

**Keuntungan:**
- ✅ Mudah digunakan
- ✅ Web-based management
- ✅ Built-in monitoring
- ✅ Cocok untuk pemula

📖 **[Panduan Lengkap: QUICK_DEPLOY_AAPANEL.md](./QUICK_DEPLOY_AAPANEL.md)**

---

## ⚡ Quick Start

### Clone Repository

```bash
git clone https://github.com/adiprayitno160-svg/billing.git
cd billing
```

### Install Dependencies

```bash
npm install --production
```

### Configure Environment

```bash
# Copy environment file
cp .env.example .env

# Edit configuration
nano .env
```

Minimal configuration:

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=billing_user
DB_PASSWORD=your_password
DB_NAME=billing_system

# Server
PORT=3000
NODE_ENV=production

# Session
SESSION_SECRET=your_random_secret
```

### Build Application

```bash
npm run build
```

### Start Application

```bash
# Using PM2
pm2 start dist/server.js --name billing-system
pm2 save

# Using Node directly
node dist/server.js
```

### Access Application

```
http://localhost:3000
```

**Default Login:**
- Username: `admin`
- Password: `admin123`

> ⚠️ **IMPORTANT**: Change default password immediately after first login!

---

## 📚 Documentation

### Installation Guides

- 📘 [Native Installation](./INSTALL_NATIVE.md) - Ubuntu/Debian/CentOS
- 📗 [aaPanel Installation](./QUICK_DEPLOY_AAPANEL.md) - Web-based panel
- 📙 [Manual Installation](./QUICK_INSTALL_MANUAL.md) - Step-by-step manual

### Configuration Guides

- ⚙️ [Environment Configuration](./.env.example)
- 🔌 [MikroTik Integration](./docs/MIKROTIK_SETUP.md)
- 💳 [Payment Gateway Setup](./docs/PAYMENT_GATEWAY.md)
- 📢 [Notification Setup](./docs/NOTIFICATIONS.md)

### Deployment Guides

- 🚀 [Production Deployment](./DEPLOYMENT_SUMMARY.md)
- 🔄 [Auto Update Setup](./AUTO_UPDATE_SETUP_GUIDE.md)
- 💾 [Backup & Restore](./docs/BACKUP_RESTORE.md)

### User Guides

- 👤 [User Manual](./docs/USER_MANUAL.md)
- 🎓 [Admin Guide](./docs/ADMIN_GUIDE.md)
- 💡 [Best Practices](./docs/BEST_PRACTICES.md)

---

## 🖼️ Screenshots

### Dashboard
![Dashboard](./screenshots/dashboard.png)

### Customer Management
![Customers](./screenshots/customers.png)

### Billing
![Billing](./screenshots/billing.png)

### Reports
![Reports](./screenshots/reports.png)

> 📸 More screenshots available in [screenshots/](./screenshots/) folder

---

## 🛠️ Technology Stack

### Backend

- **Runtime**: Node.js 18.x LTS
- **Language**: TypeScript 5.x
- **Framework**: Express.js
- **Database**: MySQL 8.0 / MariaDB 10.5+
- **ORM**: Raw SQL with connection pooling
- **Process Manager**: PM2

### Frontend

- **Template Engine**: EJS
- **CSS Framework**: TailwindCSS 3.x
- **JavaScript**: Vanilla JS + Modern ES6+
- **Icons**: Font Awesome 6

### Integrations

- **Router**: MikroTik RouterOS API
- **Payment**: Midtrans, Xendit, Tripay
- **Messaging**: Telegram Bot API, WhatsApp Web.js
- **Email**: Nodemailer

### DevOps

- **Version Control**: Git
- **CI/CD**: GitHub Actions
- **Monitoring**: PM2, Netdata
- **Backup**: MySQL dump, File system

---

## 🔧 Development Setup

### Prerequisites

```bash
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install TypeScript
sudo npm install -g typescript
```

### Clone & Install

```bash
git clone https://github.com/adiprayitno160-svg/billing.git
cd billing
npm install
```

### Development Mode

```bash
# Watch mode with auto-reload
npm run dev

# Or manual build + run
npm run build
npm start
```

### Database Setup

```bash
# Create database
mysql -u root -p << EOF
CREATE DATABASE billing_system;
CREATE USER 'billing_user'@'localhost' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON billing_system.* TO 'billing_user'@'localhost';
FLUSH PRIVILEGES;
EOF
```

### Environment Setup

```bash
cp .env.example .env
nano .env
```

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### Reporting Bugs

1. Check existing [Issues](https://github.com/adiprayitno160-svg/billing/issues)
2. Create new issue with:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots (if applicable)

### Feature Requests

1. Open [Feature Request](https://github.com/adiprayitno160-svg/billing/issues/new)
2. Describe the feature and use case
3. Wait for community feedback

### Pull Requests

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

### Code Style

- Follow existing code style
- Use TypeScript for type safety
- Add comments for complex logic
- Write meaningful commit messages

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](./LICENSE) file for details.

```
MIT License

Copyright (c) 2025 Adi Prayitno

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

---

## 💬 Support

### Community Support

- 💬 [GitHub Discussions](https://github.com/adiprayitno160-svg/billing/discussions)
- 🐛 [Issue Tracker](https://github.com/adiprayitno160-svg/billing/issues)
- 📖 [Documentation](./docs/)

### Commercial Support

For enterprise support, custom development, or consulting:
- 📧 Email: support@example.com
- 💼 Website: https://example.com
- 📱 WhatsApp: +62xxx

### Social Media

- 🐦 Twitter: [@billing_system](https://twitter.com/billing_system)
- 📘 Facebook: [Billing System](https://facebook.com/billing.system)
- 📺 YouTube: [Tutorial Channel](https://youtube.com/c/billing)

---

## 🙏 Acknowledgments

Special thanks to:

- All contributors who have helped this project
- Open source community
- MikroTik for amazing RouterOS
- All users and supporters

---

## 📊 Project Status

### Current Version: 1.0.0

- ✅ Core billing features complete
- ✅ MikroTik integration working
- ✅ Payment gateway integrated
- ✅ Customer portal ready
- 🚧 Mobile app in development
- 🚧 API documentation in progress

### Roadmap

**Version 1.1.0**
- [ ] REST API for mobile app
- [ ] Advanced reporting
- [ ] Multi-tenant support
- [ ] RADIUS integration

**Version 1.2.0**
- [ ] Mobile application (iOS/Android)
- [ ] Advanced analytics
- [ ] AI-powered insights
- [ ] Blockchain payment integration

### Statistics

- ⭐ **Stars**: Check [GitHub](https://github.com/adiprayitno160-svg/billing)
- 🍴 **Forks**: Community contributions welcome
- 🐛 **Issues**: Active bug tracking
- 📈 **Downloads**: Growing user base

---

## 🎯 Use Cases

### Perfect For:

- 🏢 **ISP Companies** - Small to medium ISPs
- 🏘️ **RT/RW Net** - Community internet providers
- 🏨 **Hotels/Apartments** - Guest internet management
- 🏫 **Schools/Campus** - Educational institution networks
- ☕ **Cafes/Restaurants** - WiFi hotspot billing
- 🏢 **Co-working Spaces** - Shared internet billing

---

## 📞 Getting Help

### Documentation First

Before asking for help, please check:
1. 📖 [Installation Guides](#-documentation)
2. 🔍 [GitHub Issues](https://github.com/adiprayitno160-svg/billing/issues)
3. 💬 [Discussions](https://github.com/adiprayitno160-svg/billing/discussions)

### Ask for Help

If you can't find the answer:
1. Check existing issues
2. Create new issue with detailed information
3. Join our community discussions

### Emergency Support

For critical production issues:
- 🚨 Priority support for enterprise customers
- 📧 Email with [URGENT] in subject
- 💼 Commercial support available

---

<div align="center">

**⭐ If this project helps you, please give it a star! ⭐**

Made with ❤️ by [Adi Prayitno](https://github.com/adiprayitno160-svg)

[⬆ Back to Top](#-billing-system---installation-guide)

</div>

