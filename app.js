'use strict';
/* ============================================================
   GymTrack - registro de entrenos sin backend, todo localStorage
   ============================================================ */

const LS_KEYS = {
  routine: 'routine', sessions: 'sessions', drafts: 'drafts',
  settings: 'settings', backup: 'lastBackup', routineVer: 'routineVersion',
};
// Subir este número reemplaza la rutina guardada por la rutina precargada (una sola vez)
const ROUTINE_VERSION = 2;

/* ---------- Rutina precargada ---------- */
function defaultRoutine() {
  const mk = (id, nombre, series, repMin, repMax) => ({ id, nombre, series, repMin, repMax });
  return {
    dias: [
      { id: 'lun', nombre: 'Lunes', ejercicios: [
        mk('e-press-inclinado', 'Press inclinado', 3, 6, 10),
        mk('e-aperturas', 'Aperturas en máquina o polea', 2, 10, 12),
        mk('e-jalon-prono', 'Jalón al pecho prono', 3, 8, 12),
        mk('e-remo-maquina-separados', 'Remo en máquina, codos separados del torso', 3, 8, 10),
        mk('e-elev-laterales-polea', 'Elevaciones laterales en polea', 3, 10, 15),
        mk('e-curl-bayesiano', 'Curl bayesiano', 3, 8, 12),
        mk('e-triceps-sobre-cabeza', 'Extensión de tríceps sobre la cabeza', 2, 10, 12),
      ]},
      { id: 'mar', nombre: 'Martes', ejercicios: [
        mk('e-sentadilla-smith', 'Sentadilla en Smith', 3, 6, 10),
        mk('e-extension-cuadriceps', 'Extensiones de cuádriceps', 2, 10, 12),
        mk('e-curl-femoral-sentado', 'Curl femoral sentado', 3, 8, 12),
        mk('e-peso-muerto-rumano', 'Peso muerto rumano', 2, 8, 10),
        mk('e-gemelos', 'Gemelos', 2, 10, 12),
        mk('e-elev-laterales', 'Elevaciones laterales', 2, 12, 20),
        mk('e-abdominales', 'Abdominales', 2, 12, 15),
      ]},
      { id: 'jue', nombre: 'Jueves', ejercicios: [
        mk('e-press-inclinado', 'Press inclinado', 3, 6, 10),
        mk('e-press-plano', 'Press plano', 2, 8, 10),
        mk('e-remo-codos-cerrados', 'Remo codos cerrados', 3, 8, 10),
        mk('e-jalon-neutro', 'Jalón agarre neutro', 3, 8, 12),
        mk('e-remo-abierto', 'Remo abierto', 3, 8, 10),
        mk('e-elev-laterales', 'Elevaciones laterales', 3, 10, 15),
        mk('e-curl-predicador', 'Curl predicador', 3, 8, 12),
        mk('e-extension-triceps', 'Extensión de tríceps', 3, 10, 12),
      ]},
      { id: 'vie', nombre: 'Viernes', ejercicios: [
        mk('e-prensa', 'Prensa', 3, 8, 10),
        mk('e-curl-femoral-acostado', 'Curl femoral acostado', 4, 8, 12),
        mk('e-sentadilla', 'Sentadilla', 3, 6, 10),
        mk('e-extension-cuadriceps', 'Extensiones de cuádriceps', 3, 10, 15),
        mk('e-gemelos', 'Gemelos', 3, 10, 12),
        mk('e-abdominales', 'Abdominales', 3, 12, 15),
        mk('e-curl-martillo', 'Curl martillo', 2, 8, 12),
        mk('e-triceps-polea', 'Extensión de tríceps en polea', 2, 10, 12),
      ]},
    ],
  };
}

/* ---------- Helpers ---------- */
const load = (key, fallback) => {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; }
  catch { return fallback; }
};
const save = (key, val) => {
  try { localStorage.setItem(key, JSON.stringify(val)); }
  catch { toast('⚠ No se pudo guardar (almacenamiento lleno o bloqueado)'); }
};
const $ = (sel) => document.querySelector(sel);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const todayStr = () => new Date().toLocaleDateString('sv'); // YYYY-MM-DD local
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}
const hasNum = (v) => v !== '' && v !== null && v !== undefined;

