'use strict';
/* ============================================================
   GymTrack - registro de entrenos sin backend, todo localStorage
   ============================================================ */

const LS_KEYS = { routine: 'routine', sessions: 'sessions', draft: 'draft' };

/* ---------- Rutina precargada ---------- */
function defaultRoutine() {
  const mk = (id, nombre, series, repMin, repMax) => ({ id, nombre, series, repMin, repMax });
  return {
    dias: [
      { id: 'd1', nombre: 'Día 1', ejercicios: [
        mk('e-curl-femoral-acostado', 'Curl femoral acostado', 2, 8, 12),
        mk('e-prensa', 'Prensa de piernas', 3, 8, 10),
        mk('e-peso-muerto-rumano', 'Peso muerto rumano', 2, 8, 10),
        mk('e-extension-cuadriceps', 'Extensiones de cuádriceps', 2, 10, 12),
        mk('e-gemelos-prensa', 'Gemelos en prensa', 4, 10, 12),
        mk('e-triceps-polea', 'Extensión de tríceps en polea', 2, 10, 12),
        mk('e-abdominales', 'Abdominales', 2, 15, 15),
      ]},
      { id: 'd2', nombre: 'Día 2', ejercicios: [
        mk('e-press-inclinado-smith', 'Press inclinado en Smith', 2, 8, 10),
        mk('e-aperturas-maquina', 'Aperturas en máquina', 2, 10, 12),
        mk('e-jalon-prono', 'Jalón al pecho prono', 2, 8, 10),
        mk('e-remo-unilateral-polea', 'Remo unilateral neutro con polea', 2, 8, 10),
        mk('e-elevaciones-laterales-d2', 'Elevaciones laterales', 2, 10, 15),
        mk('e-extensiones-triceps-d2', 'Extensiones de tríceps', 2, 10, 12),
        mk('e-curl-bayesian', 'Curl de bíceps bayesian', 2, 8, 12),
      ]},
      { id: 'd3', nombre: 'Día 3', ejercicios: [
        mk('e-pecho-plano-maquina', 'Pecho plano en máquina', 2, 8, 10),
        mk('e-hack-squat', 'Hack squat', 3, 8, 10),
        mk('e-remo-maquina-abierto', 'Remo en máquina (codos más abiertos)', 2, 8, 10),
        mk('e-curl-femoral-sentado', 'Curl femoral sentado', 2, 8, 12),
        mk('e-gemelos-d3', 'Gemelos', 2, 10, 12),
        mk('e-press-jm', 'Press JM', 2, 10, 12),
        mk('e-elevaciones-laterales-d3', 'Elevaciones laterales', 2, 10, 15),
        mk('e-biceps-barra', 'Bíceps con barra', 2, 8, 12),
      ]},
    ],
  };
}

/* ---------- Helpers de almacenamiento ---------- */
const load = (key, fallback) => {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; }
  catch { return fallback; }
};
const save = (key, val) => localStorage.setItem(key, JSON.stringify(val));

let routine = load(LS_KEYS.routine, null);
if (!routine || !routine.dias) { routine = defaultRoutine(); save(LS_KEYS.routine, routine); }
let sessions = load(LS_KEYS.sessions, []);

/* ---------- Estado de pantalla ---------- */
let currentDayId = routine.dias[0].id;
const $ = (sel) => document.querySelector(sel);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const todayStr = () => new Date().toLocaleDateString('sv'); // YYYY-MM-DD local

function dayById(id) { return routine.dias.find(d => d.id === id); }
function exById(dayId, exId) { return dayById(dayId)?.ejercicios.find(e => e.id === exId); }

/* ---------- Toast ---------- */
let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 1800);
}

/* ============================================================
   PESTAÑAS
   ============================================================ */
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'tab-' + btn.dataset.tab));
    if (btn.dataset.tab === 'historial') renderHistory();
    if (btn.dataset.tab === 'progreso') renderProgressSelect();
  });
});

/* ============================================================
   TAB ENTRENO
   ============================================================ */
function renderDayButtons() {
  const wrap = $('#dayButtons');
  wrap.innerHTML = '';
  routine.dias.forEach(d => {
    const b = document.createElement('button');
    b.className = 'day-btn' + (d.id === currentDayId ? ' selected' : '');
    b.textContent = d.nombre;
    b.addEventListener('click', () => { currentDayId = d.id; renderDayButtons(); renderExercises(); });
    wrap.appendChild(b);
  });
}

