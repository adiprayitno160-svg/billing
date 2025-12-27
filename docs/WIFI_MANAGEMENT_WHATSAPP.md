# WhatsApp Bot - WiFi Management Feature

## Overview
Fitur ini memungkinkan pelanggan untuk mengubah nama WiFi (SSID) dan password perangkat CPE mereka langsung melalui WhatsApp bot. Perubahan akan dikirim ke GenieACS yang kemudian akan mengkonfigurasi perangkat CPE secara otomatis.

## Arsitektur

```
WhatsApp Bot → WiFiManagementService → GenieACS API → CPE Device
                      ↓
              Database Logging
```

## Komponen

### 1. WiFiManagementService
**File:** `src/services/genieacs/WiFiManagementService.ts`

Service utama yang menangani:
- Mendapatkan konfigurasi WiFi dari device
- Mengubah SSID dan/atau password
- Menyimpan log perubahan ke database
- Mendukung berbagai model CPE (TR-098 dan TR-181)

### 2. WhatsAppBotService (Extended)
**File:** `src/services/whatsapp/WhatsAppBotService.ts`

Menambahkan command baru:
- `/wifi` atau `/ubahwifi` - Menampilkan menu WiFi
- `/wifi_ssid [nama_baru]` - Ubah SSID saja
- `/wifi_password [password_baru]` - Ubah password saja
- `/wifi_both [SSID]|[Password]` - Ubah keduanya

### 3. GenieACS Service (Extended)
**File:** `src/services/genieacs/GenieacsService.ts`

Menambahkan method:
- `setParameterValues()` - Untuk set parameter TR-069 pada device

### 4. Database Table
**File:** `scripts/migrations/create_wifi_change_requests_table.sql`

Tabel `wifi_change_requests` untuk logging:
- customer_id
- device_id
- new_ssid
- new_password
- status (pending/processing/completed/failed)
- timestamps

## Cara Penggunaan

### Untuk Pelanggan (via WhatsApp)

1. **Lihat Menu WiFi**
   ```
   Ketik: /wifi
   atau: 3 (dari menu utama)
   ```

2. **Ubah SSID saja**
   ```
   /wifi_ssid MyNewWiFi
   ```

3. **Ubah Password saja**
   ```
   /wifi_password mypassword123
   ```

4. **Ubah SSID dan Password**
   ```
   /wifi_both MyNewWiFi|mypassword123
   ```

### Untuk Admin

1. **Setup Database**
   ```bash
   # Jalankan migration
   mysql -u root billing < scripts/migrations/create_wifi_change_requests_table.sql
   ```

2. **Assign Device ID ke Customer**
   ```sql
   UPDATE customers 
   SET device_id = 'DEVICE_ID_FROM_GENIEACS' 
   WHERE id = CUSTOMER_ID;
   ```

3. **Monitor Perubahan**
   ```sql
   SELECT * FROM wifi_change_requests 
   ORDER BY requested_at DESC 
   LIMIT 20;
   ```

## TR-069 Parameter Paths

### TR-098 (InternetGatewayDevice)
```
SSID: InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID
Password: InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase
Encryption: InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.BeaconType
Enable: InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.Enable
```

### TR-181 (Device)
```
SSID: Device.WiFi.SSID.1.SSID
Password: Device.WiFi.AccessPoint.1.Security.KeyPassphrase
Encryption: Device.WiFi.AccessPoint.1.Security.ModeEnabled
Enable: Device.WiFi.SSID.1.Enable
```

## Validasi

### Password Requirements
- Minimal: 8 karakter
- Maksimal: 63 karakter
- Sesuai standar WPA2-PSK

### SSID Requirements
- Tidak boleh kosong
- Maksimal 32 karakter (standar WiFi)

## Error Handling

1. **Customer tidak ditemukan**
   - Nomor WhatsApp belum terdaftar

2. **Device tidak ditemukan**
   - Customer belum di-assign device_id
   - Solusi: Admin harus set device_id di database

3. **GenieACS Error**
   - Device offline
   - Parameter path tidak valid
   - Connection timeout

4. **Validation Error**
   - Password terlalu pendek
   - SSID kosong

## Security Considerations

1. **Password Storage**
   - Password disimpan di database untuk logging
   - Pertimbangkan enkripsi jika diperlukan

2. **Authorization**
   - Hanya customer yang terdaftar yang bisa mengubah WiFi
   - Validasi berdasarkan nomor WhatsApp

3. **Rate Limiting**
   - Pertimbangkan menambahkan rate limiting untuk mencegah abuse

## Testing

### Manual Testing via WhatsApp

1. Pastikan WhatsApp bot sudah running
2. Kirim pesan `/wifi` ke bot
3. Ikuti instruksi yang diberikan
4. Cek log di database

### Check GenieACS Connection
```typescript
const genieacs = GenieacsService.getInstance();
const result = await genieacs.testConnection();
console.log(result);
```

### Check Device
```typescript
const wifiService = new WiFiManagementService();
const config = await wifiService.getWiFiConfig('DEVICE_ID');
console.log(config);
```

## Troubleshooting

### Bot tidak merespon command WiFi
1. Cek apakah WhatsApp bot service running
2. Cek log di console untuk error
3. Pastikan import WiFiManagementService sudah benar

### Perubahan tidak diterapkan ke device
1. Cek koneksi ke GenieACS
2. Cek apakah device online (last inform < 5 menit)
3. Cek parameter path sesuai dengan model device
4. Lihat tasks di GenieACS dashboard

### Customer tidak bisa ubah WiFi
1. Pastikan customer sudah punya device_id
2. Cek nomor WhatsApp sudah terdaftar
3. Cek format command sudah benar

## Future Enhancements

1. **Interactive Menu**
   - Gunakan WhatsApp buttons/list untuk UX lebih baik

2. **WiFi Schedule**
   - Jadwalkan perubahan WiFi di waktu tertentu

3. **Multi-SSID Support**
   - Support untuk 2.4GHz dan 5GHz terpisah

4. **WiFi Analytics**
   - Tampilkan statistik penggunaan WiFi
   - Device yang terkoneksi

5. **Notification**
   - Notifikasi ketika perubahan berhasil diterapkan
   - Notifikasi jika ada device baru terkoneksi

## API Reference

### WiFiManagementService

```typescript
// Get WiFi config
const config = await wifiService.getWiFiConfig(deviceId);

// Change credentials
const result = await wifiService.changeWiFiCredentials(
    deviceId, 
    newSSID,      // optional
    newPassword   // optional
);

// Get customer device ID
const deviceId = await wifiService.getCustomerDeviceId(customerId);

// Get history
const history = await wifiService.getCustomerWiFiHistory(customerId, 10);
```

### GenieACS Service

```typescript
// Set parameter values
const result = await genieacs.setParameterValues(
    deviceId,
    [
        ['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID', 'NewSSID', 'xsd:string'],
        ['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase', 'NewPassword', 'xsd:string']
    ]
);
```

## Support

Untuk pertanyaan atau issue, hubungi tim development atau buat issue di repository.