/* ---------- Estado ---------- */
let routine = load(LS_KEYS.routine, null);
if (!routine || !routine.dias || load(LS_KEYS.routineVer, 0) < ROUTINE_VERSION) {
  routine = defaultRoutine();
  save(LS_KEYS.routine, routine);
  save(LS_KEYS.routineVer, ROUTINE_VERSION);
}
let sessions = load(LS_KEYS.sessions, []);
let drafts = load(LS_KEYS.drafts, {});
if (Array.isArray(drafts) || typeof drafts !== 'object') drafts = {};
let settings = Object.assign({ restSec: 120, autoTimer: true }, load(LS_KEYS.settings, {}));

let currentDayId = routine.dias[0].id;
let currentData = [];

function dayById(id) { return routine.dias.find(d => d.id === id); }
function exById(dayId, exId) { return dayById(dayId)?.ejercicios.find(e => e.id === exId); }

function fmtFecha(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function fmtCorta(iso) { return iso.slice(8, 10) + '/' + iso.slice(5, 7); }

/* ---------- Toast ---------- */
let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2000);
}

/* ---------- Modales: cerrar tocando el fondo ---------- */
document.querySelectorAll('.modal').forEach(m => {
  m.addEventListener('click', (e) => { if (e.target === m) m.classList.add('hidden'); });
});

/* ============================================================
   PESTAÑAS
   ============================================================ */
function showTab(name) {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
  window.scrollTo(0, 0);
  if (name === 'historial') renderHistory();
  if (name === 'progreso') renderProgressSelect();
}
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => showTab(btn.dataset.tab));
});

/* ============================================================
   TAB ENTRENO
   ============================================================ */
const emptySet = () => ({ peso: '', reps: '', aproximacion: false, hecha: false });
const draftKey = (dayId, fecha) => dayId + '|' + fecha;
function getFecha() { return $('#dateInput').value || todayStr(); }
function findSession(dayId, fecha) { return sessions.find(s => s.diaId === dayId && s.fecha === fecha); }

function lastSessionForExercise(dayId, exId, beforeFecha) {
  return sessions
    .filter(s => s.diaId === dayId && s.fecha < beforeFecha && s.ejercicios.some(e => e.ejercicioId === exId))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))[0] || null;
}

/* Datos de trabajo: borrador > sesión guardada > estructura vacía */
function getData(dayId, fecha) {
  const day = dayById(dayId);
  let data = drafts[draftKey(dayId, fecha)];
  if (!data) {
    const ex = findSession(dayId, fecha);
    data = ex ? JSON.parse(JSON.stringify(ex.ejercicios)) : [];
  }
  day.ejercicios.forEach(ex => {
    let d = data.find(x => x.ejercicioId === ex.id);
    if (!d) { d = { ejercicioId: ex.id, series: Array.from({ length: ex.series }, emptySet) }; data.push(d); }
    d.series.forEach(s => { if (s.hecha === undefined) s.hecha = hasNum(s.peso) && hasNum(s.reps); });
  });
  return data;
}

function persistDraft() {
  drafts[draftKey(currentDayId, getFecha())] = currentData;
  save(LS_KEYS.drafts, drafts);
}

function renderDayButtons() {
  const wrap = $('#dayButtons');
  wrap.innerHTML = '';
  const fecha = getFecha();
  routine.dias.forEach(d => {
    const has = !!findSession(d.id, fecha);
    const b = el('button', 'day-btn' + (d.id === currentDayId ? ' selected' : '') + (has ? ' has-session' : ''),
      d.nombre + (has ? ' ✓' : ''));
    b.addEventListener('click', () => { currentDayId = d.id; renderDayButtons(); renderExercises(); });
    wrap.appendChild(b);
  });
}

function updateProgressBar() {
  let total = 0, done = 0;
  currentData.forEach(ex => ex.series.forEach(s => {
    total++;
    if (hasNum(s.peso) && hasNum(s.reps)) done++;
  }));
  $('#progressText').textContent = `${done}/${total} series`;
  $('#pbarFill').style.width = (total ? Math.round(done / total * 100) : 0) + '%';
}

