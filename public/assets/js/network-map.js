
// Global variables
let map;
let markers = {};
let linkLayers = L.layerGroup();
let traceLayer = L.layerGroup();
let heatLayer = null;
let currentLinks = [];
let allDevices = [];
let deviceMap = {};
let linksMap = {};
let selectedDevice = null;
let routingControl = null;
let searchQuery = '';
let isOfflineOnly = false;
let isHeatmapActive = false;
let isAudioEnabled = true;
let previousDeviceStatus = {};
let activeFilters = {
    customer: true,
    ont: true,
    olt: true,
    odc: true,
    odp: true
};

// Initialize Map
function initMap() {
    // Default center (Jakarta)
    map = L.map('map').setView([-6.2088, 106.8456], 13);

    // Dark Tile Layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    linkLayers.addTo(map);
    traceLayer.addTo(map);

    // Initial Data Load
    loadNetworkData();

    // Auto-refresh every 30 seconds
    setInterval(refreshData, 30000);

    // Enable Audio on first click
    document.body.addEventListener('click', () => {
        if (window.audioCtx && window.audioCtx.state === 'suspended') {
            window.audioCtx.resume();
        }
    }, { once: true });

    // Map Click to close sidebar
    map.on('click', (e) => {
        if (!e.originalEvent.target.closest('.leaflet-marker-icon')) {
            closeDeviceSidebar();
        }
    });
}

// Data Fetching
async function loadNetworkData() {
    try {
        const response = await fetch('/monitoring/api/network-topology-fast?_t=' + new Date().getTime());
        const result = await response.json();

        if (result.success) {
            updateStatusIndicator(true);

            allDevices = result.data.devices;
            currentLinks = result.data.links;

            // Build Device Map
            deviceMap = {};
            allDevices.forEach(d => {
                deviceMap[d.id] = d;
                checkStatusChange(d);
            });

            // Set Initial View if not set
            if (!map.hasSetView && allDevices.length > 0) {
                const center = calculateInitialCenter(allDevices);
                map.setView([center.lat, center.lng], center.zoom);
                map.hasSetView = true;
            }

            applyFilters();
            renderLinks(currentLinks);
            updateStats(result.data.statistics);

            document.getElementById('loadingOverlay').style.display = 'none';
        } else {
            throw new Error(result.error || 'Failed to fetch topology');
        }
    } catch (error) {
        console.error('Topology Load Error:', error);
        updateStatusIndicator(false, error.message);
    }
}

function updateStatusIndicator(connected, message = '') {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    if (!dot || !text) return;

    if (connected) {
        dot.style.background = '#10b981';
        text.textContent = 'Live Monitoring Active';
    } else {
        dot.style.background = '#ef4444';
        text.textContent = `Connection Error: ${message}`;
    }
}

function checkStatusChange(device) {
    const prev = previousDeviceStatus[device.id];
    if (prev === 'online' && device.status === 'offline') {
        let meta = device.metadata;
        if (typeof meta === 'string') try { meta = JSON.parse(meta); } catch (e) { }

        if (!meta?.is_ignored) {
            playAlertSound('critical');
            showOfflineToast(device.name);
        }
    }
    previousDeviceStatus[device.id] = device.status;
}

// Rendering Logic
function renderDevices(devices) {
    const currentDeviceIds = new Set(devices.map(d => d.id.toString()));

    // Cleanup old markers
    Object.keys(markers).forEach(id => {
        if (!currentDeviceIds.has(id)) {
            markers[id].remove();
            delete markers[id];
        }
    });

    devices.forEach(device => {
        // Skip OLT from general markers if handled separately, but usually it's included
        const lat = parseFloat(device.latitude);
        const lng = parseFloat(device.longitude);
        if (isNaN(lat) || isNaN(lng)) return;

        const icon = getDeviceIcon(device);
        const popupContent = createDevicePopup(device);

        if (markers[device.id]) {
            const marker = markers[device.id];
            if (marker.getLatLng().lat !== lat || marker.getLatLng().lng !== lng) {
                marker.setLatLng([lat, lng]);
            }
            marker.setIcon(icon);
            marker.setPopupContent(popupContent);
        } else {
            const marker = L.marker([lat, lng], { icon });
            marker.bindPopup(popupContent, { closeButton: false, offset: [0, -10] });

            marker.on('mouseover', function () { this.openPopup(); });
            marker.on('mouseout', function () { this.closePopup(); });
            marker.on('click', () => onDeviceClick(device));

            marker.addTo(map);
            markers[device.id] = marker;
        }
    });
}

