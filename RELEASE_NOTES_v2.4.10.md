# Release Notes v2.4.10
Date: 2026-01-04

## New Features
- **GenieACS Integration Improvements**:
  - Menampilkan SSID dan Password WiFi secara langsung di tabel Devices (`/genieacs/devices`). Password tidak lagi disembunyikan.
  - Halaman Device Detail sekarang menampilkan Current SSID dan Password di overview dan configuration form.
  - Menyimpan kredensial WiFi (SSID/Password) ke database (`customers` table) secara otomatis saat operator mengubahnya via GenieACS.

- **WhatsApp Bot Improvements**:
  - Perintah baru `/mywifi`, `/passwordwifi`, `/lihatwifi` untuk pelanggan melihat password WiFi mereka yang tersimpan.
  - Penambahan menu `7️⃣ Password WiFi` di Menu Utama.

## Database Changes
- Migration: Menambahkan kolom `wifi_ssid` dan `wifi_password` ke tabel `customers` untuk penyimpanan kredensial WiFi.

## Technical
- Membersihkan `.gitignore` untuk exclude file-file temporary, logs, dan artifacts AI.
- Update dependensi project.