function renderExercises() {
  const list = $('#exerciseList');
  list.innerHTML = '';
  const day = dayById(currentDayId);
  const fecha = getFecha();
  currentData = getData(currentDayId, fecha);
  $('#btnSave').textContent = findSession(currentDayId, fecha) ? 'Actualizar' : 'Guardar';

  day.ejercicios.forEach(ex => {
    const exData = currentData.find(d => d.ejercicioId === ex.id);
    const last = lastSessionForExercise(currentDayId, ex.id, fecha);
    const prev = last ? last.ejercicios.find(e => e.ejercicioId === ex.id) : null;
    const prevSets = prev ? prev.series.filter(s => hasNum(s.peso) || hasNum(s.reps)) : [];
    const phFor = (i) => prevSets[i] || prevSets[prevSets.length - 1] || null;

    const card = el('div', 'ex-card');

    /* Encabezado */
    const header = el('div', 'ex-header');
    const nt = el('div');
    nt.appendChild(el('div', 'ex-name', ex.nombre));
    nt.appendChild(el('div', 'ex-target',
      `${ex.series} series · ${ex.repMin}${ex.repMax > ex.repMin ? '–' + ex.repMax : ''} reps`));
    header.appendChild(nt);

    /* Sugerencia de progresión */
    if (prev) {
      const efectivas = prev.series.filter(s => !s.aproximacion && hasNum(s.peso) && hasNum(s.reps));
      if (efectivas.length > 0 && efectivas.every(s => Number(s.reps) >= ex.repMax)) {
        header.appendChild(el('span', 'badge-up', '⬆ Subí el peso'));
      }
    }
    card.appendChild(header);

    /* Última vez */
    const lastLine = el('div', 'last-time');
    if (last) {
      const txt = prevSets
        .map(s => `${s.peso || 0}×${s.reps || 0}${s.aproximacion ? ' (aprox)' : ''}`)
        .join('  ·  ');
      lastLine.textContent = `Última vez (${fmtCorta(last.fecha)}): ${txt || '—'}`;
    } else {
      lastLine.textContent = 'Última vez: sin registros';
    }
    card.appendChild(lastLine);

    /* Series */
    const setsWrap = el('div', 'sets');
    function renderSets() {
      setsWrap.innerHTML = '';
      exData.series.forEach((set, i) => {
        const ph = phFor(i);
        const row = el('div', 'set-row' + (set.aproximacion ? ' aprox' : '') + (set.hecha ? ' done' : ''));
        row.innerHTML = `
          <span class="set-num"></span>
          <label class="fld"><input type="number" inputmode="decimal" min="0" step="0.5" class="in-peso"><span>kg</span></label>
          <label class="fld"><input type="number" inputmode="numeric" min="0" step="1" class="in-reps"><span>reps</span></label>
          <button type="button" class="done-btn" aria-label="Marcar serie hecha" title="Marcar hecha">✓</button>
          <label class="aprox-toggle" title="Serie de aproximación: no cuenta para la progresión">
            <input type="checkbox" class="in-aprox"><span>Aprox</span>
          </label>`;
        row.querySelector('.set-num').textContent = i + 1;
        const inPeso = row.querySelector('.in-peso');
        const inReps = row.querySelector('.in-reps');
        const inAprox = row.querySelector('.in-aprox');
        inPeso.value = set.peso;
        inReps.value = set.reps;
        inAprox.checked = set.aproximacion;
        inPeso.placeholder = ph && hasNum(ph.peso) ? ph.peso : '0';
        inReps.placeholder = ph && hasNum(ph.reps) ? ph.reps : '0';

        const changed = () => { persistDraft(); updateProgressBar(); };
        inPeso.addEventListener('input', () => { set.peso = inPeso.value.trim().replace(',', '.'); changed(); });
        inReps.addEventListener('input', () => { set.reps = inReps.value.trim().replace(',', '.'); changed(); });
        inAprox.addEventListener('change', () => {
          set.aproximacion = inAprox.checked;
          row.classList.toggle('aprox', set.aproximacion);
          persistDraft();
        });
        row.querySelector('.done-btn').addEventListener('click', () => {
          if (set.hecha) { set.hecha = false; }
          else {
            // Si no cargó nada, usa los valores de la última vez
            if (!hasNum(set.peso) && ph && hasNum(ph.peso)) set.peso = String(ph.peso);
            if (!hasNum(set.reps) && ph && hasNum(ph.reps)) set.reps = String(ph.reps);
            if (!hasNum(set.peso) || !hasNum(set.reps)) { toast('Cargá peso y reps primero'); return; }
            set.hecha = true;
            if (settings.autoTimer && !set.aproximacion) startTimer(settings.restSec);
          }
          renderSets(); persistDraft(); updateProgressBar();
        });
        setsWrap.appendChild(row);
      });
    }
    renderSets();
    card.appendChild(setsWrap);

    /* Acciones */
    const actions = el('div', 'ex-actions');
    const addBtn = el('button', 'add-set', '＋ Serie');
    addBtn.addEventListener('click', () => {
      exData.series.push(emptySet());
      renderSets(); persistDraft(); updateProgressBar();
    });
    actions.appendChild(addBtn);
    const rmBtn = el('button', 'add-set subtle', '－ Quitar');
    rmBtn.addEventListener('click', () => {
      if (exData.series.length <= 1) return;
      exData.series.pop();
      renderSets(); persistDraft(); updateProgressBar();
    });
    actions.appendChild(rmBtn);
    if (prevSets.length) {
      const copy = el('button', 'add-set subtle', '↺ Repetir última vez');
      copy.addEventListener('click', () => {
        prevSets.forEach((p, i) => {
          if (!exData.series[i]) exData.series.push(emptySet());
          const s = exData.series[i];
          if (!hasNum(s.peso) && !hasNum(s.reps)) s.aproximacion = !!p.aproximacion;
          if (!hasNum(s.peso)) s.peso = String(p.peso);
          if (!hasNum(s.reps)) s.reps = String(p.reps);
        });
        renderSets(); persistDraft(); updateProgressBar();
      });
      actions.appendChild(copy);
    }
    card.appendChild(actions);
    list.appendChild(card);
  });
  updateProgressBar();
  renderBackupBanner();
}