function getDeviceIcon(device) {
    const iconMap = {
        customer: 'fa-user',
        ont: 'fa-router',
        olt: 'fa-server',
        odc: 'fa-box',
        odp: 'fa-cube'
    };

    let meta = device.metadata;
    if (typeof meta === 'string') try { meta = JSON.parse(meta); } catch (e) { }

    const isIgnored = meta?.is_ignored === true;

    // Status Colors
    const colors = {
        online: '#10b981',
        offline: '#ef4444',
        warning: '#f59e0b',
        olt: '#8B5CF6',
        odc: '#F59E0B',
        odp: '#3B82F6'
    };

    let color = colors[device.device_type] || colors[device.status] || '#94a3b8';
    if (device.device_type === 'customer') {
        color = device.status === 'online' ? colors.online : colors.offline;
        if (isIgnored) color = '#8b5cf6';
    }

    const iconClass = iconMap[device.device_type] || 'fa-circle';
    let animation = device.status === 'online' ? 'pulse 2s infinite' : (device.status === 'offline' && !isIgnored ? 'marker-blink 1.5s infinite' : '');

    return L.divIcon({
        html: `
            <div class="marker-label-container" style="animation: ${animation}">
                <div style="background: ${color}; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                    <i class="fas ${iconClass}"></i>
                </div>
            </div>
        `,
        className: 'custom-marker',
        iconSize: [34, 34],
        iconAnchor: [17, 17]
    });
}

function createDevicePopup(device) {
    let meta = device.metadata;
    if (typeof meta === 'string') try { meta = JSON.parse(meta); } catch (e) { }

    const isIgnored = meta?.is_ignored === true;
    const statusText = isIgnored ? 'MAINTENANCE' : device.status.toUpperCase();
    const statusColor = isIgnored ? '#8b5cf6' : (device.status === 'online' ? '#10b981' : '#ef4444');

    let html = `
        <div class="device-popup">
            <h4 style="margin: 0 0 8px 0; border-bottom: 1px solid #eee; padding-bottom: 4px;">${device.name}</h4>
            <div style="font-size: 11px; display: grid; gap: 4px;">
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #64748b;">Status:</span>
                    <span style="font-weight: bold; color: ${statusColor};">${statusText}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #64748b;">Type:</span>
                    <span style="font-weight: bold;">${device.device_type.toUpperCase()}</span>
                </div>
    `;

    if (device.ip_address) {
        html += `
            <div style="display: flex; justify-content: space-between;">
                <span style="color: #64748b;">IP:</span>
                <span>${device.ip_address}</span>
            </div>
        `;
    }

    if (device.device_type === 'customer' && meta?.pppoe_username) {
        html += `
            <div style="display: flex; justify-content: space-between;">
                <span style="color: #64748b;">Username:</span>
                <span style="color: #3b82f6;">${meta.pppoe_username}</span>
            </div>
        `;
    }

    html += `
            <div style="margin-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                <button onclick="traceRouteToOlt(${device.id})" style="background: #6366f1; color: white; border: none; padding: 4px; border-radius: 4px; cursor: pointer; font-size: 10px;">Trace</button>
                <button onclick="showDeviceDetail(deviceMap[${device.id}])" style="background: #f1f5f9; border: 1px solid #e2e8f0; padding: 4px; border-radius: 4px; cursor: pointer; font-size: 10px;">Details</button>
            </div>
        </div>
    `;
    return html;
}