function getFecha() { return $('#dateInput').value || todayStr(); }

/* Sesión guardada para día+fecha (si existe) */
function findSession(dayId, fecha) {
  return sessions.find(s => s.diaId === dayId && s.fecha === fecha);
}

/* Última sesión anterior (por fecha) de ese día que contenga el ejercicio */
function lastSessionForExercise(dayId, exId, beforeFecha) {
  return sessions
    .filter(s => s.diaId === dayId && s.fecha < beforeFecha &&
      s.ejercicios.some(e => e.ejercicioId === exId))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))[0] || null;
}

/* Borrador: carga para día+fecha o de sesión existente */
function loadDraft(dayId, fecha) {
  const draft = load(LS_KEYS.draft, null);
  if (draft && draft.diaId === dayId && draft.fecha === fecha) return draft.data;
  const existing = findSession(dayId, fecha);
  if (existing) return JSON.parse(JSON.stringify(existing.ejercicios));
  return null;
}

/* Devuelve las series (work data) por ejercicio: estructura base */
function baseExercises(dayId, fecha) {
  const day = dayById(dayId);
  return day.ejercicios.map(ex => ({
    ejercicioId: ex.id,
    series: Array.from({ length: ex.series }, () => ({ peso: '', reps: '', aproximacion: false })),
  }));
}

function renderExercises() {
  const list = $('#exerciseList');
  list.innerHTML = '';
  const day = dayById(currentDayId);
  const fecha = getFecha();
  const data = loadDraft(currentDayId, fecha) || baseExercises(currentDayId, fecha);
  const existing = findSession(currentDayId, fecha);
  $('#btnSave').textContent = existing ? 'Actualizar sesión' : 'Guardar sesión';

  day.ejercicios.forEach(ex => {
    let exData = data.find(d => d.ejercicioId === ex.id);
    if (!exData) { exData = { ejercicioId: ex.id, series: [{ peso: '', reps: '', aproximacion: false }] }; data.push(exData); }

    const card = document.createElement('div');
    card.className = 'ex-card';

    // Encabezado + sugerencia de progresión
    const header = document.createElement('div');
    header.className = 'ex-header';
    const nameTarget = document.createElement('div');
    nameTarget.innerHTML = `<div class="ex-name"></div><div class="ex-target">${ex.series} series · ${ex.repMin}${ex.repMax > ex.repMin ? '–' + ex.repMax : ''} reps</div>`;
    nameTarget.querySelector('.ex-name').textContent = ex.nombre;
    header.appendChild(nameTarget);

    // Sugerencia: tope de rango en todas las series efectivas anteriores
    const last = lastSessionForExercise(currentDayId, ex.id, fecha);
    let badge = null;
    if (last) {
      const prev = last.ejercicios.find(e => e.ejercicioId === ex.id);
      const efectivas = prev.series.filter(s => !s.aproximacion && s.peso !== '' && s.reps !== '');
      if (efectivas.length > 0 && efectivas.every(s => Number(s.reps) >= ex.repMax)) {
        badge = document.createElement('span');
        badge.className = 'badge-up';
        badge.textContent = '⬆ Subí el peso';
        header.appendChild(badge);
      }
    }
    card.appendChild(header);

    // "Última vez"
    const lastLine = document.createElement('div');
    lastLine.className = 'last-time';
    if (last) {
      const prev = last.ejercicios.find(e => e.ejercicioId === ex.id);
      const txt = prev.series
        .filter(s => s.peso !== '' || s.reps !== '')
        .map(s => `${s.peso} × ${s.reps}${s.aproximacion ? ' (aprox)' : ''}`)
        .join(', ');
      lastLine.textContent = 'Última vez (' + last.fecha + '): ' + (txt || '—');
    } else {
      lastLine.textContent = 'Última vez: sin registros';
    }
    card.appendChild(lastLine);

    // Filas de series
    const setsWrap = document.createElement('div');
    function renderSets() {
      setsWrap.innerHTML = '';
      exData.series.forEach((set, i) => {
        const row = document.createElement('div');
        row.className = 'set-row' + (set.aproximacion ? ' aprox' : '');
        row.innerHTML = `
          <span class="set-num">${i + 1}</span>
          <input type="number" inputmode="decimal" min="0" step="0.5" class="in-peso" placeholder="0">
          <span class="unit">kg</span>
          <input type="number" inputmode="numeric" min="0" step="1" class="in-reps" placeholder="0">
          <span class="unit">reps</span>
          <label class="aprox-toggle" title="Serie de aproximación (no cuenta para la progresión)">
            <input type="checkbox" class="in-aprox">A
          </label>
          <button class="del-set" title="Borrar serie">✕</button>`;
        const inPeso = row.querySelector('.in-peso');
        const inReps = row.querySelector('.in-reps');
        const inAprox = row.querySelector('.in-aprox');
        inPeso.value = set.peso;
        inReps.value = set.reps;
        inAprox.checked = set.aproximacion;

        const autoguardar = () => saveDraftData(currentDayId, fecha, collectInputs());
        inPeso.addEventListener('input', () => {
          set.peso = inPeso.value.trim();
          validarNum(inPeso, true);
          autoguardar();
        });
        inReps.addEventListener('input', () => {
          set.reps = inReps.value.trim();
          validarNum(inReps, false);
          autoguardar();
        });
        inAprox.addEventListener('change', () => {
          set.aproximacion = inAprox.checked;
          row.classList.toggle('aprox', set.aproximacion);
          autoguardar();
        });
        row.querySelector('.del-set').addEventListener('click', () => {
          exData.series.splice(i, 1);
          renderSets();
          saveDraftData(currentDayId, fecha, collectInputs());
        });
        setsWrap.appendChild(row);
      });
    }
    renderSets();
    card.appendChild(setsWrap);

    const addBtn = document.createElement('button');
    addBtn.className = 'add-set';
    addBtn.textContent = '＋ Agregar serie';
    addBtn.addEventListener('click', () => {
      exData.series.push({ peso: '', reps: '', aproximacion: false });
      renderSets();
      saveDraftData(currentDayId, fecha, collectInputs());
    });
    card.appendChild(addBtn);
    list.appendChild(card);
  });
  // mantener el estado completo en memoria para collectInputs
  list._data = data;
}