/* Guardar sesión */
$('#btnSave').addEventListener('click', () => {
  const fecha = getFecha();
  for (const ex of currentData) {
    for (const s of ex.series) {
      if (hasNum(s.peso) && !/^\d+(\.\d+)?$/.test(s.peso)) return toast('⚠ Peso inválido');
      if (hasNum(s.reps) && !/^\d+$/.test(s.reps)) return toast('⚠ Reps inválidas');
    }
  }
  const clean = currentData
    .map(ex => ({
      ejercicioId: ex.ejercicioId,
      series: ex.series
        .filter(s => hasNum(s.peso) || hasNum(s.reps))
        .map(s => ({ peso: s.peso, reps: s.reps, aproximacion: !!s.aproximacion })),
    }))
    .filter(ex => ex.series.length > 0);
  if (clean.length === 0) return toast('⚠ No hay nada cargado para guardar');

  const existing = findSession(currentDayId, fecha);
  if (existing) existing.ejercicios = clean;
  else sessions.push({ id: uid(), fecha, diaId: currentDayId, ejercicios: clean });
  save(LS_KEYS.sessions, sessions);
  delete drafts[draftKey(currentDayId, fecha)];
  save(LS_KEYS.drafts, drafts);
  toast('✔ Sesión guardada');
  renderDayButtons();
  renderExercises();
});

$('#dateInput').value = todayStr();
$('#dateInput').addEventListener('change', () => { renderDayButtons(); renderExercises(); });

/* ============================================================
   BACKUP: EXPORTAR / IMPORTAR / AVISO
   ============================================================ */
function doExport() {
  const blob = new Blob([JSON.stringify({ routine, sessions }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'gymtrack-backup-' + todayStr() + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
  save(LS_KEYS.backup, Date.now());
  renderBackupBanner();
  updateBackupInfo();
  toast('✔ Backup exportado');
}
function daysSinceBackup() {
  const t = load(LS_KEYS.backup, 0);
  return t ? Math.floor((Date.now() - t) / 86400000) : null;
}
function renderBackupBanner() {
  const b = $('#backupBanner');
  const d = daysSinceBackup();
  const need = sessions.length >= 3 && (d === null || d >= 14);
  b.classList.toggle('hidden', !need);
  if (need) {
    $('#backupText').textContent = d === null
      ? 'Tus datos solo están en este navegador. Hacé un backup.'
      : `Hace ${d} días que no hacés backup.`;
  }
}
function updateBackupInfo() {
  const d = daysSinceBackup();
  $('#backupInfo').textContent = d === null
    ? 'Todavía no exportaste ningún backup. Tus datos viven solo en este navegador.'
    : (d === 0 ? 'Último backup: hoy.' : `Último backup: hace ${d} días.`);
}

$('#btnExport').addEventListener('click', doExport);
$('#btnBannerExport').addEventListener('click', doExport);
$('#btnImport').addEventListener('click', () => $('#fileImport').click());
$('#fileImport').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data.routine || !Array.isArray(data.routine.dias) || !Array.isArray(data.sessions)) throw new Error('formato');
      if (!confirm('Esto reemplaza tu rutina y sesiones actuales. ¿Continuar?')) return;
      routine = data.routine;
      sessions = data.sessions;
      drafts = {};
      save(LS_KEYS.routine, routine);
      save(LS_KEYS.sessions, sessions);
      save(LS_KEYS.drafts, drafts);
      currentDayId = routine.dias[0].id;
      renderDayButtons(); renderExercises();
      toast('✔ Datos importados');
    } catch { toast('⚠ Archivo inválido'); }
  };
  reader.readAsText(file);
  e.target.value = '';
});