function renderLinks(links) {
    linkLayers.clearLayers();
    linksMap = {};

    links.forEach(link => {
        const source = deviceMap[link.source_device_id];
        const target = deviceMap[link.target_device_id];

        if (!source || !target) return;

        const sLat = parseFloat(source.latitude);
        const sLng = parseFloat(source.longitude);
        const tLat = parseFloat(target.latitude);
        const tLng = parseFloat(target.longitude);

        if (isNaN(sLat) || isNaN(sLng) || isNaN(tLat) || isNaN(tLng)) return;

        // Skip OLT-ODC link as requested to declutter? No, user wanted it earlier, but later might have asked to remove.
        // Let's keep it unless specified.

        const linkId = `link-${link.source_device_id}-${link.target_device_id}`;
        let className = 'network-link';
        let color = '#3b82f6';

        if (source.device_type === 'odp' && target.device_type === 'customer') {
            color = target.status === 'online' ? '#10b981' : '#ef4444';
            className += target.status === 'online' ? ' link-customer-online' : ' link-customer-offline';
        } else if (source.device_type === 'odc' && target.device_type === 'odp') {
            color = '#f59e0b';
            className += ' link-odc-odp';
        }

        const polyline = L.polyline([[sLat, sLng], [tLat, tLng]], {
            color,
            weight: 3,
            opacity: 0.6,
            className
        }).addTo(linkLayers);

        const dist = map.distance([sLat, sLng], [tLat, tLng]);
        polyline.bindTooltip(`Jarak: ${Math.round(dist)}m`, { sticky: true });

        linksMap[linkId] = polyline;
    });
}

// Interaction Handlers
function onDeviceClick(device) {
    showDeviceDetail(device);
}

function showDeviceDetail(device) {
    const sidebar = document.getElementById('deviceSidebar');
    const nameEl = document.getElementById('sidebarName');
    const subnameEl = document.getElementById('sidebarSubname');
    const contentEl = document.getElementById('sidebarContent');
    const headerEl = document.getElementById('sidebarHeader');

    if (!sidebar) return;

    nameEl.textContent = device.name;
    subnameEl.textContent = `${device.device_type.toUpperCase()} • ${device.status.toUpperCase()}`;

    let meta = device.metadata;
    if (typeof meta === 'string') try { meta = JSON.parse(meta); } catch (e) { }

    // Sidebar Content based on type
    if (device.device_type === 'odc') {
        contentEl.innerHTML = getOdcSidebarContent(device);
    } else if (device.device_type === 'odp') {
        contentEl.innerHTML = getOdpSidebarContent(device);
    } else if (device.device_type === 'customer') {
        contentEl.innerHTML = getCustomerSidebarContent(device, meta);
    } else {
        contentEl.innerHTML = `<div class="p-4"><p>Informasi teknis lainnya...</p></div>`;
    }

    sidebar.classList.add('active');
}

function closeDeviceSidebar() {
    document.getElementById('deviceSidebar').classList.remove('active');
}

// Sidebar Content Generators
function getOdcSidebarContent(odc) {
    const connectedOdps = allDevices.filter(d => d.device_type === 'odp' && (d.odc_id === odc.id || d.parentId === odc.id));
    return `
        <div class="p-4">
            <div class="odc-stats-grid">
                <div class="stat-card"><span class="label">Connected ODP</span><span class="value">${connectedOdps.length}</span></div>
            </div>
            <div class="odp-list-container">
                <h3>Connected ODPs</h3>
                ${connectedOdps.map(odp => `<div class="odp-item" onclick="focusOnDevice(${odp.id})"><span>${odp.name}</span></div>`).join('')}
            </div>
        </div>
    `;
}

