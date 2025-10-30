# Changelog v2.1.12 (2025-10-30)

## 🔒 Security & Session Management

### Auto Logout Feature - 5 Minutes Inactivity
- ✅ Implementasi auto logout setelah 5 menit tanpa aktivitas
- ✅ Session timeout: 5 menit dengan rolling session
- ✅ Warning popup muncul di menit ke-4
- ✅ Tombol "Tetap Login" untuk cancel auto logout
- ✅ Otomatis redirect ke halaman login saat timeout
- ✅ Mendeteksi aktivitas user: mouse, keyboard, click, scroll, touch

### Session Configuration
- ✅ `maxAge: 5 * 60 * 1000` (5 menit)
- ✅ `rolling: true` (reset timeout setiap request)
- ✅ Session cookie expires setelah 5 menit idle
- ✅ Auto logout memanggil `/logout` endpoint

## 📊 Technical Details

### Session Config (`src/server.ts`)
```typescript
app.use(session({
    secret: process.env.SESSION_SECRET || 'billing-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 5 * 60 * 1000 // 5 minutes
    },
    rolling: true // Reset on each request
}));
```

### Client-Side Auto Logout (`views/layouts/main.ejs`)
- Deteksi idle time per menit
- Warning di menit ke-4
- Logout di menit ke-5
- Tracking aktivitas: `mousemove`, `keypress`, `click`, `scroll`, `touchstart`
- Auto remove warning popup saat user kembali aktif

## 🎨 UI/UX

### Warning Popup
- **Warna**: Orange-500 (warning)
- **Posisi**: Fixed bottom-right
- **Animasi**: Bounce
- **Tombol**: "Tetap Login" - reset idle counter
- **Icon**: Warning circle SVG

## 🚀 Deployment

```bash
cd /opt/billing && \
git pull origin main && \
npm install && \
npm run build && \
npm install --production && \
pm2 restart billing-app --update-env
```

## ⚠️ Important Notes

### Behavior Changes
- **Before**: Session bisa berlangsung lama tanpa limit
- **After**: Session otomatis logout setelah 5 menit idle
- **Impact**: User harus login ulang jika inactive > 5 menit

### User Flow
1. User login → Session active
2. No activity for 3 minutes → Still active
3. No activity for 4 minutes → Warning popup
4. User clicks "Tetap Login" → Reset counter, session continues
5. No activity for 5 minutes → Auto logout to /login

### Security Benefits
- ✅ Prevents unauthorized access dari abandoned sessions
- ✅ Automatic session cleanup
- ✅ Rolling session untuk keep-alive jika user aktif
- ✅ Clear visual warning sebelum logout

## 🔍 Testing

### Manual Testing Checklist
- [ ] Login ke aplikasi
- [ ] Biarkan idle selama 4 menit
- [ ] Popup warning muncul di menit ke-4
- [ ] Klik "Tetap Login" → warning hilang
- [ ] Biarkan idle lagi tanpa click
- [ ] Auto logout di menit ke-5
- [ ] Redirect ke /login page
- [ ] Kembali login, gerakkan mouse
- [ ] Idle counter reset, no warning

### Edge Cases
- [ ] User sedang mengetik di form → no logout
- [ ] User sedang scroll → no logout  
- [ ] User di halaman login → no warning
- [ ] User kasir dan admin → both auto logout

## 📁 Files Modified

1. `src/server.ts` - Session configuration
2. `views/layouts/main.ejs` - Auto logout script

## 📝 Migration Notes

**No database migration needed.** Ini pure session management changes.

---

**Release:** v2.1.12  
**Date:** 30 Oktober 2025  
**Type:** Security Feature  
**Status:** ✅ Production Ready  
**Breaking Changes:** Yes (Session behavior changed)  
**Backward Compatible:** No (old sessions will timeout)