/* ============================================================
   AJUSTES
   ============================================================ */
$('#btnSettings').addEventListener('click', () => {
  $('#setRest').value = String(settings.restSec);
  $('#setAuto').checked = settings.autoTimer;
  updateBackupInfo();
  $('#settingsModal').classList.remove('hidden');
});
$('#setRest').addEventListener('change', (e) => { settings.restSec = Number(e.target.value); save(LS_KEYS.settings, settings); });
$('#setAuto').addEventListener('change', (e) => { settings.autoTimer = e.target.checked; save(LS_KEYS.settings, settings); });
$('#btnCloseSettings').addEventListener('click', () => $('#settingsModal').classList.add('hidden'));

/* ============================================================
   TAB HISTORIAL
   ============================================================ */
let selectedSessionId = null;
function sessionVolume(s) {
  return s.ejercicios.reduce((acc, ex) => acc + ex.series.reduce((a, x) =>
    a + (hasNum(x.peso) && hasNum(x.reps) ? Number(x.peso) * Number(x.reps) : 0), 0), 0);
}
function monthLabel(iso) {
  const [y, m] = iso.split('-').map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function renderHistory() {
  const wrap = $('#historyList');
  wrap.innerHTML = '';
  const sorted = [...sessions].sort((a, b) => b.fecha.localeCompare(a.fecha));
  if (sorted.length === 0) {
    const box = el('div', 'empty-state');
    box.appendChild(el('div', 'empty-icon', '🗓️'));
    box.appendChild(el('p', '', 'Todavía no hay sesiones guardadas.'));
    box.appendChild(el('p', 'muted', 'Cuando guardes tu primer entreno va a aparecer acá.'));
    const go = el('button', 'btn-primary', 'Ir a entrenar');
    go.addEventListener('click', () => showTab('entreno'));
    box.appendChild(go);
    wrap.appendChild(box);
    return;
  }
  let curMonth = '';
  sorted.forEach(s => {
    const month = monthLabel(s.fecha);
    if (month !== curMonth) { curMonth = month; wrap.appendChild(el('h3', 'month-title', month)); }
    const [y, m, d] = s.fecha.split('-').map(Number);
    const wd = new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });
    const day = routine.dias.find(x => x.id === s.diaId);
    const vol = Math.round(sessionVolume(s));
    const item = el('div', 'history-item');
    const left = el('div');
    left.appendChild(el('div', 'date', wd));
    left.appendChild(el('div', 'day', `${day ? day.nombre : s.diaId} · ${s.ejercicios.length} ejercicios · ${vol.toLocaleString('es-AR')} kg`));
    item.appendChild(left);
    item.appendChild(el('div', 'chev', '›'));
    item.addEventListener('click', () => openSessionDetail(s.id));
    wrap.appendChild(item);
  });
}

function openSessionDetail(id) {
  selectedSessionId = id;
  const s = sessions.find(x => x.id === id);
  if (!s) return;
  const day = routine.dias.find(d => d.id === s.diaId);
  $('#sessionModalTitle').textContent = `${fmtFecha(s.fecha)} · ${day ? day.nombre : s.diaId}`;
  const wrap = $('#sessionDetail');
  wrap.innerHTML = '';
  s.ejercicios.forEach(exData => {
    const ex = exById(s.diaId, exData.ejercicioId);
    const div = el('div', 'det-ex');
    div.appendChild(el('strong', '', ex ? ex.nombre : exData.ejercicioId));
    exData.series.forEach((set, i) => {
      div.appendChild(el('div', 'set-line',
        `Serie ${i + 1}: ${set.peso || 0} kg × ${set.reps || 0}${set.aproximacion ? ' (aproximación)' : ''}`));
    });
    wrap.appendChild(div);
  });
  $('#sessionModal').classList.remove('hidden');
}
$('#btnCloseSession').addEventListener('click', () => $('#sessionModal').classList.add('hidden'));
$('#btnDeleteSession').addEventListener('click', () => {
  if (!confirm('¿Borrar esta sesión?')) return;
  sessions = sessions.filter(x => x.id !== selectedSessionId);
  save(LS_KEYS.sessions, sessions);
  $('#sessionModal').classList.add('hidden');
  renderHistory();
  toast('Sesión borrada');
});
$('#btnEditSession').addEventListener('click', () => {
  const s = sessions.find(x => x.id === selectedSessionId);
  if (!s) return;
  $('#sessionModal').classList.add('hidden');
  currentDayId = s.diaId;
  $('#dateInput').value = s.fecha;
  showTab('entreno');
  renderDayButtons(); renderExercises();
});

