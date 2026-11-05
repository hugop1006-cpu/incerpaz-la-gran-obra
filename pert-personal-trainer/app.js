'use strict';
// PERT Personal Trainer — PWA local-first. Todo se guarda en este dispositivo.
const KEY = 'pert.v1';
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const exById = id => EXERCISES.find(e => e.id === id);
const MODES = { lado: 'por lado', mano: 'por mano', total: 'totales', cuerpo: 'peso corporal' };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const blank = () => ({ sessions: [], photos: {}, settings: { unit: 'lb' }, current: null });
let db = (() => { try { return Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { return blank(); } })();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); return true; }
  catch { toast('No se pudo guardar: almacenamiento lleno. Exporta tus datos.'); return false; }
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.h); toast.h = setTimeout(() => (t.hidden = true), 3200);
}

const ui = { tab: 'hoy', picked: null, openSession: null };

/* ---------- Datos de sesión ---------- */
function newEntry(ex) {
  if (ex.kind === 'cardio') return { skipped: false, sets: [{ done: false, minutes: '', speed: '' }], effort: 5, comment: '', symptoms: null, mode: null };
  const n = ex.plan.sets;
  return { skipped: false, mode: ex.mode, effort: 5, comment: '', symptoms: null,
    sets: Array.from({ length: n }, () => ({ done: false, weight: '', reps: '' })) };
}
function startSession(routineName, ids) {
  db.current = { id: uid(), date: new Date().toISOString(), routine: routineName, steps: ids, idx: 0, entries: {} };
  ids.forEach(id => (db.current.entries[id] = newEntry(exById(id))));
  save(); render();
}
const cur = () => db.current;
const stepEx = () => exById(cur().steps[cur().idx]);

/* Referencia = última sesión TERMINADA con al menos una serie confirmada. */
function reference(exId) {
  for (let i = db.sessions.length - 1; i >= 0; i--) {
    const e = db.sessions[i].entries?.[exId];
    if (e && !e.skipped && e.sets.some(s => s.done)) return { date: db.sessions[i].date, e };
  }
  return null;
}
function fmtSet(ex, e) {
  const done = e.sets.filter(s => s.done);
  if (ex.kind === 'cardio') return done.map(s => `${s.minutes || '?'} min${s.speed ? ' · ' + s.speed + ' km/h máx.' : ''}`).join(' + ');
  const w = [...new Set(done.map(s => s.weight))].join('/');
  const r = [...new Set(done.map(s => s.reps))].join('/');
  const u = db.settings.unit;
  return `${done.length} × ${r || '?'} · ${w || '?'} ${u} ${MODES[e.mode] || ''} · esfuerzo ${e.effort}/10`;
}
const fmtDate = iso => new Date(iso).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/* Propuesta: solo se MUESTRA; nunca se aplica ni cuenta como realizada. */
function proposal(ex) {
  const ref = reference(ex.id);
  if (!ref || ex.kind === 'cardio' || ex.mode === 'cuerpo') return null;
  const full = ref.e.sets.length >= ex.plan.sets && ref.e.sets.every(s => s.done);
  if (full && ref.e.effort <= 7 && ref.e.symptoms !== 'si') return 'Completaste todas las series con esfuerzo ≤7/10: puedes valorar subir un escalón pequeño de peso, o una repetición más.';
  if (ref.e.effort >= 9 || ref.e.symptoms === 'si') return 'La última vez el esfuerzo fue muy alto o hubo síntomas: mantén o reduce el peso y prioriza la técnica.';
  return 'Mantén el peso y busca completar todas las series con buena técnica antes de subir.';
}

/* ---------- Render ---------- */
function render() {
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === ui.tab));
  const v = $('#view');
  v.innerHTML = ({ hoy: viewHoy, historial: viewHist, ejercicios: viewEx, ajustes: viewSet }[ui.tab])();
  window.scrollTo(0, 0);
}
const SAFETY = `<div class="card safety"><strong>Seguridad:</strong> si aparece dolor de pecho, pesadez del brazo, falta de aire inusual, mareo o sudor frío, detén el ejercicio y busca atención urgente. PERT es un registro y guía, no una app médica ni da autorizaciones.</div>`;

