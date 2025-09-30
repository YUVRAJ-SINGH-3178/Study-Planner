// static/app.js
// Smart Study Planner - enhanced UI/UX
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
let latestSchedule = null;
let undoStack = [];
let subjectNotes = {}; // persisted in localStorage
let pomState = {running:false, seconds:25*60, timerId:null};

// helper: create subject row
function createSubjectRow(name='', hours=2, priority=3){
  const row = document.createElement('div');
  row.className = 'd-flex gap-2 mb-2 align-items-center';
  row.innerHTML = `
    <input class="form-control form-control-sm subj-name" placeholder="Subject" value="${name}" style="flex:1"/>
    <input type="number" min="0" step="0.5" class="form-control form-control-sm subj-hours" value="${hours}" style="width:90px"/>
    <select class="form-select form-select-sm subj-prio" style="width:110px">
      <option value="1">1</option><option value="2">2</option><option value="3" selected>3</option><option value="4">4</option><option value="5">5</option>
    </select>
    <button class="btn btn-sm btn-outline-secondary btn-notes" title="Notes">📝</button>
    <button class="btn btn-sm btn-danger remove-subj">✕</button>
  `;
  row.querySelector('.remove-subj').addEventListener('click', ()=>row.remove());
  row.querySelector('.btn-notes').addEventListener('click', ()=>openNotesModal(row.querySelector('.subj-name').value));
  return row;
}

function init() {
  // elements
  const subjectRows = document.getElementById('subjectRows');
  const addBtn = document.getElementById('addSubjectBtn');
  addBtn.addEventListener('click', ()=> subjectRows.appendChild(createSubjectRow()));

  const autoSuggestBtn = document.getElementById('autoSuggestBtn');
  autoSuggestBtn.addEventListener('click', autoSuggestPriorities);

  // default subjects
  if (!subjectRows.childElementCount){
    subjectRows.appendChild(createSubjectRow('Math',4,4));
    subjectRows.appendChild(createSubjectRow('Physics',3,3));
  }

  // daily inputs
  const dailyInputs = document.getElementById('dailyInputs');
  for (let d of DAYS){
    const wrapper = document.createElement('div');
    wrapper.className = 'd-flex gap-2 align-items-center';
    wrapper.innerHTML = `<label style="width:80px">${d}</label><input class="form-control form-control-sm day-hrs" data-day="${d}" type="number" min="0" max="12" step="0.5" value="3" />`;
    dailyInputs.appendChild(wrapper);
  }

  // buttons
  document.getElementById('generateBtn').addEventListener('click', generateSchedule);
  document.getElementById('regenBtn').addEventListener('click', () => { generateSchedule(true); });
  document.getElementById('downloadCSV').addEventListener('click', downloadCSV);
  document.getElementById('downloadICS').addEventListener('click', downloadICS);
  document.getElementById('loadLatest').addEventListener('click', loadLatest);
  document.getElementById('clearLocal').addEventListener('click', ()=> { localStorage.clear(); location.reload(); });

  document.getElementById('compactToggle').addEventListener('change', (e)=>{
    document.getElementById('scheduleContainer').classList.toggle('compact', e.target.checked);
  });

  // theme toggle
  const themeBtn = document.getElementById('themeToggle');
  themeBtn.addEventListener('click', toggleTheme);
  applySavedTheme();

  // Pomodoro
  document.getElementById('pomStart').addEventListener('click', pomStart);
  document.getElementById('pomPause').addEventListener('click', pomPause);
  document.getElementById('pomReset').addEventListener('click', pomReset);
  document.addEventListener('keydown', (e)=> {
    if (e.key === 'P' || e.key === 'p') togglePom();
    if (e.key === 'G' || e.key === 'g') generateSchedule();
  });

  // Undo/clear
  document.getElementById('undoBtn').addEventListener('click', undoMove);
  document.getElementById('clearSchedule').addEventListener('click', ()=> { latestSchedule = {}; renderSchedule(latestSchedule); });

  // load notes
  const notesJson = localStorage.getItem('ssp-subject-notes');
  if (notesJson) subjectNotes = JSON.parse(notesJson);

  // init modal save
  document.getElementById('saveNotes').addEventListener('click', ()=>{
    const title = document.getElementById('notesTitle').textContent;
    const key = title.replace('Notes: ','');
    const val = document.getElementById('notesArea').value || '';
    if (key) {
      subjectNotes[key] = val;
      localStorage.setItem('ssp-subject-notes', JSON.stringify(subjectNotes));
      showInlineAlert('Notes saved', 'success');
    }
  });

  // load latest plan automatically if possible
  loadLatest();
}

