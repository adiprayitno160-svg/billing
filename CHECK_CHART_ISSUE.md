# 🔍 Troubleshoot Interface Traffic Chart

## ❌ Issue: Interface Traffic Realtime Belum Aktif

---

## ✅ QUICK FIX - 3 Steps:

### 1. Restart Server

Double-click atau run:
```
fix-chart-now.bat
```

Atau manual:
```powershell
# Stop server
taskkill /F /IM node.exe

# Start server
npm run start
```

### 2. Clear Browser Cache

Di browser:
- **CTRL + F5** (hard refresh)
- Atau **CTRL + SHIFT + DELETE** (clear all cache)

### 3. Check Browser Console

1. Buka **http://localhost:3000**
2. Tekan **F12** (Developer Tools)
3. Buka tab **Console**

**Look for:**
- ✅ `Chart.js loaded successfully`
- ✅ `Chart instance created`
- ❌ `Chart.js not loaded` → Chart.js CDN error

---

## 🔍 Diagnosa Detail

### Check 1: Chart.js CDN Loading?

Di **F12 → Network tab:**

**Look for:**
```
chart.umd.min.js    Status: 200   Type: script
```

**If 404 or Failed:**
- CDN blocked atau internet issue
- Fix: Check firewall or internet connection

### Check 2: Console Errors?

Di **F12 → Console tab:**

**Possible errors:**

#### Error: "Chart is not defined"
```
❌ ERROR: Chart.js not loaded!
```
**Fix:**
- Chart.js CDN not loading
- Check `views/layouts/main.ejs` line 13
- Make sure: `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>`

#### Error: "Canvas element not found"
```
❌ ERROR: Canvas element not found!
```
**Fix:**
- Dashboard not loaded properly
- Refresh page (CTRL+F5)

#### Error: "No interfaces selected"
```
⚠️ WARNING: No interfaces selected!
```
**Fix:**
- MikroTik not configured
- Or no interfaces available
- Go to: Settings → MikroTik

### Check 3: Element Inspect

Di **F12 → Elements tab:**

Search for: `<canvas id="interfaceChart"`

**Should see:**
```html
<canvas id="interfaceChart" style="width: 100%; height: 100%; display: block;">
```

**If not found:**
- Dashboard HTML issue
- Check `views/dashboard/index.ejs`

---

## 🛠️ Manual Fix Steps

### Step 1: Verify Chart.js in Layout

Check file: `views/layouts/main.ejs`

**Line 13 should have:**
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
```

**If missing or commented:**
```html
<!-- Chart.js for Interface Traffic Realtime -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
```

### Step 2: Check Dashboard Script

File: `views/dashboard/index.ejs`

**Around line 405-410:**
```javascript
if (typeof Chart === 'undefined') {
    console.error('❌ ERROR: Chart.js not loaded!');
    showError();
    return;
}
console.log('✅ Chart.js loaded successfully');
```

### Step 3: Test Chart.js Manually

Buka **F12 → Console**, ketik:
```javascript
typeof Chart
```

**Expected:** `"function"`  
**If:** `"undefined"` → Chart.js not loaded!

### Step 4: Force Load Chart.js

Di Console, paste ini:
```javascript
var script = document.createElement('script');
script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
document.head.appendChild(script);
script.onload = function() {
    console.log('Chart.js manually loaded!');
    location.reload();
};
```

Then refresh page.

---

## 🎯 Expected Behavior (WORKING)

### Console Output (F12):
```
=== 📡 INTERFACE DATA DEBUG ===
Interfaces defined: true
Interfaces exists: true
Interfaces length: 2

Step 1: DOM Content Loaded
Step 7: Checking Chart.js...
Step 8: typeof Chart: function
✅ Step 9: Chart.js loaded successfully
Step 10: Selected interfaces: [...]
✅ Step 13: Chart created successfully!
```

### Visual:
- ✅ Chart canvas visible
- ✅ Lines animated
- ✅ Updates every 3 seconds
- ✅ Tooltip on hover
- ✅ Interface selector dropdown works

---

## 🔄 If Still Not Working

### Nuclear Option: Full Rebuild

```powershell
# 1. Stop server
taskkill /F /IM node.exe

# 2. Clear dist
rd /s /q dist

# 3. Rebuild
npm run build

# 4. Start
npm run start
```

### Alternative: Check Port

```powershell
# Check if port 3000 in use
netstat -ano | findstr :3000

# Kill process if needed
taskkill /F /PID <PID>
```

---

## 📞 Still Having Issues?

**Send me:**
1. Screenshot of F12 Console tab
2. Screenshot of F12 Network tab (filter: chart)
3. Output dari: `npm run start`

**Or check:**
- Browser compatibility (use Chrome/Edge)
- Antivirus/Firewall blocking CDN
- Corporate network blocking jsdelivr.net

---

## ✅ Quick Checklist

Before asking for help:

- [ ] Ran `fix-chart-now.bat`
- [ ] Cleared browser cache (CTRL+F5)
- [ ] Checked F12 Console for errors
- [ ] Verified Chart.js loads in Network tab
- [ ] Tested `typeof Chart` in console
- [ ] MikroTik configured in Settings
- [ ] Server running on port 3000
- [ ] Using Chrome or Edge browser

---

**Good luck!** 🚀

