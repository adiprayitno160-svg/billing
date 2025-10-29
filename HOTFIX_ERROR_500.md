# 🔧 HOTFIX - Error 500 di /prepaid/packages

## ⚡ **QUICK FIX (5 Menit)**

### **Step 1: Compile TypeScript** ⚠️ CRITICAL!

```bash
# Windows (PowerShell atau CMD):
npx tsc

# Atau pakai script otomatis:
HOTFIX_DEPLOY.bat
```

**Expected:** File `.js` muncul di folder `dist/`

---

### **Step 2: Verify Compiled Files**

Check apakah file-file ini ada:
```
dist/controllers/prepaid/PrepaidPackageManagementController.js ✓
dist/services/prepaid/PrepaidPackageService.js ✓
dist/services/prepaid/PrepaidQueueService.js ✓
dist/services/prepaid/PrepaidPaymentService.js ✓
```

---

### **Step 3: Restart Server**

```bash
# Jika pakai PM2:
pm2 restart billing-system

# Jika pakai npm:
# Ctrl+C untuk stop, lalu:
npm start

# Jika pakai node langsung:
# Ctrl+C untuk stop, lalu:
node dist/server.js
```

---

### **Step 4: Run Migration (Jika Belum)**

```bash
# Via MySQL command line:
mysql -u root -p billing_db < migrations/complete_prepaid_system.sql

# Atau via phpMyAdmin:
# 1. Buka billing_db database
# 2. Klik tab "SQL"
# 3. Copy-paste isi file migrations/complete_prepaid_system.sql
# 4. Klik "Go"
```

---

### **Step 5: Test**

Buka: `http://localhost:3000/prepaid/packages`

**Expected:**
- Page load cepat (< 1 detik)
- Tampil list packages (bisa kosong jika belum create)
- Tidak ada error 500

---

## 🐛 **DEBUGGING TIPS**

### **Jika Masih Error 500:**

1. **Check Console Logs:**
   ```bash
   # Jika pakai PM2:
   pm2 logs billing-system --lines 50
   
   # Jika pakai npm/node:
   # Lihat output di terminal
   ```

2. **Look for these error messages:**
   ```
   [PrepaidPackageService] Database error: Table 'prepaid_packages' doesn't exist
   → Solution: Run migration
   
   [PrepaidPackageManagementController] Error in index: Cannot find module
   → Solution: Compile TypeScript (npx tsc)
   
   Error: Cannot find module '../../services/prepaid/PrepaidPackageService'
   → Solution: Check dist/ folder, re-compile
   ```

---

### **Jika Masih Lemot:**

1. **Check Database Query Speed:**
   ```sql
   -- Test query speed
   SELECT COUNT(*) FROM prepaid_packages;
   
   -- Should return instantly
   -- If slow, check database connection
   ```

2. **Check Database Connection:**
   ```typescript
   // File: src/db/pool.ts
   // Make sure connectionLimit is sufficient
   connectionLimit: 10  // Should be OK for most cases
   ```

3. **Add Index (Jika Belum Ada):**
   ```sql
   ALTER TABLE prepaid_packages 
   ADD INDEX idx_is_active (is_active),
   ADD INDEX idx_connection_type (connection_type);
   ```

---

## 📊 **VERIFY MIGRATION**

Run this SQL to check if migration was successful:

```sql
-- Check if new columns exist
DESCRIBE prepaid_packages;

-- Should show these columns:
-- connection_type (enum: 'pppoe','static','both')
-- parent_download_queue (varchar)
-- parent_upload_queue (varchar)

-- Check if payment tables exist
SHOW TABLES LIKE 'prepaid_payment%';

-- Should show:
-- prepaid_payment_settings
-- prepaid_payment_verification_log
```

---

## 🚀 **PERFORMANCE OPTIMIZATION**

Jika page masih lemot setelah fix error:

1. **Add Caching (Optional):**
   ```typescript
   // In PrepaidPackageService.ts
   private static packageCache: PackageListItem[] | null = null;
   private static cacheTime: number = 0;
   private static CACHE_TTL = 60000; // 60 seconds
   
   static async getAllPackages(): Promise<PackageListItem[]> {
     const now = Date.now();
     if (this.packageCache && (now - this.cacheTime) < this.CACHE_TTL) {
       return this.packageCache;
     }
     
     const packages = await /* query database */;
     this.packageCache = packages;
     this.cacheTime = now;
     return packages;
   }
   ```

2. **Optimize View Rendering:**
   - View file sudah optimized dengan minimal queries
   - No external API calls in view
   - Fast CSS from CDN (Tailwind)

3. **Check Network:**
   - Jika akses dari remote, check network latency
   - Jika local, should be instant (<100ms)

---

## ✅ **CHECKLIST**

Before saying "fixed":

- [ ] TypeScript compiled successfully (`npx tsc`)
- [ ] Dist files exist (check `dist/controllers/prepaid/`)
- [ ] Server restarted
- [ ] Migration run successfully
- [ ] Page loads without 500 error
- [ ] Page loads fast (< 1 second)
- [ ] No console errors in browser (F12)
- [ ] No errors in server logs

---

## 📞 **STILL NOT WORKING?**

Share these details:
1. **Error message from console logs**
2. **Output of:** `dir dist\controllers\prepaid`
3. **Output of:** `mysql -u root -p -e "DESCRIBE prepaid_packages" billing_db`
4. **Browser console errors** (F12 → Console tab)

---

## 🎯 **EXPECTED RESULT**

After hotfix:
- ✅ Page `/prepaid/packages` loads instantly
- ✅ Shows "Manajemen Paket Prepaid" title
- ✅ Shows empty table or list of packages
- ✅ "Buat Paket Baru" button visible
- ✅ No 500 error
- ✅ Fast response time

---

**Good luck! 🚀**