// collect subject/day inputs
function collectInputs() {
  const subjects = [];
  document.querySelectorAll('#subjectRows > div').forEach(r=>{
    const name = r.querySelector('.subj-name').value.trim();
    const hours = parseFloat(r.querySelector('.subj-hours').value) || 0;
    const priority = parseInt(r.querySelector('.subj-prio').value) || 3;
    if (name && hours>0) subjects.push({name, hours, priority});
  });
  const daily_avail = {};
  document.querySelectorAll('.day-hrs').forEach(inp => daily_avail[inp.dataset.day] = parseFloat(inp.value) || 0);
  return {subjects, daily_avail};
}

async function generateSchedule(regen=false){
  const planName = document.getElementById('planName').value || 'My Plan';
  const slotSize = parseFloat(document.getElementById('slotSize').value || '1');
  const startHour = parseInt(document.getElementById('startHour').value || 8);
  const {subjects, daily_avail} = collectInputs();
  if (!subjects.length){ showInlineAlert('Add at least one subject','danger'); return; }

  // if regen and we have latestSchedule, reuse subjects and just call generate
  const payload = {plan_name: planName, subjects, daily_availability: daily_avail, slot_size: slotSize, start_hour: startHour};
  showInlineAlert('Generating schedule...','info');
  try {
    const res = await fetch('/api/generate', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
    const data = await res.json();
    if (data.ok) {
      latestSchedule = data.schedule;
      undoStack = [];
      renderSchedule(latestSchedule);
      showInlineAlert('Schedule generated', 'success');
    } else {
      showInlineAlert('Server error generating schedule', 'danger');
    }
  } catch (err) {
    console.error(err);
    showInlineAlert('Network error generating schedule', 'danger');
  }
}

// render schedule (grid) with drag/drop
function renderSchedule(schedule){
  latestSchedule = schedule || {};
  const container = document.getElementById('scheduleContainer');

  // table hours: depend on compact vs slot size (use startHour and slot size roughly)
  const startHour = parseInt(document.getElementById('startHour').value || 8);
  const slotSize = parseFloat(document.getElementById('slotSize').value || 1);

  // show grid with rows for each hour from startHour to startHour+10 (adjustable)
  const rows = 12; // 12 rows (12*slotSize hours)
  const tbl = document.createElement('table');
  tbl.className = 'table table-bordered table-schedule';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.innerHTML = `<th style="width:72px">Time</th>` + DAYS.map(d=>`<th>${d}</th>`).join('');
  thead.appendChild(headRow);
  tbl.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (let r=0; r<rows; r++){
    const hour = startHour + Math.floor(r*slotSize);
    const th = document.createElement('th');
    th.textContent = `${hour}:00`;
    const tr = document.createElement('tr');
    tr.appendChild(th);
    for (let d of DAYS){
      const td = document.createElement('td');
      td.dataset.day = d;
      td.dataset.row = r;
      td.style.minWidth = '110px';
      // enable drop events
      td.addEventListener('dragover', e => { e.preventDefault(); td.classList.add('drop-hover'); });
      td.addEventListener('dragleave', e => { td.classList.remove('drop-hover'); });
      td.addEventListener('drop', e => {
        e.preventDefault();
        td.classList.remove('drop-hover');
        const subjName = e.dataTransfer.getData('text/plain');
        if (!subjName) return;
        // push current state to undo
        undoStack.push(JSON.stringify(latestSchedule));
        // place at this slot (simple append)
        if (!latestSchedule[d]) latestSchedule[d] = [];
        latestSchedule[d].push({start: startHour + r*slotSize, duration: slotSize, subject: subjName});
        renderSchedule(latestSchedule);
      });
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  tbl.appendChild(tbody);
  container.innerHTML = '';
  container.appendChild(tbl);

  // place blocks
  for (let d of DAYS){
    const blocks = (latestSchedule && latestSchedule[d]) ? latestSchedule[d] : [];
    for (let b of blocks){
      const start = Number(b.start);
      const dur = Math.max(1, Math.round(b.duration / slotSize));
      const rowIndex = Math.round((start - startHour) / slotSize);
      if (rowIndex < 0 || rowIndex >= rows) continue;
      const targetCell = container.querySelector(`td[data-day="${d}"][data-row="${rowIndex}"]`);
      if (targetCell){
        // create a pill
        const pill = document.createElement('div');
        const safeName = b.subject.replace(/\s+/g,'-');
        pill.className = `subject-pill sub-Default ${safeName}`;
        pill.draggable = true;
        pill.textContent = b.subject;
        pill.title = 'Drag me to another slot. Click for notes.';
        pill.addEventListener('dragstart', (e)=> e.dataTransfer.setData('text/plain', b.subject));
        pill.addEventListener('click', ()=> openNotesModal(b.subject));
        // remove existing content or append
        targetCell.appendChild(pill);
      }
    }
  }

  // add color mapping per subject (generate classes)
  // simple mapping: create dynamic style if not exists
  ensureSubjectStyles();
}

function ensureSubjectStyles(){
  // check existing unique subjects
  const names = new Set();
  if (latestSchedule) {
    for (let d of DAYS){
      (latestSchedule[d]||[]).forEach(b => names.add(b.subject));
    }
  }
  names.forEach((n, i) => {
    const safe = n.replace(/\s+/g,'-');
    if (!document.querySelector(`style[data-sub="${safe}"]`)) {
      // generate color
      const hue = (i*47) % 360;
      const css = `.sub-${safe}{ background: linear-gradient(90deg, hsl(${hue} 75% 55%), hsl(${(hue+40)%360} 75% 40%)); }`;
      const tag = document.createElement('style'); tag.dataset.sub = safe; tag.innerHTML = css;
      document.head.appendChild(tag);
    }
  });
}

// drag starting from subject rows (allow dragging subject names into grid quickly)
function wireSubjectRowDraggables(){
  document.querySelectorAll('#subjectRows .subj-name').forEach(inp=>{
    inp.setAttribute('draggable', true);
    inp.addEventListener('dragstart', e => {
      const val = inp.value.trim();
      if (!val) { e.preventDefault(); return; }
      e.dataTransfer.setData('text/plain', val);
    });
  });
}

// download handlers
async function downloadCSV(){
  if (!latestSchedule) { showInlineAlert('Generate schedule first','warning'); return; }
  const res = await fetch('/api/export/csv', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({schedule: latestSchedule})});
  if (res.ok){
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'schedule.csv'; document.body.appendChild(a); a.click(); a.remove();
    showInlineAlert('CSV downloaded','success');
  } else showInlineAlert('CSV export failed','danger');
}

async function downloadICS(){
  if (!latestSchedule) { showInlineAlert('Generate schedule first','warning'); return; }
  const res = await fetch('/api/export/ics', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({schedule: latestSchedule})});
  if (res.ok){
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'schedule.ics'; document.body.appendChild(a); a.click(); a.remove();
    showInlineAlert('ICS downloaded','success');
  } else showInlineAlert('ICS export failed','danger');
}

async function loadLatest(){
  try {
    const res = await fetch('/api/load/latest');
    if (!res.ok) return;
    const j = await res.json();
    if (j.ok && j.plan){
      // populate UI
      const plan = j.plan;
      document.getElementById('planName').value = plan.name || 'Loaded Plan';
      // clear subjects
      document.getElementById('subjectRows').innerHTML = '';
      (plan.subjects || []).forEach(s => {
        const row = createSubjectRow(s.name || s.subject || s['name'], s.hours || s['hours'] || 2, s.priority || 3);
        document.getElementById('subjectRows').appendChild(row);
      });
      // daily
      Object.keys(plan.daily_availability || {}).forEach(d => {
        const inp = document.querySelector(`.day-hrs[data-day="${d}"]`);
        if (inp) inp.value = plan.daily_availability[d];
      });
      latestSchedule = plan.schedule;
      renderSchedule(latestSchedule);
      showInlineAlert('Loaded latest plan','success');
      wireSubjectRowDraggables();
    }
  } catch (err) { console.error(err); }
}

// Notes modal
function openNotesModal(subject){
  document.getElementById('notesTitle').textContent = `Notes: ${subject}`;
  document.getElementById('notesArea').value = subjectNotes[subject] || '';
  // show bootstrap modal
  const modalEl = document.getElementById('notesModal');
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

// undo
function undoMove(){
  if (!undoStack.length) { showInlineAlert('Nothing to undo','info'); return; }
  const prev = undoStack.pop();
  latestSchedule = JSON.parse(prev);
  renderSchedule(latestSchedule);
  showInlineAlert('Undone','success');
}

// simple little inline alert
function showInlineAlert(msg, kind='info'){
  const container = document.querySelector('.card .card-body');
  // quick floating alert on top-left of page
  const el = document.createElement('div');
  el.className = `alert alert-${kind} alert-inline position-fixed animate__animated animate__fadeInDown`;
  el.style.top = '10px'; el.style.right = '10px'; el.style.zIndex = 9999;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(()=> el.classList.replace('animate__fadeInDown','animate__fadeOutUp'), 1200);
  setTimeout(()=> el.remove(), 2000);
}

// Pomodoro logic
function pomUpdateDisplay(){
  const m = Math.floor(pomState.seconds/60).toString().padStart(2,'0');
  const s = (pomState.seconds%60).toString().padStart(2,'0');
  document.getElementById('pomTimer').textContent = `${m}:${s}`;
}
function pomTick(){
  if (pomState.seconds <=0){ pomPause(); showInlineAlert('Pomodoro finished','success'); return; }
  pomState.seconds -= 1;
  pomUpdateDisplay();
}
function pomStart(){
  if (pomState.running) return;
  pomState.running = true;
  pomState.timerId = setInterval(pomTick, 1000);
}
function pomPause(){
  if (!pomState.running) return;
  pomState.running = false;
  clearInterval(pomState.timerId);
  pomState.timerId = null;
}
function pomReset(){
  pomPause();
  pomState.seconds = 25*60;
  pomUpdateDisplay();
}
function togglePom(){
  if (pomState.running) pomPause(); else pomStart();
}
pomUpdateDisplay();

// Theme toggle
function toggleTheme(){
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('ssp-theme-dark', isDark ? '1' : '0');
  document.getElementById('themeToggle').textContent = isDark ? '☀️' : '🌙';
}
function applySavedTheme(){
  const v = localStorage.getItem('ssp-theme-dark');
  if (v === '1') { document.body.classList.add('dark'); document.getElementById('themeToggle').textContent = '☀️'; }
  else { document.body.classList.remove('dark'); document.getElementById('themeToggle').textContent = '🌙'; }
}

// auto-suggest priorities (simple: higher hours => higher priority)
function autoSuggestPriorities(){
  const rows = document.querySelectorAll('#subjectRows > div');
  let maxHours = 0;
  rows.forEach(r => { const h = parseFloat(r.querySelector('.subj-hours').value) || 0; if (h > maxHours) maxHours = h; });
  rows.forEach(r => {
    const h = parseFloat(r.querySelector('.subj-hours').value) || 0;
    let p = 3;
    if (h >= maxHours * 0.9) p = 5;
    else if (h >= maxHours * 0.6) p = 4;
    else if (h >= maxHours * 0.3) p = 3;
    else p = 2;
    r.querySelector('.subj-prio').value = p;
  });
  showInlineAlert('Priorities suggested','info');
}

// create at least one subject row before binding draggables
window.addEventListener('DOMContentLoaded', ()=>{
  init();
  // small delay then wire draggables
  setTimeout(()=> wireSubjectRowDraggables(), 400);
});
