# WhatsApp Service Upgrade - Baileys

## 📋 Summary
Upgraded WhatsApp integration from `whatsapp-web.js` to `@whiskeysockets/baileys` for better stability and reliability.

## 🎯 Benefits
- ✅ **More Stable**: Baileys uses WhatsApp Multi-Device protocol (more reliable)
- ✅ **Lighter**: No need for Puppeteer/Chromium (reduces memory usage)
- ✅ **Faster Connection**: Quicker QR code generation and authentication
- ✅ **Better Maintained**: Active community support
- ✅ **Modern**: Uses latest WhatsApp Web API

## 🔄 Changes Made

### 1. New Dependencies
```bash
npm install @whiskeysockets/baileys@latest pino@latest @hapi/boom
```

### 2. New Service File
- Created: `src/services/whatsapp/BaileysWhatsAppService.ts`
- This replaces the old `WhatsAppService.ts` (which can be kept as backup)

### 3. Updated Files
- `src/server.ts` - Changed WhatsApp service import
- `src/controllers/settings/WhatsAppSettingsController.ts` - Uses Baileys service
- `src/routes/whatsapp.ts` - Uses Baileys service
- `src/scripts/repair_wa.ts` - Updated for Baileys
- `tsconfig.json` - Excluded root .ts files from build

### 4. Session Changes
- **Old**: `whatsapp-session/` (Puppeteer-based)
- **New**: `baileys-session/` (Multi-Device auth)

## 🚀 How to Use

### First Time Setup
1. Start/restart the server:
   ```bash
   npm run pm2:restart
   ```

2. Visit WhatsApp Settings page:
   ```
   http://localhost:3000/settings/whatsapp
   ```

3. Scan the QR code with your WhatsApp mobile app:
   - Open WhatsApp on your phone
   - Go to Settings > Linked Devices
   - Tap "Link a Device"
   - Scan the QR code displayed on the screen

4. Once connected, the status will show "Online" and you can start sending messages!

### Re-connecting After Logout
1. Click "**Regenerate QR Code**" button in settings
2. Wait for new QR code to appear (2-5 seconds)
3. Scan the QR code again

### Testing
Send a test message from the settings page to verify connection.

## 🔧 Troubleshooting

### QR Code Not Showing
```bash
# Delete old session and restart
rm -rf baileys-session/
npm run pm2:restart
```

### Connection Issues
Run the repair script:
```bash
ts-node src/scripts/repair_wa.ts
```

### Check Logs
```bash
npm run pm2:logs
```

## 📝 API Compatibility
All existing WhatsApp API endpoints remain the same:
- `GET /whatsapp/status` - Get connection status
- `GET /whatsapp/qr-image` - Get QR code image
- `POST /whatsapp/send` - Send message
- `POST /whatsapp/send-bulk` - Send bulk messages
- `POST /whatsapp/regenerate-qr` - Regenerate QR code

## ⚙️ Technical Details

### Old System (whatsapp-web.js)
- Uses Puppeteer to control a browser
- High memory usage (~200MB+)
- Slower startup
- QR code via browser automation

### New System (Baileys)
- Direct WebSocket connection to WhatsApp
- Low memory usage (~50MB)
- Fast startup
- Native QR code generation

## 🎉 Done!
Your WhatsApp integration is now more stable and reliable!
