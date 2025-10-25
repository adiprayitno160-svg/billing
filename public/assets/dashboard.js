// Dashboard functionality - CSP compliant
document.addEventListener('DOMContentLoaded', function() {
    // Initialize charts
    initTrafficChart();
    initInterfaceChart();
    
    // Initialize form handlers
    initMikrotikForm();
});

function initTrafficChart() {
    const ctx = document.getElementById('trafficChart');
    if (!ctx || !window.Chart) return;
    
    // Get chart data from global variables (set by EJS)
    if (typeof chart !== 'undefined' && chart && Array.isArray(chart.labels) && Array.isArray(chart.data)) {
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: chart.labels,
                datasets: [{
                    label: 'Pendaftaran',
                    data: chart.data,
                    borderColor: 'rgb(59 130 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    fill: true,
                    tension: 0.35
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }
}

function initInterfaceChart() {
    const interfaceCtx = document.getElementById('interfaceChart');
    if (!interfaceCtx || !window.Chart) return;
    
    // Get interface data from global variables (set by EJS)
    if (typeof interfaces !== 'undefined' && interfaces && interfaces.length > 0) {
        const interfaceNames = interfaces.map(iface => iface.name);
        const rxBytes = interfaces.map(iface => parseInt(iface['rx-byte'] || '0'));
        const txBytes = interfaces.map(iface => parseInt(iface['tx-byte'] || '0'));
        
        new Chart(interfaceCtx, {
            type: 'bar',
            data: {
                labels: interfaceNames,
                datasets: [{
                    label: 'RX Bytes',
                    data: rxBytes,
                    backgroundColor: 'rgba(34, 197, 94, 0.6)',
                    borderColor: 'rgb(34, 197, 94)',
                    borderWidth: 1
                }, {
                    label: 'TX Bytes',
                    data: txBytes,
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    borderColor: 'rgb(59, 130, 246)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: true
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                if (value >= 1000000000) {
                                    return (value / 1000000000).toFixed(1) + 'GB';
                                } else if (value >= 1000000) {
                                    return (value / 1000000).toFixed(1) + 'MB';
                                } else if (value >= 1000) {
                                    return (value / 1000).toFixed(1) + 'KB';
                                }
                                return value + 'B';
                            }
                        }
                    }
                }
            }
        });
    }
}

function initMikrotikForm() {
    const form = document.getElementById('dashboard-mikrotik-form');
    const testBtn = document.getElementById('dashboard-test-btn');
    
    if (form) {
        // Handle form submit with timeout for button re-enable
        form.addEventListener('submit', function(e) {
            const submitBtn = this.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                setTimeout(() => {
                    submitBtn.disabled = false;
                }, 500);
            }
        });
    }
    
    if (testBtn) {
        // Handle test connection button
        testBtn.addEventListener('click', function(e) {
            e.preventDefault();
            testConnection();
        });
    }
}

async function testConnection() {
    const form = document.getElementById('dashboard-mikrotik-form');
    if (!form) return;
    
    const formData = new FormData(form);
    const body = Object.fromEntries(formData.entries());
    if (!('use_tls' in body)) body.use_tls = false;
    
    try {
        const response = await fetch('/settings/mikrotik/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const result = await response.json();
        
        if (result.ok) {
            alert('Koneksi berhasil');
        } else {
            alert('Gagal: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Gagal: ' + error.message);
    }
}
