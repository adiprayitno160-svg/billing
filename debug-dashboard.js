// Debug Script untuk Interface Traffic Real-time
// Copy-paste script ini di Console browser (F12) saat di halaman Dashboard

console.log('🔍 =============== DASHBOARD DEBUG ===============');

// 1. Check Chart.js
console.log('\n📊 1. CHART.JS STATUS:');
console.log('  - typeof Chart:', typeof Chart);
console.log('  - Chart available:', typeof Chart !== 'undefined' ? '✅ YES' : '❌ NO');
if (typeof Chart !== 'undefined') {
    console.log('  - Chart.js version:', Chart.version);
}

// 2. Check Canvas
console.log('\n🖼️ 2. CANVAS ELEMENT:');
const canvas = document.getElementById('interfaceChart');
console.log('  - Canvas found:', canvas ? '✅ YES' : '❌ NO');
if (canvas) {
    console.log('  - Canvas width:', canvas.width);
    console.log('  - Canvas height:', canvas.height);
    console.log('  - Canvas visible:', canvas.offsetWidth > 0 && canvas.offsetHeight > 0);
    console.log('  - Canvas parent:', canvas.parentElement);
}

// 3. Check Interfaces
console.log('\n🔌 3. INTERFACES:');
const checkboxes = document.querySelectorAll('.interface-checkbox');
console.log('  - Total interfaces:', checkboxes.length);
const checked = document.querySelectorAll('.interface-checkbox:checked');
console.log('  - Checked interfaces:', checked.length);
if (checked.length > 0) {
    console.log('  - Selected:');
    checked.forEach((cb, i) => {
        console.log(`    ${i+1}. ${cb.dataset.interface}`);
    });
}

// 4. Test API
console.log('\n🌐 4. TESTING API ENDPOINT:');
fetch('/api/interface-stats')
    .then(res => {
        console.log('  - Response status:', res.status);
        console.log('  - Response OK:', res.ok ? '✅ YES' : '❌ NO');
        return res.json();
    })
    .then(data => {
        console.log('  - Response data:', data);
        console.log('  - Interfaces count:', Array.isArray(data) ? data.length : 0);
        if (Array.isArray(data) && data.length > 0) {
            console.log('  - First interface:', data[0]);
            console.log('  - Has rx-byte:', 'rx-byte' in data[0]);
            console.log('  - Has tx-byte:', 'tx-byte' in data[0]);
        }
    })
    .catch(err => {
        console.error('  - ❌ API Error:', err);
    });

// 5. Check Variables
console.log('\n📦 5. GLOBAL VARIABLES:');
console.log('  - chart:', typeof chart !== 'undefined' ? '✅ DEFINED' : '❌ UNDEFINED');
console.log('  - allInterfaces:', typeof allInterfaces !== 'undefined' ? '✅ DEFINED' : '❌ UNDEFINED');
if (typeof allInterfaces !== 'undefined') {
    console.log('    Count:', allInterfaces.length);
}
console.log('  - previousData:', typeof previousData !== 'undefined' ? '✅ DEFINED' : '❌ UNDEFINED');
console.log('  - updateInterval:', typeof updateInterval !== 'undefined' ? '✅ DEFINED' : '❌ UNDEFINED');

// 6. Check Loading/Error indicators
console.log('\n⏳ 6. UI INDICATORS:');
const loading = document.getElementById('chartLoadingIndicator');
const error = document.getElementById('chartErrorIndicator');
console.log('  - Loading indicator:', loading ? loading.style.display : 'not found');
console.log('  - Error indicator:', error ? error.style.display : 'not found');

// 7. MikroTik Connection
console.log('\n🔗 7. MIKROTIK CONNECTION:');
const mtStatus = document.querySelector('[data-mikrotik-status]');
if (mtStatus) {
    console.log('  - Status element found:', '✅ YES');
    console.log('  - Status:', mtStatus.textContent);
} else {
    console.log('  - Status element found:', '❌ NO');
}

console.log('\n✅ Debug complete!');
console.log('\n💡 QUICK FIXES:');
console.log('  1. If Chart.js not loaded:');
console.log('     window.location.reload()');
console.log('');
console.log('  2. If no interfaces checked:');
console.log('     document.querySelector(".interface-checkbox").click()');
console.log('');
console.log('  3. If need to force init chart:');
console.log('     initChart()');
console.log('');
console.log('  4. If need to test update:');
console.log('     fetch("/api/interface-stats").then(r=>r.json()).then(console.log)');
console.log('\n================================================');