function getOdpSidebarContent(odp) {
    const customers = allDevices.filter(d => d.device_type === 'customer' && (d.odp_id === odp.id || d.parentId === odp.id));
    return `
        <div class="p-4">
            <div class="stat-card"><span class="label">Total Customers</span><span class="value">${customers.length}</span></div>
            <div class="odp-list-container">
                <h3>Customer List</h3>
                ${customers.map(c => `<div class="odp-item" onclick="focusOnDevice(${c.id})"><span>${c.name}</span></div>`).join('')}
            </div>
        </div>
    `;
}

function getCustomerSidebarContent(c, meta) {
    return `
        <div class="p-4 space-y-4">
            <div class="bg-slate-50 p-4 rounded-xl border">
                <h4 class="text-xs font-bold uppercase text-slate-400 mb-2">Service Info</h4>
                <div class="text-sm space-y-2">
                    <p><strong>PPPoE:</strong> ${meta?.pppoe_username || '-'}</p>
                    <p><strong>Address:</strong> ${c.address || '-'}</p>
                    <p><strong>Status:</strong> <span style="color: ${c.status === 'online' ? '#10b981' : '#ef4444'}">${c.status.toUpperCase()}</span></p>
                </div>
            </div>
            <div class="flex gap-2">
                <a href="https://maps.google.com/?q=${c.latitude},${c.longitude}" target="_blank" class="flex-1 bg-white border py-2 text-center rounded-lg text-xs font-bold">Google Maps</a>
                <button onclick="traceRouteToOlt(${c.id})" class="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-xs font-bold">Trace Path</button>
            </div>
        </div>
    `;
}

function focusOnDevice(id) {
    const d = deviceMap[id];
    if (d) {
        map.flyTo([parseFloat(d.latitude), parseFloat(d.longitude)], 18);
        setTimeout(() => markers[id]?.openPopup(), 500);
    }
}

// Trace Route
function traceRouteToOlt(deviceId) {
    traceLayer.clearLayers();
    const start = deviceMap[deviceId];
    if (!start) return;

    const path = [[parseFloat(start.latitude), parseFloat(start.longitude)]];
    const nodes = [start];
    let current = start;

    // Simplified tracing via parent links
    while (current && current.device_type !== 'olt') {
        const parentId = current.parentId || current.odp_id || current.odc_id || current.olt_id;
        const parent = deviceMap[parentId];

        if (!parent || parent.id === current.id) {
            // Unconnected or root
            break;
        }

        path.push([parseFloat(parent.latitude), parseFloat(parent.longitude)]);
        nodes.push(parent);
        current = parent;
    }

    if (path.length > 1) {
        const poly = L.polyline(path, { color: '#ff00ea', weight: 6, opacity: 0.8, className: 'trace-line' }).addTo(traceLayer);
        map.fitBounds(poly.getBounds(), { padding: [50, 50] });

        // Update Overlay
        const overlay = document.getElementById('traceOverlay');
        const dist = Math.round(path.reduce((acc, curr, i) => i === 0 ? 0 : acc + map.distance(path[i - 1], curr), 0));

        overlay.innerHTML = nodes.reverse().map((n, i) => `
            <div class="trace-node">${n.name}</div>
            ${i < nodes.length - 1 ? '<div class="trace-arrow">→</div>' : ''}
        `).join('') + `
            <div style="margin-left: 15px; background: rgba(0,0,0,0.5); padding: 4px 8px; border-radius: 4px;">
                ${dist > 1000 ? (dist / 1000).toFixed(2) + 'km' : dist + 'm'}
                <i class="fas fa-times-circle" onclick="clearTrace()" style="margin-left:8px; cursor:pointer; color:#ef4444;"></i>
            </div>
        `;
        overlay.style.display = 'flex';
    }
}

function clearTrace() {
    traceLayer.clearLayers();
    document.getElementById('traceOverlay').style.display = 'none';
}