/* Valida número: aproxima decimales con coma también */
function validarNum(input, allowDecimal) {
  const v = input.value.trim().replace(',', '.');
  if (v === '') { input.setCustomValidity(''); return true; }
  const ok = allowDecimal ? /^\d+(\.\d+)?$/.test(v) : /^\d+$/.test(v);
  input.setCustomValidity(ok ? '' : 'Número inválido');
  input.reportValidity?.();
  return ok;
}

/* Junta lo ingresado en pantalla */
function collectInputs() {
  const data = $('#exerciseList')._data || [];
  document.querySelectorAll('#exerciseList .ex-card').forEach((card, ci) => {
    const rows = card.querySelectorAll('.set-row');
    const exData = data[orderOfEx(card)];
    if (!exData) return;
    rows.forEach((row, ri) => {
      if (!exData.series[ri]) exData.series[ri] = { peso: '', reps: '', aproximacion: false };
      exData.series[ri].peso = row.querySelector('.in-peso').value.trim().replace(',', '.');
      exData.series[ri].reps = row.querySelector('.in-reps').value.trim().replace(',', '.');
      exData.series[ri].aproximacion = row.querySelector('.in-aprox').checked;
    });
  });
  return data;
}
function orderOfEx(card) {
  const day = dayById(currentDayId);
  const cards = [...document.querySelectorAll('#exerciseList .ex-card')];
  const idx = cards.indexOf(card);
  const exId = day.ejercicios[idx]?.id;
  const data = $('#exerciseList')._data || [];
  return data.findIndex(d => d.ejercicioId === exId);
}

function saveDraftData(dayId, fecha, data) {
  save(LS_KEYS.draft, { diaId: dayId, fecha, data });
}

/* Guardar sesión */
$('#btnSave').addEventListener('click', () => {
  const fecha = getFecha();
  const data = collectInputs();
  // validación final
  for (const ex of data) {
    for (const s of ex.series) {
      if (s.peso !== '' && !/^\d+(\.\d+)?$/.test(s.peso)) return toast('⚠ Peso inválido');
      if (s.reps !== '' && !/^\d+$/.test(s.reps)) return toast('⚠ Reps inválidas');
    }
  }
  // limpiar ejercicios sin nada cargado
  const clean = data
    .map(ex => ({ ejercicioId: ex.ejercicioId, series: ex.series.filter(s => s.peso !== '' || s.reps !== '') }))
    .filter(ex => ex.series.length > 0);
  if (clean.length === 0) return toast('⚠ No hay nada cargado para guardar');

  const existing = findSession(currentDayId, fecha);
  if (existing) {
    existing.ejercicios = clean;
  } else {
    sessions.push({ id: uid(), fecha, diaId: currentDayId, ejercicios: clean });
  }
  save(LS_KEYS.sessions, sessions);
  localStorage.removeItem(LS_KEYS.draft);
  toast('✔ Sesión guardada');
  renderExercises();
});

