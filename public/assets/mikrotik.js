function applyStatus(json){
  const panel = document.getElementById('mt-status-panel');
  if(!panel) return;
  const statusEl = panel.querySelector('.text-xs');
  if(json.ok){
    statusEl.textContent = 'Terhubung';
    statusEl.className = 'text-xs text-emerald-700';
  } else {
    statusEl.textContent = 'Terputus';
    statusEl.className = 'text-xs text-rose-700';
  }
  if(json.info){
    const container = document.createElement('div');
    container.className = 'mt-4 space-y-2 text-sm';
    container.innerHTML = `
      <div class="flex justify-between"><span class="text-slate-500">Identity</span><span class="text-slate-900">${json.info.identity||'-'}</span></div>
      <div class="flex justify-between"><span class="text-slate-500">Version</span><span class="text-slate-900">${json.info.version||'-'}</span></div>
      <div class="flex justify-between"><span class="text-slate-500">Uptime</span><span class="text-slate-900">${json.info.uptime||'-'}</span></div>
      <div class="flex justify-between"><span class="text-slate-500">CPU Load</span><span class="text-slate-900">${json.info.cpuLoad||'-'}%</span></div>
      <div class="flex justify-between"><span class="text-slate-500">Mem (free/total)</span><span class="text-slate-900">${json.info.freeMemory||'-'} / ${json.info.totalMemory||'-'}</span></div>
    `;
    const oldDetails = panel.querySelector('.mt-4.space-y-2.text-sm');
    if(oldDetails) oldDetails.remove();
    panel.appendChild(container);
  }
}

async function doTest(silent){
  const form = document.getElementById('mt-form');
  if(!form) return;
  const data = new FormData(form);
  const body = Object.fromEntries(data.entries());
  if(!('use_tls' in body)) body.use_tls = false;
  const res = await fetch('/settings/mikrotik/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json();
  if(!silent){
    alert(json.ok ? 'Koneksi berhasil' : ('Gagal: ' + (json.error||'')));
  }
  applyStatus(json);
}

document.addEventListener('DOMContentLoaded', ()=>{
  const btn = document.getElementById('mt-test');
  if (btn) btn.addEventListener('click', (ev)=>{ ev.preventDefault(); doTest(false); });
  doTest(true);
});