// Filters & Controls
function applyFilters() {
    const filtered = allDevices.filter(d => {
        if (!activeFilters[d.device_type]) return false;
        if (isOfflineOnly && d.status !== 'offline') return false;
        if (searchQuery && !d.name.toLowerCase().includes(searchQuery)) return false;
        return true;
    });
    renderDevices(filtered);
}

function onSearchInput(val) {
    searchQuery = val.toLowerCase();
    applyFilters();
}



function toggleFilter(type) {
    activeFilters[type] = !activeFilters[type];
    document.getElementById(`filter-${type}`).checked = activeFilters[type];
    applyFilters();
}

function toggleOfflineOnly() {
    isOfflineOnly = !isOfflineOnly;
    document.getElementById('filter-offline-only').checked = isOfflineOnly;
    applyFilters();
}

function toggleLiveTraffic() {

    const checkbox = document.getElementById('live-traffic-toggle');
    // If the click came from the div, flip the checkbox state manually because the click event on div happens 
    // but the checkbox might not be the target if we clicked the div background. 
    // However, the checkbox is inside the div. 
    // Actually, usually we want to toggle the checkbox and let the change event handle it, 
    // OR handle the logic here.
    // Let's emulate the click on checkbox if it wasn't the target?
    // Or just implement the logic:

    // We'll rely on the checkbox state having been toggled by the click or we toggle it.
    // If we clicked the div, the checkbox state hasn't changed unless we clicked the label for it.
    // Simplest is to just toggle the checkbox and trigger the logic.

    // Check if the event target is the checkbox itself to avoid double toggle
    if (window.event && window.event.target.id === 'live-traffic-toggle') return;

    checkbox.checked = !checkbox.checked;
    updateLiveTrafficState();
}

function updateLiveTrafficState() {
    const checkbox = document.getElementById('live-traffic-toggle');
    const enabled = checkbox.checked;
    const body = document.body;

    if (!enabled) {
        body.classList.add('live-traffic-disabled');
        checkbox.style.borderColor = '#ccc';
        checkbox.style.background = 'white';
        checkbox.nextElementSibling.style.background = '#e2e8f0';

        const iconDiv = checkbox.closest('.filter-item').querySelector('.filter-icon');
        if (iconDiv) {
            iconDiv.style.background = '#94a3b8';
            iconDiv.innerHTML = '<i class="fas fa-bolt"></i>';
        }
    } else {
        body.classList.remove('live-traffic-disabled');
        checkbox.style.borderColor = '#ef4444';
        checkbox.style.background = '#ef4444';
        checkbox.nextElementSibling.style.background = '#fee2e2';

        const iconDiv = checkbox.closest('.filter-item').querySelector('.filter-icon');
        if (iconDiv) {
            iconDiv.style.background = '#ef4444';
            iconDiv.innerHTML = '<i class="fas fa-bolt animate-pulse"></i>';
        }
    }
    localStorage.setItem('liveTrafficEnabled', enabled);
}

function toggleHeatmap() {
    const checkbox = document.getElementById('heatmap-toggle');
    // Prevent double toggle if clicked directly on checkbox
    if (window.event && window.event.target.id === 'heatmap-toggle') {
        isHeatmapActive = checkbox.checked;
    } else {
        checkbox.checked = !checkbox.checked;
        isHeatmapActive = checkbox.checked;
    }

    if (isHeatmapActive) {
        document.body.classList.add('heatmap-mode');
        renderHeatmap();
    } else {
        document.body.classList.remove('heatmap-mode');
        if (heatLayer) map.removeLayer(heatLayer);
    }
}

function renderHeatmap() {
    if (heatLayer) map.removeLayer(heatLayer);

    const points = allDevices
        .filter(d => d.device_type === 'customer' && d.latitude && d.longitude)
        .map(d => [parseFloat(d.latitude), parseFloat(d.longitude), 1.0]); // Intensity 1.0

    if (points.length > 0) {
        heatLayer = L.heatLayer(points, {
            radius: 25,
            blur: 15,
            maxZoom: 17,
        }).addTo(map);
    }
}