$('#dateInput').value = todayStr();
$('#dateInput').addEventListener('change', renderExercises);

/* ============================================================
   EXPORTAR / IMPORTAR
   ============================================================ */
$('#btnExport').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ routine, sessions }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'gymtrack-backup-' + todayStr() + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

$('#btnImport').addEventListener('click', () => $('#fileImport').click());
$('#fileImport').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data.routine || !Array.isArray(data.sessions)) throw new Error('formato');
      routine = data.routine;
      sessions = data.sessions;
      save(LS_KEYS.routine, routine);
      save(LS_KEYS.sessions, sessions);
      currentDayId = routine.dias[0].id;
      renderDayButtons(); renderExercises();
      toast('✔ Datos importados');
    } catch { toast('⚠ Archivo inválido'); }
  };
  reader.readAsText(file);
  e.target.value = '';
});

/* ============================================================
   TAB HISTORIAL
   ============================================================ */
let selectedSessionId = null;
function fmtFecha(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function renderHistory() {
  const wrap = $('#historyList');
  wrap.innerHTML = '';
  const sorted = [...sessions].sort((a, b) => b.fecha.localeCompare(a.fecha));
  if (sorted.length === 0) {
    wrap.innerHTML = '<p class="empty-msg">Todavía no hay sesiones guardadas.</p>';
    return;
  }
  sorted.forEach(s => {
    const day = routine.dias.find(d => d.id === s.diaId);
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `<div><div class="date">${fmtFecha(s.fecha)}</div><div class="day">${day ? day.nombre : s.diaId} · ${s.ejercicios.length} ejercicios</div></div><div>›</div>`;
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
    const div = document.createElement('div');
    div.className = 'det-ex';
    const title = document.createElement('strong');
    title.textContent = ex ? ex.nombre : exData.ejercicioId;
    div.appendChild(title);
    exData.series.forEach((set, i) => {
      const line = document.createElement('div');
      line.className = 'set-line';
      line.textContent = `Serie ${i + 1}: ${set.peso} kg × ${set.reps}${set.aproximacion ? ' (aproximación)' : ''}`;
      div.appendChild(line);
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
  document.querySelector('[data-tab="entreno"]').click();
  renderDayButtons(); renderExercises();
});

/* ============================================================
   TAB PROGRESO
   ============================================================ */
function allExercisesFlat() {
  const out = [];
  routine.dias.forEach(d => d.ejercicios.forEach(e => out.push({ dayId: d.id, dayNombre: d.nombre, ...e })));
  return out;
}
function renderProgressSelect() {
  const sel = $('#progressSelect');
  const prev = sel.value;
  sel.innerHTML = '';
  const ids = new Set();
  allExercisesFlat().forEach(ex => {
    // usa el id de ejercicio como clave (aparece en sesiones)
    if (ids.has(ex.id)) return;
    ids.add(ex.id);
    const opt = document.createElement('option');
    opt.value = ex.dayId + '|' + ex.id;
    opt.textContent = ex.nombre;
    sel.appendChild(opt);
  });
  if (prev) sel.value = prev;
  drawProgress();
}
$('#progressSelect').addEventListener('change', drawProgress);

function drawProgress() {
  const val = $('#progressSelect').value;
  if (!val) return;
  const [, exId] = val.split('|');
  const pts = sessions
    .filter(s => s.ejercicios.some(e => e.ejercicioId === exId))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map(s => {
      const ex = s.ejercicios.find(e => e.ejercicioId === exId);
      const efectivas = ex.series.filter(x => !x.aproximacion && x.peso !== '');
      const best = efectivas.length ? Math.max(...efectivas.map(x => Number(x.peso))) : null;
      const vol = ex.series
        .filter(x => x.peso !== '' && x.reps !== '')
        .reduce((acc, x) => acc + Number(x.peso) * Number(x.reps), 0);
      return { fecha: s.fecha, best, vol };
    });
  drawChart($('#chartPeso'), pts.map(p => ({ label: p.fecha, value: p.best })));
  drawChart($('#chartVolumen'), pts.map(p => ({ label: p.fecha, value: p.vol })));
}

/* Gráfico simple de líneas/barras con canvas, sin librerías */
function drawChart(canvas, points) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#8a8a99';
  ctx.font = '20px system-ui';
  if (points.length === 0 || points.every(p => p.value === null)) {
    ctx.fillText('Sin datos todavía', 20, 40);
    return;
  }
  const vals = points.map(p => p.value ?? 0);
  const max = Math.max(...vals, 1);
  const padL = 50, padB = 40, padT = 20, padR = 15;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const stepX = points.length > 1 ? plotW / (points.length - 1) : 0;
  const xOf = i => padL + (points.length > 1 ? i * stepX : plotW / 2);
  const yOf = v => padT + plotH - (v / max) * plotH;

  // eje
  ctx.strokeStyle = '#3a3a4a';
  ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + plotH); ctx.lineTo(padL + plotW, padT + plotH); ctx.stroke();
  // etiqueta máx
  ctx.fillStyle = '#8a8a99';
  ctx.fillText(String(Math.round(max * 10) / 10), 4, padT + 8);

  // línea
  ctx.strokeStyle = '#7c5cff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  let started = false;
  points.forEach((p, i) => {
    if (p.value === null) return;
    const x = xOf(i), y = yOf(p.value);
    if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // puntos + etiquetas
  points.forEach((p, i) => {
    if (p.value === null) return;
    const x = xOf(i), y = yOf(p.value);
    ctx.fillStyle = '#7c5cff';
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8a8a99';
    ctx.save();
    ctx.translate(x, padT + plotH + 24);
    ctx.rotate(points.length > 4 ? -0.5 : 0);
    ctx.textAlign = 'center';
    ctx.fillText(p.label.slice(5), 0, 0);
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f0f0f5';
    ctx.fillText(String(Math.round(p.value * 10) / 10), x, y - 12);
  });
  ctx.textAlign = 'left';
}

/* ============================================================
   CRONÓMETRO DE DESCANSO
   ============================================================ */
let timerInterval = null, timerRemain = 0;
function fmt(sec) { return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; }
function updateTimer() { $('#timerDisplay').textContent = fmt(timerRemain); }
function timerTick() {
  timerRemain--;
  if (timerRemain <= 0) {
    stopTimer(false);
    $('#timerDisplay').textContent = '¡A meterle!';
    if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
    beep();
    return;
  }
  updateTimer();
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
function startTimer(sec) { stopTimer(false); timerRemain = sec; updateTimer(); timerInterval = setInterval(timerTick, 1000); }
function stopTimer(closeModal = true) { clearInterval(timerInterval); timerInterval = null; if (closeModal) $('#timerModal').classList.add('hidden'); }

$('#btnTimer').addEventListener('click', () => {
  $('#timerModal').classList.remove('hidden');
  $('#timerDisplay').textContent = timerInterval ? fmt(timerRemain) : '--:--';
});
document.querySelectorAll('.timer-preset').forEach(b =>
  b.addEventListener('click', () => startTimer(Number(b.dataset.sec))));
$('#timerStop').addEventListener('click', () => stopTimer(true));

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
    const title = document.createElement('h3');
    title.className = 'rut-day-title';
    title.textContent = dia.nombre;
    wrap.appendChild(title);

    dia.ejercicios.forEach((ex, ei) => {
      const div = document.createElement('div');
      div.className = 'rut-ex';
      div.innerHTML = `
        <input type="text" class="in-nombre" value="" placeholder="Nombre del ejercicio">
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

    const addBtn = document.createElement('button');
    addBtn.className = 'add-set';
    addBtn.textContent = `＋ Agregar ejercicio a ${dia.nombre}`;
    addBtn.addEventListener('click', () => {
      const nombre = prompt('Nombre del ejercicio:');
      if (!nombre) return;
      dia.ejercicios.push({ id: 'e-' + uid(), nombre, series: 3, repMin: 8, repMax: 12 });
      renderRoutineEditor();
    });
    wrap.appendChild(addBtn);
  });
}
$('#btnEditRoutine').addEventListener('click', openRoutineEditor);
$('#btnCloseRoutine').addEventListener('click', () => $('#routineModal').classList.add('hidden'));
$('#btnSaveRoutine').addEventListener('click', () => {
  // validación básica
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
