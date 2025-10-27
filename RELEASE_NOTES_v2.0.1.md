# Version 2.0.1 - Dashboard Improvements

## Key Features:
- Real-time Traffic Monitoring dengan Chart.js
- Separate RX/TX Visualization (solid line untuk Download, dashed line untuk Upload)
- Interface Selector dengan multi-select capability
- Live Speed Display dengan color coding di legend
- Sidebar Toggle dengan localStorage persistence
- Responsive Footer yang mengikuti sidebar state
- 6 Modern KPI Cards dalam single row layout
- Improved UI/UX dengan Tailwind CSS

## Technical Improvements:
- Added `/api/interface-stats` endpoint untuk real-time data
- Implemented atomic dataset updates untuk Chart.js (menghindari race conditions)
- Fixed Chart.js controller conflict (`type` -> `dataType`)
- Fixed MariaDB compatibility issues
- Enhanced dashboard controller dengan interface statistics
- Database schema improvements untuk maintenance tracking
- Updated Tailwind CSS ke versi terbaru

## Installation:
```bash
cd /opt/billing
git pull origin main
npm install
npm run css:build
pm2 restart billing-app
```

## Auto-Update:
Untuk user yang sudah install, buka halaman **About** di aplikasi, lalu:
1. Klik "Check for Updates"
2. Klik "Update Now"
3. Aplikasi akan auto-update dan restart

## What's New:
- Dashboard sekarang menampilkan real-time traffic chart dengan 2 garis per interface
- Speed display menunjukkan RX (Download) dan TX (Upload) secara terpisah
- Sidebar bisa di-hide untuk maximize screen space
- KPI cards lebih compact dan informatif

## Bug Fixes:
- Fixed Chart.js rendering issues
- Fixed checkbox not checked on first load
- Fixed legend color inconsistencies
- Fixed MariaDB SQL syntax compatibility