/* ============================================================
   TAB PROGRESO
   ============================================================ */
function renderProgressSelect() {
  const sel = $('#progressSelect');
  const prev = sel.value;
  sel.innerHTML = '';
  const ids = new Set();
  routine.dias.forEach(d => d.ejercicios.forEach(ex => {
    if (ids.has(ex.id)) return;
    ids.add(ex.id);
    const opt = el('option', '', ex.nombre);
    opt.value = ex.id;
    sel.appendChild(opt);
  }));
  if (prev && ids.has(prev)) sel.value = prev;
  else {
    // por defecto, el primer ejercicio que ya tenga datos
    const withData = [...ids].find(id => sessions.some(s => s.ejercicios.some(e => e.ejercicioId === id)));
    if (withData) sel.value = withData;
  }
  drawProgress();
}
$('#progressSelect').addEventListener('change', drawProgress);
$('#btnGoTrain').addEventListener('click', () => showTab('entreno'));

function drawProgress() {
  const exId = $('#progressSelect').value;
  if (!exId) return;
  const pts = sessions
    .filter(s => s.ejercicios.some(e => e.ejercicioId === exId))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map(s => {
      const ex = s.ejercicios.find(e => e.ejercicioId === exId);
      const efectivas = ex.series.filter(x => !x.aproximacion && hasNum(x.peso));
      const best = efectivas.length ? Math.max(...efectivas.map(x => Number(x.peso))) : null;
      const e1rm = efectivas.filter(x => hasNum(x.reps) && Number(x.reps) > 0)
        .reduce((mx, x) => Math.max(mx, Number(x.peso) * (1 + Number(x.reps) / 30)), 0);
      const vol = ex.series
        .filter(x => hasNum(x.peso) && hasNum(x.reps))
        .reduce((acc, x) => acc + Number(x.peso) * Number(x.reps), 0);
      return { fecha: s.fecha, best, vol, e1rm };
    });
  const has = pts.some(p => p.best !== null);
  $('#progressEmpty').classList.toggle('hidden', has);
  $('#progressContent').classList.toggle('hidden', !has);
  if (!has) return;

  const valid = pts.filter(p => p.best !== null);
  const pr = valid.reduce((a, b) => (b.best >= a.best ? b : a));
  const e1 = Math.max(...valid.map(p => p.e1rm));
  const delta = valid.length > 1 ? valid[valid.length - 1].best - valid[0].best : 0;
  const stats = $('#progressStats');
  stats.innerHTML = '';
  const card = (label, value, sub) => {
    const c = el('div', 'stat');
    c.appendChild(el('div', 'stat-label', label));
    c.appendChild(el('div', 'stat-value', value));
    if (sub) c.appendChild(el('div', 'stat-sub', sub));
    stats.appendChild(c);
  };
  card('Récord', pr.best + ' kg', fmtCorta(pr.fecha));
  card('1RM estimado', e1 ? Math.round(e1 * 10) / 10 + ' kg' : '—', 'Fórmula de Epley');
  card('Sesiones', String(pts.length));
  card('Cambio total', (delta > 0 ? '+' : '') + Math.round(delta * 10) / 10 + ' kg', 'desde la 1ª sesión');

  drawChart($('#chartPeso'), pts.map(p => ({ label: p.fecha, value: p.best })));
  drawChart($('#chartVolumen'), pts.map(p => ({ label: p.fecha, value: p.vol })));
}
window.addEventListener('resize', () => {
  if ($('#tab-progreso').classList.contains('active')) drawProgress();
});

