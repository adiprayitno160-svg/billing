const socket = io();
const terminal = document.getElementById('terminal');
const ontList = document.getElementById('ont-list');

socket.on('log', (msg) => {
    const line = document.createElement('div');
    line.className = 'line';
    if (msg.startsWith('>>')) line.className += ' cmd';
    if (msg.includes('SUCCESS')) line.className += ' success';
    if (msg.includes('ERROR')) line.className += ' error';

    line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
});

socket.on('ont-found', (onts) => {
    ontList.innerHTML = '';
    if (onts.length === 0) {
        ontList.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-dim);">No new ONT found.</td></tr>';
        return;
    }

    onts.forEach(ont => {
        const row = `
            <tr class="animate-fade">
                <td>${ont.interface}</td>
                <td style="font-family: monospace; color: var(--primary);">${ont.sn}</td>
                <td>${ont.type}</td>
                <td>
                    <button class="btn btn-primary" onclick="openApproveModal('${ont.sn}', '${ont.interface}')">Approve</button>
                </td>
            </tr>
        `;
        ontList.innerHTML += row;
    });
});

function scanOnt() {
    socket.emit('scan-ont');
    const btn = event.target;
    btn.disabled = true;
    btn.textContent = 'Scanning...';
    setTimeout(() => {
        btn.disabled = false;
        btn.textContent = 'Refresh Scan';
    }, 3000);
}

function openApproveModal(sn, iface) {
    document.getElementById('modal-sn').value = sn;
    document.getElementById('modal-interface').value = iface;
    document.getElementById('approve-modal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('approve-modal').style.display = 'none';
}

document.getElementById('approve-form').onsubmit = (e) => {
    e.preventDefault();
    const data = {
        sn: document.getElementById('modal-sn').value,
        interface: document.getElementById('modal-interface').value,
        customerName: document.getElementById('customer-name').value,
        vlan: document.getElementById('vlan-id').value
    };

    socket.emit('approve-ont', data);
    closeModal();
};

// Initial scan
setTimeout(scanOnt, 1000);