function closeRouteInfo() {
    document.getElementById('routeInfoPanel').style.display = 'none';
}


function refreshData() {
    loadNetworkData();
}

// Stats & UI
function updateStats(stats) {
    document.getElementById('statOnline').textContent = stats.online_devices;
    document.getElementById('statOffline').textContent = stats.offline_devices;
    document.getElementById('statWarning').textContent = stats.warning_devices;
    document.getElementById('statTotal').textContent = stats.total_devices;
}

function toggleStatsPanel() {
    document.getElementById('statsPanel').classList.toggle('collapsed');
}

function toggleControlPanel() {
    document.getElementById('controlPanel').classList.toggle('collapsed');
}

// Audio Alerts
function playAlertSound(type = 'warning') {
    if (!isAudioEnabled) return;
    if (!window.audioCtx) window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const osc = window.audioCtx.createOscillator();
    const gain = window.audioCtx.createGain();
    osc.connect(gain);
    gain.connect(window.audioCtx.destination);

    if (type === 'critical') {
        osc.frequency.setValueAtTime(440, window.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, window.audioCtx.currentTime + 0.5);
    } else {
        osc.frequency.setValueAtTime(554, window.audioCtx.currentTime);
    }

    gain.gain.setValueAtTime(0.1, window.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, window.audioCtx.currentTime + 0.5);

    osc.start();
    osc.stop(window.audioCtx.currentTime + 0.5);
}

function toggleAudioAlerts() {
    isAudioEnabled = !isAudioEnabled;
    document.getElementById('audio-alerts-toggle').checked = isAudioEnabled;
    localStorage.setItem('audioAlertsEnabled', isAudioEnabled);
}

function showOfflineToast(name) {
    const toast = document.createElement('div');
    toast.className = 'offline-toast';
    toast.style.cssText = "position:fixed; top:20px; right:20px; background:#ef4444; color:white; padding:10px 20px; border-radius:8px; z-index:9999; font-weight:bold; box-shadow: 0 4px 10px rgba(0,0,0,0.3);";
    toast.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${name} OFFLINE!`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}

// Sync Utilities

async function syncData() {
    const btn = document.getElementById('btn-sync-data');

    if (!confirm('Jalankan SINKRONISASI Data? \n\nAksi ini akan:\n1. Mengambil data OLT/ODC/ODP terbaru.\n2. Update data Customer (termasuk referensi ke ODP).\n3. Membuat link koneksi otomatis.\n\nLanjutkan?')) return;

    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';

    try {
        console.log('Starting sync process...');
        await fetch('/monitoring/api/sync/ftth', { method: 'POST' });
        await fetch('/monitoring/api/sync/customers', { method: 'POST' });
        await fetch('/monitoring/api/sync/links', { method: 'POST' });

        alert('✅ Sinkronisasi Berhasil!\nHalaman akan dimuat ulang untuk menampilkan data terbaru.');
        location.reload();
    } catch (e) {
        console.error('Sync failed:', e);
        alert('❌ Gagal melakukan sinkronisasi: ' + e.message);
        btn.disabled = false;
        btn.innerHTML = originalText || '<i class="fas fa-sync-alt"></i> Sync Data';
    }
}


// Initializers
function calculateInitialCenter(devices) {
    let lat = 0, lng = 0, count = 0;
    devices.forEach(d => {
        if (d.latitude && d.longitude) {
            lat += parseFloat(d.latitude);
            lng += parseFloat(d.longitude);
            count++;
        }
    });
    return count > 0 ? { lat: lat / count, lng: lng / count, zoom: 13 } : { lat: -6.2088, lng: 106.8456, zoom: 13 };
}

document.addEventListener('DOMContentLoaded', initMap);