function viewHoy() {
  if (!cur()) {
    const picked = ui.picked ?? ROUTINES[0].id;
    const rows = ROUTINES.map(r => `<label class="pick"><input type="radio" name="routine" value="${r.id}" ${picked === r.id ? 'checked' : ''}><span><strong>${esc(r.name)}</strong><br><span class="mut">${r.ex.map(i => exById(i).name).join(' · ')}</span></span></label>`).join('');
    const custom = EXERCISES.map(e => `<label class="pick"><input type="checkbox" class="cx" value="${e.id}"><span>${esc(e.name)}</span></label>`).join('');
    return `${SAFETY}
      <div class="card"><h2>Nueva sesión</h2><p class="mut">Elige una plantilla. Las series y repeticiones de la plantilla son <span class="badge b-prop">Propuesta</span>: solo cuentan como realizadas cuando tú las marcas.</p>
      ${rows}<button class="btn pri" data-act="start" style="width:100%">Empezar sesión</button></div>
      <div class="card"><details><summary>Sesión personalizada</summary>${custom}<button class="btn" data-act="start-custom" style="width:100%">Empezar con los marcados</button></details></div>`;
  }
  const c = cur(), ex = stepEx(), e = c.entries[ex.id], n = c.steps.length;
  const ref = reference(ex.id), prop = proposal(ex);
  const photo = db.photos[ex.id];
  const plan = ex.kind === 'cardio' ? `${ex.plan.minutes} min` : `${ex.plan.sets} × ${ex.plan.reps} · descanso ${ex.rest} s`;
  const unit = db.settings.unit;
  const sets = e.sets.map((s, i) => ex.kind === 'cardio'
    ? `<div class="set ${s.done ? 'done' : ''}" style="grid-template-columns:48px 1fr 1fr"><label class="n"><input type="checkbox" data-f="done" data-i="${i}" ${s.done ? 'checked' : ''} aria-label="Completado"></label>
        <label>Minutos<input type="number" inputmode="decimal" min="0" step="0.5" data-f="minutes" data-i="${i}" value="${esc(s.minutes)}" placeholder="${ex.plan.minutes}"></label>
        <label>Velocidad máx. (km/h)<input type="number" inputmode="decimal" min="0" step="0.1" data-f="speed" data-i="${i}" value="${esc(s.speed)}"></label></div>`
    : `<div class="set ${s.done ? 'done' : ''}" style="grid-template-columns:48px 1fr 1fr"><label class="n"><input type="checkbox" data-f="done" data-i="${i}" ${s.done ? 'checked' : ''} aria-label="Serie ${i + 1} completada"></label>
        <label>Peso (${unit}${e.mode === 'cuerpo' ? '' : ' ' + MODES[e.mode]})<input type="number" inputmode="decimal" min="0" step="0.5" data-f="weight" data-i="${i}" value="${esc(s.weight)}" ${e.mode === 'cuerpo' ? 'placeholder="0"' : ''}></label>
        <label>Repeticiones<input type="number" inputmode="numeric" min="0" step="1" data-f="reps" data-i="${i}" value="${esc(s.reps)}" placeholder="${ex.plan.reps}"></label></div>`).join('');
  const modeSel = ex.kind === 'cardio' ? '' : `<label class="mut">Cómo cuentas el peso
      <select data-f="mode">${Object.entries(MODES).map(([k, v]) => `<option value="${k}" ${e.mode === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>`;
  return `<div class="card"><div class="row sp"><span class="mut">Ejercicio ${c.idx + 1} de ${n}</span><button class="btn sm danger" data-act="cancel">Cancelar sesión</button></div>
      <div class="progress" role="progressbar" aria-valuenow="${c.idx + 1}" aria-valuemax="${n}"><i style="width:${((c.idx + 1) / n) * 100}%"></i></div></div>
    <div class="card"><div class="row sp"><h2>${esc(ex.name)}</h2><span class="badge b-prop">Propuesta: ${plan}</span></div>
      <div class="photo">${photo ? `<img src="${photo}" alt="${esc(ex.machine)}">` : `<span>📷 Sin foto de ${esc(ex.machine)}</span>`}
        <label class="btn sm" style="display:inline-block">${photo ? 'Cambiar foto' : 'Añadir foto de la máquina'}<input type="file" accept="image/*" hidden data-act="photo"></label></div></div>
    <div class="card"><details open><summary>Instrucciones</summary><dl>
      <dt>Postura y ajustes</dt><dd>${esc(ex.setup)}</dd><dt>Manos y pies</dt><dd>${esc(ex.hands)}</dd>
      <dt>Recorrido</dt><dd>${esc(ex.range)}</dd><dt>Respiración</dt><dd>${esc(ex.breath)}</dd>
      <dt>Ritmo</dt><dd>${esc(ex.tempo)}</dd><dt>Ajuste de peso</dt><dd>${esc(ex.adjust)}</dd></dl></details></div>
    <div class="card"><h3>Datos previos</h3>
      ${ref ? `<p><span class="badge b-ref">Referencia confirmada</span> <span class="mut">${fmtDate(ref.date)}</span><br>${esc(fmtSet(ex, ref.e))}</p>${ex.kind !== 'cardio' ? '<button class="btn sm" data-act="useref">Rellenar con la referencia</button>' : ''}` : '<p class="mut">Sin referencia todavía: se creará con lo que confirmes hoy.</p>'}
      ${prop ? `<p><span class="badge b-prop">Propuesta</span> ${esc(prop)} <span class="mut">(no es un dato registrado)</span></p>` : ''}</div>
    <div class="card"><div class="row sp"><h3>Registro de hoy</h3><label class="row mut"><input type="checkbox" data-f="skipped" ${e.skipped ? 'checked' : ''}> Omitido</label></div>
      ${e.skipped ? '<p class="mut">Marcado como omitido (p. ej. máquina ocupada). No cuenta como realizado.</p>' : `${modeSel}${sets}
      <p class="mut" id="totalnote">${totalNote(ex, e)}</p>
      <label>Esfuerzo percibido: <strong id="effv">${e.effort}</strong>/10<input type="range" min="1" max="10" step="1" value="${e.effort}" data-f="effort"></label>
      <div id="timer" class="card" ${ex.rest ? '' : 'hidden'}><div class="timer" id="tval">${ex.rest ? ex.rest + ' s' : ''}</div><div class="row" style="justify-content:center"><button class="btn sm" data-act="rest">Iniciar descanso</button><button class="btn sm" data-act="restoff">Parar</button></div></div>
      <h3 style="margin-top:12px">¿Síntomas durante el ejercicio?</h3>
      <div class="yn"><label class="si"><input type="radio" name="sym" data-f="symptoms" value="si" ${e.symptoms === 'si' ? 'checked' : ''}><span>Sí</span></label><label><input type="radio" name="sym" data-f="symptoms" value="no" ${e.symptoms === 'no' ? 'checked' : ''}><span>No</span></label></div>
      ${e.symptoms === 'si' ? `<div class="alert">Detén el ejercicio. Si hay dolor de pecho, pesadez del brazo, falta de aire inusual, mareo o sudor frío, busca atención urgente. Describe lo que sentiste en comentarios.</div>` : ''}`}
      <label style="display:block;margin-top:12px">Comentarios<textarea data-f="comment" placeholder="Cómo te sentiste, ajustes, sustituciones…">${esc(e.comment)}</textarea></label></div>
    <div class="nav"><button class="btn" data-act="prev" ${c.idx === 0 ? 'disabled' : ''}>← Anterior</button>
      <button class="btn pri" data-act="next">${c.idx === n - 1 ? 'Finalizar' : 'Siguiente →'}</button></div>`;
}
function totalNote(ex, e) {
  if (ex.kind === 'cardio' || e.mode === 'cuerpo') return '';
  const w = parseFloat(e.sets.find(s => s.weight !== '')?.weight);
  if (!w) return '';
  const u = db.settings.unit;
  if (e.mode === 'lado') return `${w} ${u} por lado = ${w * 2} ${u} añadidas (no incluye el carro o la barra).`;
  if (e.mode === 'mano') return `${w} ${u} por mano = ${w * 2} ${u} en total entre ambas manos.`;
  return `${w} ${u} totales.`;
}

function viewHist() {
  const list = [...db.sessions].reverse().map(s => {
    const done = Object.entries(s.entries).filter(([, e]) => !e.skipped && e.sets.some(x => x.done));
    const open = ui.openSession === s.id;
    return `<div class="item"><div class="row sp"><div><strong>${esc(s.routine)}</strong><br><span class="mut">${fmtDate(s.date)} · ${done.length} ejercicios realizados</span></div>
      <button class="btn sm" data-act="toggle" data-id="${s.id}">${open ? 'Cerrar' : 'Ver'}</button></div>
      ${open ? `<ul>${s.steps.map(id => { const ex = exById(id), e = s.entries[id]; if (!ex) return '';
        if (e.skipped) return `<li>${esc(ex.name)} — <em>omitido</em></li>`;
        if (!e.sets.some(x => x.done)) return `<li>${esc(ex.name)} — <em>sin series confirmadas</em>${e.comment ? `<br><span class="mut">${esc(e.comment)}</span>` : ''}</li>`;
        return `<li>${esc(ex.name)}: ${esc(fmtSet(ex, e)) || '—'}${e.symptoms === 'si' ? ' · <strong>síntomas: sí</strong>' : ''}${e.comment ? `<br><span class="mut">${esc(e.comment)}</span>` : ''}</li>`; }).join('')}</ul>
        <button class="btn sm danger" data-act="del" data-id="${s.id}">Borrar sesión</button>` : ''}</div>`;
  }).join('') || '<p class="mut">Aún no hay sesiones terminadas.</p>';
  return `<div class="card"><h2>Historial</h2><div class="list">${list}</div></div>
    <div class="card row"><button class="btn" data-act="export-json">Exportar JSON</button><button class="btn" data-act="export-csv">Exportar CSV</button>
      <label class="btn">Importar JSON<input type="file" accept="application/json" hidden data-act="import"></label></div>`;
}
function viewEx() {
  return `<div class="card"><h2>Ejercicios</h2><div class="list">${EXERCISES.map(ex => {
    const ref = reference(ex.id);
    return `<div class="item"><strong>${esc(ex.name)}</strong> <span class="badge b-prop">Propuesta ${ex.kind === 'cardio' ? ex.plan.minutes + ' min' : ex.plan.sets + '×' + ex.plan.reps}</span>
      <br>${ref ? `<span class="badge b-ref">Referencia</span> ${esc(fmtSet(ex, ref.e))} <span class="mut">(${fmtDate(ref.date)})</span>` : '<span class="mut">Sin referencia</span>'}</div>`;
  }).join('')}</div></div>`;
}
function viewSet() {
  const u = db.settings.unit;
  return `<div class="card"><h2>Ajustes</h2>
    <label>Unidad de peso<select data-act="unit"><option value="lb" ${u === 'lb' ? 'selected' : ''}>Libras (lb)</option><option value="kg" ${u === 'kg' ? 'selected' : ''}>Kilogramos (kg)</option></select></label>
    <p class="mut">Cada ejercicio indica si el peso es total, por mano o por lado.</p></div>
    <div class="card"><h3>Tus datos</h3><p class="mut">Todo queda en este dispositivo (sin cuenta ni servidor). Exporta una copia desde Historial con regularidad.</p>
      <button class="btn danger" data-act="wipe">Borrar todos los datos</button></div>${SAFETY}`;
}

/* ---------- Acciones ---------- */
let rest = { t: null, left: 0 };
function stopRest() { clearInterval(rest.t); rest.t = null; }
function startRest() {
  const ex = stepEx(); stopRest(); rest.left = ex.rest;
  const el = $('#tval'); if (!el) return;
  rest.t = setInterval(() => {
    rest.left--; const e2 = $('#tval'); if (!e2) return stopRest();
    e2.textContent = rest.left + ' s';
    if (rest.left <= 0) { stopRest(); e2.textContent = '¡Listo!'; navigator.vibrate?.([200, 100, 200]); }
  }, 1000);
  el.textContent = rest.left + ' s';
}
function finish() {
  const s = cur(); s.finished = new Date().toISOString(); delete s.idx;
  db.sessions.push(s); db.current = null; save(); stopRest();
  ui.tab = 'historial'; ui.openSession = s.id; render(); toast('Sesión guardada');
}
function download(name, text, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const csvCell = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
function exportCsv() {
  const rows = [['fecha', 'sesion', 'ejercicio', 'serie', 'realizada', 'peso', 'unidad', 'tipo_peso', 'repeticiones', 'minutos', 'velocidad_kmh', 'esfuerzo', 'sintomas', 'omitido', 'comentario']];
  db.sessions.forEach(s => s.steps.forEach(id => { const ex = exById(id), e = s.entries[id]; if (!ex) return;
    e.sets.forEach((x, i) => rows.push([s.date, s.routine, ex.name, i + 1, x.done ? 'sí' : 'no', x.weight ?? '', db.settings.unit, e.mode ?? '', x.reps ?? '', x.minutes ?? '', x.speed ?? '', e.effort, e.symptoms ?? '', e.skipped ? 'sí' : 'no', e.comment])); }));
  download('pert-historial.csv', rows.map(r => r.map(csvCell).join(',')).join('\n'), 'text/csv');
}
function resize(file) {
  return new Promise((res, rej) => {
    const img = new Image(); img.onload = () => {
      const k = Math.min(1, 640 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = img.width * k; c.height = img.height * k; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL('image/jpeg', 0.7)); URL.revokeObjectURL(img.src);
    }; img.onerror = rej; img.src = URL.createObjectURL(file);
  });
}

document.addEventListener('click', e => {
  const tab = e.target.closest('[data-tab]');
  if (tab) { ui.tab = tab.dataset.tab; return render(); }
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const a = b.dataset.act;
  if (a === 'start') { const r = ROUTINES.find(r => r.id === (document.querySelector('input[name=routine]:checked')?.value)) || ROUTINES[0]; ui.picked = r.id; startSession(r.name, r.ex); }
  else if (a === 'start-custom') { const ids = [...document.querySelectorAll('.cx:checked')].map(i => i.value); ids.length ? startSession('Sesión personalizada', ids) : toast('Marca al menos un ejercicio'); }
  else if (a === 'cancel') { if (confirm('¿Cancelar la sesión? No se guardará nada.')) { db.current = null; save(); stopRest(); render(); } }
  else if (a === 'prev') { cur().idx--; save(); stopRest(); render(); }
  else if (a === 'next') { const c = cur(); if (c.idx === c.steps.length - 1) { if (confirm('¿Finalizar y guardar la sesión?')) finish(); } else { c.idx++; save(); stopRest(); render(); } }
  else if (a === 'useref') {
    const ref = reference(stepEx().id), e2 = cur().entries[stepEx().id]; if (!ref) return;
    const last = ref.e.sets.find(s => s.done); e2.mode = ref.e.mode ?? e2.mode;
    e2.sets.forEach(s => { s.weight = last.weight; s.reps = last.reps; }); save(); render(); toast('Valores copiados. Marca cada serie solo cuando la hagas.');
  }
  else if (a === 'rest') startRest(); else if (a === 'restoff') { stopRest(); const t = $('#tval'); if (t) t.textContent = stepEx().rest + ' s'; }
  else if (a === 'toggle') { ui.openSession = ui.openSession === b.dataset.id ? null : b.dataset.id; render(); }
  else if (a === 'del') { if (confirm('¿Borrar esta sesión?')) { db.sessions = db.sessions.filter(s => s.id !== b.dataset.id); save(); render(); } }
  else if (a === 'export-json') download('pert-datos.json', JSON.stringify({ sessions: db.sessions, settings: db.settings }, null, 2), 'application/json');
  else if (a === 'export-csv') exportCsv();
  else if (a === 'wipe') { if (confirm('Se borrarán todas las sesiones y fotos de este dispositivo. ¿Continuar?')) { db = blank(); save(); render(); } }
});

document.addEventListener('input', e => {
  const t = e.target, f = t.dataset.f; if (!f || !cur()) return;
  const en = cur().entries[stepEx().id], i = t.dataset.i;
  if (f === 'effort') { en.effort = +t.value; $('#effv').textContent = t.value; }
  else if (f === 'comment') en.comment = t.value;
  else if (f === 'weight' || f === 'reps' || f === 'minutes' || f === 'speed') { en.sets[i][f] = t.value; if (f === 'weight') $('#totalnote').textContent = totalNote(stepEx(), en); }
  save();
});
document.addEventListener('change', async e => {
  const t = e.target, f = t.dataset.f, a = t.dataset.act;
  if (a === 'unit') { db.settings.unit = t.value; save(); return render(); }
  if (a === 'photo' && t.files[0]) { try { db.photos[stepEx().id] = await resize(t.files[0]); save(); render(); } catch { toast('No se pudo leer la imagen'); } return; }
  if (a === 'import' && t.files[0]) {
    try { const d = JSON.parse(await t.files[0].text()); const ids = new Set(db.sessions.map(s => s.id));
      (d.sessions || []).filter(s => s.id && s.entries && !ids.has(s.id)).forEach(s => db.sessions.push(s));
      db.sessions.sort((x, y) => x.date.localeCompare(y.date)); save(); render(); toast('Datos importados'); }
    catch { toast('Archivo no válido'); } return;
  }
  if (!f || !cur()) return;
  const en = cur().entries[stepEx().id];
  if (f === 'done') { en.sets[t.dataset.i].done = t.checked; save(); t.closest('.set').classList.toggle('done', t.checked); if (t.checked && stepEx().rest) startRest(); return; }
  if (f === 'skipped') { en.skipped = t.checked; save(); return render(); }
  if (f === 'symptoms') { en.symptoms = t.value; save(); return render(); }
  if (f === 'mode') { en.mode = t.value; save(); return render(); }
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
render();
