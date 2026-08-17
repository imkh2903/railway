const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

async function api(url, opts = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...opts });
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) {
    if (response.status === 401 && location.pathname.startsWith('/admin')) {
      location.href = '/admin/login';
      return new Promise(() => {});
    }
    throw new Error(data.error || data.message || `Request gagal (${response.status})`);
  }
  return data;
}

function esc(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, (m) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[m]));
}
function fmtDate(value) {
  if (!value) return '-';
  const d = String(value).includes('T') ? new Date(value) : new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '-' : new Intl.DateTimeFormat('id-ID', { day:'2-digit', month:'long', year:'numeric' }).format(d);
}
function eventMarkup(e) {
  const d = new Date(`${e.date || '1970-01-01'}T00:00:00`);
  return `<article class="event glass"><div class="date-box"><small>${d.toLocaleDateString('id-ID',{month:'short'}).toUpperCase()}</small><b>${d.getDate()}</b></div><div><span class="badge">${esc(e.category || 'Kegiatan')}</span><h3>${esc(e.title || 'Tanpa judul')}</h3><div class="muted">${esc(e.time || '')}${e.location ? ` · ${esc(e.location)}` : ''}</div></div><a class="btn" href="agenda.html">Detail</a></article>`;
}

function parseLocalDate(value) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function monthLabel(date) { return new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric'}).format(date); }
function dayLabel(date) { return new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(date); }
function sameDayKey(a,b) { return a && b && dateKey(a)===dateKey(b); }
function agendaDateTime(event) {
  const d=parseLocalDate(event?.date); if(!d) return Number.MAX_SAFE_INTEGER;
  const [h,m]=String(event.time||'00:00').split(':').map(Number); d.setHours(Number.isFinite(h)?h:0,Number.isFinite(m)?m:0,0,0); return d.getTime();
}
function agendaCalendarMarkup(root, rawEvents, opts={}) {
  const events=(Array.isArray(rawEvents)?rawEvents:[]).map(e=>({...e,dateKey:String(e.date||'').slice(0,10)})).filter(e=>/^\d{4}-\d{2}-\d{2}$/.test(e.dateKey));
  const byDate=new Map(); events.forEach(e=>{if(!byDate.has(e.dateKey))byDate.set(e.dateKey,[]);byDate.get(e.dateKey).push(e);}); byDate.forEach(v=>v.sort((a,b)=>agendaDateTime(a)-agendaDateTime(b)));
  const today=new Date(); today.setHours(0,0,0,0); const keys=[...byDate.keys()].sort(); const firstUpcoming=keys.find(k=>k>=dateKey(today))||keys[0]||dateKey(today);
  let selectedKey=opts.selectedDate||firstUpcoming; let selectedDate=parseLocalDate(selectedKey)||today; let viewMonth=new Date(selectedDate.getFullYear(),selectedDate.getMonth(),1);
  root.innerHTML=`<div class="agenda-calendar glass"><aside class="agenda-side"><div class="agenda-side-top"><span class="badge">Agenda terdekat</span><span class="agenda-side-count" data-agenda-count></span></div><div class="agenda-selected-date" data-selected-date></div><div class="agenda-selected-day" data-selected-day></div><div class="agenda-upcoming" data-upcoming></div><button class="btn agenda-more" type="button" data-all-events>Semua agenda →</button></aside><section class="agenda-main"><div class="agenda-calendar-head"><button class="btn btn-icon" type="button" data-prev aria-label="Bulan sebelumnya">‹</button><div><div class="eyebrow">Kalender kegiatan</div><h3 data-month></h3></div><button class="btn btn-icon" type="button" data-next aria-label="Bulan berikutnya">›</button></div><div class="agenda-weekdays">${['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(x=>`<span>${x}</span>`).join('')}</div><div class="agenda-days" data-days></div><div class="agenda-legend"><span><i class="agenda-dot"></i> Ada agenda</span><span><i class="agenda-dot agenda-dot-selected"></i> Dipilih</span></div><div class="agenda-detail" data-detail></div></section></div>`;
  const monthEl=root.querySelector('[data-month]'),daysEl=root.querySelector('[data-days]'),sideDate=root.querySelector('[data-selected-date]'),sideDay=root.querySelector('[data-selected-day]'),upcomingEl=root.querySelector('[data-upcoming]'),countEl=root.querySelector('[data-agenda-count]'),detailEl=root.querySelector('[data-detail]');
  function render(){
    monthEl.textContent=monthLabel(viewMonth); const y=viewMonth.getFullYear(),m=viewMonth.getMonth(),first=new Date(y,m,1),offset=(first.getDay()+6)%7,total=new Date(y,m+1,0).getDate(),prevTotal=new Date(y,m,0).getDate(); const cells=[];
    for(let i=0;i<42;i++){const n=i-offset+1;let d,muted=false;if(n<1){d=new Date(y,m-1,prevTotal+n);muted=true}else if(n>total){d=new Date(y,m+1,n-total);muted=true}else d=new Date(y,m,n);const k=dateKey(d),xs=byDate.get(k)||[];cells.push(`<button type="button" class="agenda-day${muted?' is-muted':''}${k===selectedKey?' is-selected':''}${sameDayKey(d,today)?' is-today':''}${xs.length?' has-events':''}" data-date="${k}" aria-label="${esc(dayLabel(d))}${xs.length?`, ${xs.length} agenda`:''}"><span>${d.getDate()}</span>${xs.length?`<i class="agenda-dot" aria-hidden="true"></i>${xs.length>1?`<em>${xs.length}</em>`:''}`:''}</button>`)}
    daysEl.innerHTML=cells.join(''); daysEl.querySelectorAll('[data-date]').forEach(btn=>btn.addEventListener('click',()=>{selectedKey=btn.dataset.date;const d=parseLocalDate(selectedKey);if(d&&(d.getMonth()!==m||d.getFullYear()!==y))viewMonth=new Date(d.getFullYear(),d.getMonth(),1);render();}));
    const selected=parseLocalDate(selectedKey)||today,xs=byDate.get(selectedKey)||[];sideDate.textContent=new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short'}).format(selected).toUpperCase();sideDay.textContent=new Intl.DateTimeFormat('id-ID',{weekday:'long'}).format(selected);countEl.textContent=`${xs.length} agenda`;
    const upcoming=events.filter(e=>e.dateKey>=dateKey(today)).sort((a,b)=>agendaDateTime(a)-agendaDateTime(b)).slice(0,4);upcomingEl.innerHTML=upcoming.length?upcoming.map(e=>{const d=parseLocalDate(e.dateKey);return `<button type="button" class="agenda-mini" data-mini-date="${e.dateKey}"><span class="agenda-mini-date"><b>${d.getDate()}</b><small>${new Intl.DateTimeFormat('id-ID',{month:'short'}).format(d).toUpperCase()}</small></span><span><strong>${esc(e.title||'Tanpa judul')}</strong><small>${esc(e.time||'')}${e.location?` · ${esc(e.location)}`:''}</small></span></button>`}).join(''):'<p class="muted">Belum ada agenda terdekat.</p>';
    upcomingEl.querySelectorAll('[data-mini-date]').forEach(btn=>btn.addEventListener('click',()=>{selectedKey=btn.dataset.miniDate;const d=parseLocalDate(selectedKey);viewMonth=new Date(d.getFullYear(),d.getMonth(),1);render();}));
    detailEl.innerHTML=xs.length?xs.map(e=>`<article class="agenda-detail-item"><span class="badge">${esc(e.category||'Kegiatan')}</span><h4>${esc(e.title||'Tanpa judul')}</h4><p class="muted">${esc(e.time||'Waktu belum diatur')}${e.location?` · ${esc(e.location)}`:''}</p>${e.description?`<p class="muted agenda-description">${esc(e.description)}</p>`:''}</article>`).join(''):'<div class="agenda-detail-empty"><strong>Tidak ada agenda pada tanggal ini.</strong><span>Pilih tanggal lain yang memiliki penanda.</span></div>';
  }
  root.querySelector('[data-prev]').addEventListener('click',()=>{viewMonth=new Date(viewMonth.getFullYear(),viewMonth.getMonth()-1,1);render();}); root.querySelector('[data-next]').addEventListener('click',()=>{viewMonth=new Date(viewMonth.getFullYear(),viewMonth.getMonth()+1,1);render();}); root.querySelector('[data-all-events]').addEventListener('click',()=>{location.href='agenda.html';}); render();
}

function toast(message, ok = true) {
  const el = document.createElement('div');
  el.className = `toast glass ${ok ? '' : 'toast-error'}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
function showLoadError(target, message = 'Data gagal dimuat. Coba refresh halaman.') {
  const el = typeof target === 'string' ? $(target) : target;
  if (el) el.innerHTML = `<div class="card glass"><p class="muted">${esc(message)}</p></div>`;
}

function trackPageView() {
  if (location.pathname.startsWith('/admin')) return;
  fetch('/api/analytics/hit', { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body:JSON.stringify({page:location.pathname}) }).catch(() => {});
}
document.addEventListener('DOMContentLoaded', trackPageView);

function validClientUrl(value=''){try{const u=new URL(String(value||''),location.href);return ['http:','https:'].includes(u.protocol)}catch{return false}}