/* Gráfico de línea con canvas (nítido en pantallas retina) */
function drawChart(canvas, points) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  if (!W || !H) return;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.font = '12px system-ui, sans-serif';

  const vals = points.map(p => p.value).filter(v => v !== null);
  if (!vals.length) return;
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = (max - min) || max || 1;
  const yMin = Math.max(0, min - span * 0.25);
  const yMax = max + span * 0.25;
  const padL = 44, padR = 14, padT = 16, padB = 28;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const xOf = i => padL + (points.length > 1 ? (i * plotW) / (points.length - 1) : plotW / 2);
  const yOf = v => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  // grilla + eje Y
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let g = 0; g <= 3; g++) {
    const v = yMin + ((yMax - yMin) * g) / 3;
    const y = yOf(v);
    ctx.strokeStyle = '#2a2a38';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
    ctx.fillStyle = '#8a8a99';
    ctx.fillText(String(Math.round(v * 10) / 10), padL - 8, y);
  }

  // área + línea
  const idx = points.map((p, i) => (p.value === null ? null : i)).filter(i => i !== null);
  if (idx.length > 1) {
    const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    grad.addColorStop(0, 'rgba(124,92,255,0.35)');
    grad.addColorStop(1, 'rgba(124,92,255,0)');
    ctx.beginPath();
    idx.forEach((i, k) => { const x = xOf(i), y = yOf(points[i].value); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.lineTo(xOf(idx[idx.length - 1]), padT + plotH);
    ctx.lineTo(xOf(idx[0]), padT + plotH);
    ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    ctx.strokeStyle = '#7c5cff'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath();
    idx.forEach((i, k) => { const x = xOf(i), y = yOf(points[i].value); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
  }

  // puntos + etiquetas
  const every = Math.ceil(points.length / 7);
  ctx.textAlign = 'center';
  idx.forEach(i => {
    const x = xOf(i), y = yOf(points[i].value);
    ctx.fillStyle = '#7c5cff';
    ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#121218';
    ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
    if (points.length <= 8 || i === points.length - 1) {
      ctx.fillStyle = '#f0f0f5';
      ctx.textBaseline = 'bottom';
      ctx.fillText(String(Math.round(points[i].value * 10) / 10), x, y - 8);
    }
  });
  ctx.fillStyle = '#8a8a99';
  ctx.textBaseline = 'top';
  points.forEach((p, i) => {
    if (i % every !== 0 && i !== points.length - 1) return;
    ctx.fillText(fmtCorta(p.label), xOf(i), padT + plotH + 8);
  });
}

/* ============================================================
   CRONÓMETRO DE DESCANSO (basado en hora de fin: no se atrasa)
   ============================================================ */
let timerEnd = 0, timerInt = null, chipHideTimer = null;
const fmt = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const remaining = () => Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000));

function renderTimer() {
  const t = fmt(remaining());
  $('#timerDisplay').textContent = t;
  $('#timerChip').textContent = '⏱ ' + t;
}
function timerTick() { if (remaining() <= 0) finishTimer(); else renderTimer(); }
function startTimer(sec) {
  clearInterval(timerInt); clearTimeout(chipHideTimer);
  timerEnd = Date.now() + sec * 1000;
  const chip = $('#timerChip');
  chip.classList.remove('hidden', 'done');
  renderTimer();
  timerInt = setInterval(timerTick, 250);
}
function finishTimer() {
  clearInterval(timerInt); timerInt = null;
  $('#timerDisplay').textContent = '¡A meterle!';
  const chip = $('#timerChip');
  chip.textContent = '⏱ ¡Listo!';
  chip.classList.add('done');
  if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
  beep();
  chipHideTimer = setTimeout(() => chip.classList.add('hidden'), 6000);
}
function stopTimer() {
  clearInterval(timerInt); timerInt = null; clearTimeout(chipHideTimer);
  $('#timerChip').classList.add('hidden');
  $('#timerDisplay').textContent = '--:--';
}
function beep() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach(t => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.type = 'sine'; o.frequency.value = 880;
      g.gain.setValueAtTime(0.3, ac.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + 0.2);
      o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.2);
    });
  } catch { /* sin audio, ya vibró */ }
}
function openTimerModal() {
  $('#timerModal').classList.remove('hidden');
  $('#timerDisplay').textContent = timerInt ? fmt(remaining()) : '--:--';
}
$('#btnTimer').addEventListener('click', openTimerModal);
$('#timerChip').addEventListener('click', openTimerModal);
document.querySelectorAll('.timer-preset').forEach(b =>
  b.addEventListener('click', () => startTimer(Number(b.dataset.sec))));
$('#timerStop').addEventListener('click', () => { stopTimer(); $('#timerModal').classList.add('hidden'); });
$('#timerClose').addEventListener('click', () => $('#timerModal').classList.add('hidden'));

/* ============================================================
   EDITAR RUTINA
   ============================================================ */
let routineEdit = null;

function openRoutineEditor() {
  routineEdit = JSON.parse(JSON.stringify(routine));
  renderRoutineEditor();
  $('#routineModal').classList.remove('hidden');
}
function renderRoutineEditor() {
  const wrap = $('#routineEditor');
  wrap.innerHTML = '';
  routineEdit.dias.forEach(dia => {
    wrap.appendChild(el('h3', 'rut-day-title', dia.nombre));

    dia.ejercicios.forEach((ex, ei) => {
      const div = el('div', 'rut-ex');
      div.innerHTML = `
        <input type="text" class="in-nombre" placeholder="Nombre del ejercicio">
        <div class="rut-nums">
          <span>Series</span><input type="number" class="in-series" min="1" max="20">
          <span>Reps</span><input type="number" class="in-repmin" min="1" max="100">
          <span>a</span><input type="number" class="in-repmax" min="1" max="100">
        </div>
        <div class="rut-actions">
          <button class="up" title="Subir">↑</button>
          <button class="down" title="Bajar">↓</button>
          <button class="del" title="Eliminar">🗑</button>
        </div>`;
      div.querySelector('.in-nombre').value = ex.nombre;
      div.querySelector('.in-series').value = ex.series;
      div.querySelector('.in-repmin').value = ex.repMin;
      div.querySelector('.in-repmax').value = ex.repMax;

      div.querySelector('.in-nombre').addEventListener('input', e => ex.nombre = e.target.value);
      div.querySelector('.in-series').addEventListener('input', e => ex.series = Number(e.target.value) || 1);
      div.querySelector('.in-repmin').addEventListener('input', e => ex.repMin = Number(e.target.value) || 1);
      div.querySelector('.in-repmax').addEventListener('input', e => ex.repMax = Number(e.target.value) || 1);
      div.querySelector('.up').addEventListener('click', () => {
        if (ei === 0) return;
        [dia.ejercicios[ei - 1], dia.ejercicios[ei]] = [dia.ejercicios[ei], dia.ejercicios[ei - 1]];
        renderRoutineEditor();
      });
      div.querySelector('.down').addEventListener('click', () => {
        if (ei === dia.ejercicios.length - 1) return;
        [dia.ejercicios[ei + 1], dia.ejercicios[ei]] = [dia.ejercicios[ei], dia.ejercicios[ei + 1]];
        renderRoutineEditor();
      });
      div.querySelector('.del').addEventListener('click', () => {
        if (!confirm(`¿Eliminar "${ex.nombre}"?`)) return;
        dia.ejercicios.splice(ei, 1);
        renderRoutineEditor();
      });
      wrap.appendChild(div);
    });

    const addBtn = el('button', 'add-set', `＋ Agregar ejercicio a ${dia.nombre}`);
    addBtn.addEventListener('click', () => {
      const nombre = prompt('Nombre del ejercicio:');
      if (!nombre || !nombre.trim()) return;
      dia.ejercicios.push({ id: 'e-' + uid(), nombre: nombre.trim(), series: 3, repMin: 8, repMax: 12 });
      renderRoutineEditor();
    });
    wrap.appendChild(addBtn);
  });
}
$('#btnEditRoutine').addEventListener('click', openRoutineEditor);
$('#btnCloseRoutine').addEventListener('click', () => $('#routineModal').classList.add('hidden'));
$('#btnSaveRoutine').addEventListener('click', () => {
  for (const dia of routineEdit.dias) {
    for (const ex of dia.ejercicios) {
      if (!ex.nombre.trim()) return toast('⚠ Hay un ejercicio sin nombre');
      if (ex.repMax < ex.repMin) ex.repMax = ex.repMin;
      ex.series = Math.max(1, Math.min(20, ex.series));
    }
  }
  routine = routineEdit;
  save(LS_KEYS.routine, routine);
  if (!dayById(currentDayId)) currentDayId = routine.dias[0].id;
  $('#routineModal').classList.add('hidden');
  renderDayButtons(); renderExercises();
  toast('✔ Rutina guardada');
});

/* ============================================================
   INICIO
   ============================================================ */
renderDayButtons();
renderExercises();

// Manifest embebido para "Agregar a pantalla de inicio"
(function setupManifest() {
  const manifest = {
    name: 'GymTrack', short_name: 'GymTrack',
    start_url: '.', display: 'standalone',
    background_color: '#121218', theme_color: '#121218',
    icons: [{
      src: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192"><rect width="192" height="192" rx="40" fill="#7c5cff"/><text x="96" y="130" font-size="100" text-anchor="middle">💪</text></svg>'),
      sizes: '192x192', type: 'image/svg+xml'
    }]
  };
  $('#manifest').href = 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(manifest));
})();