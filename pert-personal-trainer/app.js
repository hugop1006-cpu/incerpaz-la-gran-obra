'use strict';
// PERT Personal Trainer — PWA local-first. Todo se guarda en este dispositivo.
const KEY = 'pert.v1';
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const exById = id => EXERCISES.find(e => e.id === id);
const active = () => EXERCISES.filter(e => !e.archived);
const MODES = { lado: 'por lado', mano: 'por mano', total: 'totales', cuerpo: 'peso corporal' };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const blank = () => ({ sessions: [], photos: {}, settings: { unit: 'lb' }, current: null, templates: [], customExercises: [] });
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
const defPlan = ex => ({ ...ex.plan, rest: ex.rest });
const planOf = ex => cur()?.plans?.[ex.id] || defPlan(ex);
function newEntry(ex, plan = defPlan(ex)) {
  if (ex.kind === 'cardio') return { skipped: false, sets: [{ done: false, minutes: '', speed: '' }], effort: 5, comment: '', symptoms: null, mode: null };
  const n = plan.sets;
  return { skipped: false, mode: ex.mode, effort: 5, comment: '', symptoms: null,
    sets: Array.from({ length: n }, () => ({ done: false, weight: '', reps: '' })) };
}
function startSession(routineName, ids, plans = {}) {
  db.current = { id: uid(), date: new Date().toISOString(), routine: routineName, steps: ids, plans, idx: 0, entries: {} };
  ids.forEach(id => (db.current.entries[id] = newEntry(exById(id), plans[id])));
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
  return `${done.length} × ${r || '?'} · ${w || '?'} ${u} ${MODES[e.mode] || ''}${e.effort != null ? ` · esfuerzo ${e.effort}/10` : ' · esfuerzo no registrado'}`;
}
const fmtDate = iso => new Date(iso).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/* Propuesta: solo se MUESTRA; nunca se aplica ni cuenta como realizada. */
function proposal(ex) {
  const ref = reference(ex.id);
  if (!ref || ex.kind === 'cardio' || ex.mode === 'cuerpo') return null;
  const full = ref.e.sets.length >= planOf(ex).sets && ref.e.sets.every(s => s.done);
  if (full && ref.e.effort != null && ref.e.effort <= 7 && ref.e.symptoms !== 'si') return 'Completaste todas las series con esfuerzo ≤7/10: puedes valorar subir un escalón pequeño de peso, o una repetición más.';
  if (ref.e.effort >= 9 || ref.e.symptoms === 'si') return 'La última vez el esfuerzo fue muy alto o hubo síntomas: mantén o reduce el peso y prioriza la técnica.';
  return 'Mantén el peso y busca completar todas las series con buena técnica antes de subir.';
}

/* ---------- Render ---------- */
function render() {
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === (ui.tab === 'plantillas' ? 'hoy' : ui.tab)));
  const v = $('#view');
  v.innerHTML = ({ hoy: viewHoy, historial: viewHist, progreso: viewProg, ejercicios: viewEx, ajustes: viewSet, plantillas: viewTpl }[ui.tab])();
  window.scrollTo(0, 0);
  if (ui.tab === 'ajustes') fillSnaps();
}
const SAFETY = `<div class="card safety"><strong>Seguridad:</strong> si aparece dolor de pecho, pesadez del brazo, falta de aire inusual, mareo o sudor frío, detén el ejercicio y busca atención urgente. PERT es un registro y guía, no una app médica ni da autorizaciones.</div>`;

function viewHoy() {
  if (!cur()) {
    const all = allTemplates(), picked = all.find(r => r.id === ui.picked)?.id ?? all[0].id;
    const rows = all.map(r => `<label class="pick"><input type="radio" name="routine" value="${esc(r.id)}" ${picked === r.id ? 'checked' : ''}><span><strong>${esc(r.name)}</strong>${r.mine ? ' <span class="badge b-ref">Tuya</span>' : ''}<br><span class="mut">${r.items.length ? esc(r.items.map(i => exById(i.ex).name).join(' · ')) : 'Sin ejercicios'}</span></span></label>`).join('');
    const custom = active().map(e => `<label class="pick"><input type="checkbox" class="cx" value="${e.id}"><span>${esc(e.name)}</span></label>`).join('');
    return `${SAFETY}${backupCard()}
      <div class="card"><h2>Nueva sesión</h2><p class="mut">Elige una plantilla. Las series y repeticiones de la plantilla son <span class="badge b-prop">Propuesta</span>: solo cuentan como realizadas cuando tú las marcas.</p>
      ${rows}<button class="btn pri" data-act="start" style="width:100%">Empezar sesión</button>
      <button class="btn" data-act="tpl-open" style="width:100%;margin-top:8px">Crear o editar plantillas</button></div>
      <div class="card"><details><summary>Sesión personalizada</summary>${custom}<button class="btn" data-act="start-custom" style="width:100%">Empezar con los marcados</button></details></div>`;
  }
  const c = cur(), ex = stepEx(), e = c.entries[ex.id], n = c.steps.length;
  const ref = reference(ex.id), prop = proposal(ex);
  const photo = db.photos[ex.id];
  const pl = planOf(ex);
  const plan = ex.kind === 'cardio' ? `${pl.minutes} min` : `${pl.sets} × ${pl.reps} · descanso ${pl.rest} s`;
  const unit = db.settings.unit;
  const sets = e.sets.map((s, i) => ex.kind === 'cardio'
    ? `<div class="set ${s.done ? 'done' : ''}" style="grid-template-columns:48px 1fr 1fr"><label class="n"><input type="checkbox" data-f="done" data-i="${i}" ${s.done ? 'checked' : ''} aria-label="Completado"></label>
        <label>Minutos<input type="number" inputmode="decimal" min="0" step="0.5" data-f="minutes" data-i="${i}" value="${esc(s.minutes)}" placeholder="${pl.minutes}"></label>
        <label>Velocidad máx. (km/h)<input type="number" inputmode="decimal" min="0" step="0.1" data-f="speed" data-i="${i}" value="${esc(s.speed)}"></label></div>`
    : `<div class="set ${s.done ? 'done' : ''}" style="grid-template-columns:48px 1fr 1fr"><label class="n"><input type="checkbox" data-f="done" data-i="${i}" ${s.done ? 'checked' : ''} aria-label="Serie ${i + 1} completada"></label>
        <label>Peso (${unit}${e.mode === 'cuerpo' ? '' : ' ' + MODES[e.mode]})<input type="number" inputmode="decimal" min="0" step="0.5" data-f="weight" data-i="${i}" value="${esc(s.weight)}" ${e.mode === 'cuerpo' ? 'placeholder="0"' : ''}></label>
        <label>Repeticiones<input type="number" inputmode="numeric" min="0" step="1" data-f="reps" data-i="${i}" value="${esc(s.reps)}" placeholder="${pl.reps}"></label></div>`).join('');
  const modeSel = ex.kind === 'cardio' ? '' : `<label class="mut">Cómo cuentas el peso
      <select data-f="mode">${Object.entries(MODES).map(([k, v]) => `<option value="${k}" ${e.mode === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>`;
  return `<div class="card"><div class="row sp"><span class="mut">Ejercicio ${c.idx + 1} de ${n}</span><button class="btn sm danger" data-act="cancel">Cancelar sesión</button></div>
      <div class="progress" role="progressbar" aria-valuenow="${c.idx + 1}" aria-valuemax="${n}"><i style="width:${((c.idx + 1) / n) * 100}%"></i></div></div>
    <div class="card"><div class="row sp"><h2>${esc(ex.name)}</h2><span class="badge b-prop">Propuesta: ${plan}</span></div>
      <div class="photo">${photo ? `<img src="${photo}" alt="${esc(ex.machine)}">` : `<span>📷 Sin foto de ${esc(ex.machine)}</span>`}
        <label class="btn sm" style="display:inline-block">${photo ? 'Cambiar foto' : 'Añadir foto de la máquina'}<input type="file" accept="image/*" hidden data-act="photo"></label></div></div>
    <div class="card"><details open><summary>Instrucciones</summary><dl>
      <dt>Postura y ajustes</dt><dd>${esc(ex.setup || '—')}</dd><dt>Manos y pies</dt><dd>${esc(ex.hands || '—')}</dd>
      <dt>Recorrido</dt><dd>${esc(ex.range || '—')}</dd><dt>Respiración</dt><dd>${esc(ex.breath || '—')}</dd>
      <dt>Ritmo</dt><dd>${esc(ex.tempo || '—')}</dd><dt>Ajuste de peso</dt><dd>${esc(ex.adjust || '—')}</dd></dl></details></div>
    <div class="card"><h3>Datos previos</h3>
      ${ref ? `<p><span class="badge b-ref">Referencia confirmada</span> <span class="mut">${fmtDate(ref.date)}</span><br>${esc(fmtSet(ex, ref.e))}</p>${ex.kind !== 'cardio' ? '<button class="btn sm" data-act="useref">Rellenar con la referencia</button>' : ''}` : '<p class="mut">Sin referencia todavía: se creará con lo que confirmes hoy.</p>'}
      ${prop ? `<p><span class="badge b-prop">Propuesta</span> ${esc(prop)} <span class="mut">(no es un dato registrado)</span></p>` : ''}</div>
    <div class="card"><div class="row sp"><h3>Registro de hoy</h3><label class="row mut"><input type="checkbox" data-f="skipped" ${e.skipped ? 'checked' : ''}> Omitido</label></div>
      ${e.skipped ? '<p class="mut">Marcado como omitido (p. ej. máquina ocupada). No cuenta como realizado.</p>' : `${modeSel}${sets}
      <p class="mut" id="totalnote">${totalNote(ex, e)}</p>
      <label>Esfuerzo percibido: <strong id="effv">${e.effort}</strong>/10<input type="range" min="1" max="10" step="1" value="${e.effort}" data-f="effort"></label>
      <div id="timer" class="card" ${pl.rest ? '' : 'hidden'}><div class="timer" id="tval">${pl.rest ? pl.rest + ' s' : ''}</div><div class="row" style="justify-content:center"><button class="btn sm" data-act="rest">Iniciar descanso</button><button class="btn sm" data-act="restoff">Parar</button></div></div>
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
      <button class="btn sm" data-act="toggle" data-id="${esc(s.id)}">${open ? 'Cerrar' : 'Ver'}</button></div>
      ${open ? `<ul>${s.steps.map(id => { const ex = exById(id), e = s.entries[id]; if (!ex) return '';
        if (e.skipped) return `<li>${esc(ex.name)} — <em>omitido</em></li>`;
        if (!e.sets.some(x => x.done)) return `<li>${esc(ex.name)} — <em>sin series confirmadas</em>${e.comment ? `<br><span class="mut">${esc(e.comment)}</span>` : ''}</li>`;
        return `<li>${esc(ex.name)}: ${esc(fmtSet(ex, e)) || '—'}${e.symptoms === 'si' ? ' · <strong>síntomas: sí</strong>' : ''}${e.comment ? `<br><span class="mut">${esc(e.comment)}</span>` : ''}</li>`; }).join('')}</ul>
        <button class="btn sm danger" data-act="del" data-id="${esc(s.id)}">Borrar sesión</button>` : ''}</div>`;
  }).join('') || '<p class="mut">Aún no hay sesiones terminadas.</p>';
  return `<div class="card"><h2>Historial</h2><div class="list">${list}</div></div>
    <div class="card row"><button class="btn" data-act="export-json">Exportar copia (JSON)</button><button class="btn" data-act="export-csv">Exportar CSV</button>
      <label class="btn">Importar JSON<input type="file" accept="application/json" hidden data-act="import"></label></div>`;
}
function viewEx() {
  if (ui.exDraft) return viewExForm();
  return `<div class="card"><div class="row sp"><h2>Ejercicios</h2><button class="btn sm pri" data-act="ex-new">+ Nuevo ejercicio</button></div><div class="list">${active().map(ex => {
    const ref = reference(ex.id);
    return `<div class="item"><strong>${esc(ex.name)}</strong> ${ex.custom ? '<span class="badge b-ref">Propio</span>' : ''} <span class="badge b-prop">Propuesta ${ex.kind === 'cardio' ? ex.plan.minutes + ' min' : ex.plan.sets + '×' + ex.plan.reps}</span>
      <br>${ref ? `<span class="badge b-ref">Referencia</span> ${esc(fmtSet(ex, ref.e))} <span class="mut">(${fmtDate(ref.date)})</span>` : '<span class="mut">Sin referencia</span>'}
      ${ex.custom ? `<div class="row" style="margin-top:6px"><button class="btn sm" data-act="ex-edit" data-id="${esc(ex.id)}">Editar</button><button class="btn sm danger" data-act="ex-del" data-id="${esc(ex.id)}">Eliminar</button></div>` : ''}</div>`;
  }).join('')}</div></div>`;
}
/* ---------- Ejercicios propios ---------- */
// Se guardan en el dispositivo. Los textos de la ficha son tuyos; la app no los valida clínicamente.
const TEXTS = [['setup', 'Postura y ajustes', 'Altura del asiento, agarre, posición de espalda…'], ['hands', 'Manos y pies', 'Dónde van las manos y los pies'], ['range', 'Recorrido', 'Hasta dónde bajas y subes'], ['breath', 'Respiración', 'Cuándo inhalas y exhalas'], ['tempo', 'Ritmo', 'Ej. bajada 3 s, subida 2 s'], ['adjust', 'Regla de ajuste de peso', 'Cuándo subir, mantener o bajar']];
const exType = ex => ex.kind === 'cardio' ? 'cardio' : ex.mode === 'cuerpo' ? 'cuerpo' : 'fuerza';
function draftOf(ex) {
  const d = { id: ex?.id || null, name: ex?.name || '', type: ex ? exType(ex) : 'fuerza', mode: ex?.mode && ex.mode !== 'cuerpo' ? ex.mode : 'total', machine: ex?.machine || '',
    sets: ex?.plan.sets ?? 3, reps: ex?.plan.reps ?? 10, rest: ex?.rest ?? 60, minutes: ex?.plan.minutes ?? 10 };
  TEXTS.forEach(([k]) => (d[k] = ex?.[k] || '')); return d;
}
function viewExForm() {
  const d = ui.exDraft, cardio = d.type === 'cardio', fuerza = d.type === 'fuerza';
  const num = (k, lab) => `<label>${lab}<input type="number" inputmode="numeric" data-x="${k}" value="${esc(d[k])}"></label>`;
  return `<div class="card xf"><h2>${d.id ? 'Editar ejercicio' : 'Nuevo ejercicio'}</h2>
    <label>Nombre<input type="text" maxlength="60" data-x="name" value="${esc(d.name)}" placeholder="Ej. Press inclinado en máquina"></label>
    <label style="display:block;margin-top:8px">Tipo<select data-x="type"><option value="fuerza" ${fuerza ? 'selected' : ''}>Fuerza con peso</option><option value="cuerpo" ${d.type === 'cuerpo' ? 'selected' : ''}>Fuerza con peso corporal</option><option value="cardio" ${cardio ? 'selected' : ''}>Cardio (minutos y velocidad)</option></select></label>
    ${fuerza ? `<label style="display:block;margin-top:8px">El peso se cuenta…<select data-x="mode">${['lado', 'mano', 'total'].map(k => `<option value="${k}" ${d.mode === k ? 'selected' : ''}>${MODES[k]}</option>`).join('')}</select></label>` : ''}
    <label style="display:block;margin-top:8px">Máquina o equipo<input type="text" maxlength="60" data-x="machine" value="${esc(d.machine)}"></label>
    <h3 style="margin-top:12px">Propuesta del plan</h3>
    <div class="row" style="gap:8px">${cardio ? num('minutes', 'Minutos') : num('sets', 'Series') + num('reps', 'Reps') + num('rest', 'Descanso (s)')}</div>
    <h3 style="margin-top:12px">Ficha (opcional)</h3>
    ${TEXTS.map(([k, lab, ph]) => `<label style="display:block;margin-top:6px">${lab}<textarea data-x="${k}" maxlength="400" placeholder="${ph}">${esc(d[k])}</textarea></label>`).join('')}
    <div class="nav"><button class="btn" data-act="ex-cancel">Cancelar</button><button class="btn pri" data-act="ex-save">Guardar</button></div></div>`;
}
function cleanEx(r) {
  if (!r || typeof r.id !== 'string' || typeof r.name !== 'string' || !r.name.trim()) return null;
  const cardio = r.kind === 'cardio', mode = cardio ? undefined : ['lado', 'mano', 'total', 'cuerpo'].includes(r.mode) ? r.mode : 'total';
  const txt = v => (typeof v === 'string' ? v.slice(0, 400) : '');
  const o = { id: r.id.slice(0, 40), name: r.name.trim().slice(0, 60), kind: cardio ? 'cardio' : 'fuerza', mode, machine: txt(r.machine).slice(0, 60),
    plan: cardio ? { minutes: clamp(r.plan?.minutes ?? 10, LIM.minutes) } : { sets: clamp(r.plan?.sets ?? 3, LIM.sets), reps: clamp(r.plan?.reps ?? 10, LIM.reps) },
    rest: cardio ? 0 : clamp(r.rest ?? 60, LIM.rest), custom: true };
  TEXTS.forEach(([k]) => (o[k] = txt(r[k]))); if (r.archived) o.archived = true; return o;
}
function cleanSession(r) {
  if (!r || typeof r.id !== 'string' || !r.entries || typeof r.entries !== 'object' || isNaN(Date.parse(r.date))) return null;
  const str = (v, n) => (v === '' || v == null ? '' : String(v).slice(0, n)), steps = (Array.isArray(r.steps) ? r.steps : []).filter(id => typeof id === 'string' && exById(id) && r.entries[id] && typeof r.entries[id] === 'object');
  const entries = {};
  steps.forEach(id => {
    const e = r.entries[id], eff = Number(e.effort);
    entries[id] = { skipped: e.skipped === true, mode: e.mode in MODES ? e.mode : null, effort: e.effort != null && eff >= 1 && eff <= 10 ? Math.round(eff) : null,
      comment: str(e.comment, 400), symptoms: e.symptoms === 'si' || e.symptoms === 'no' ? e.symptoms : null,
      sets: (Array.isArray(e.sets) ? e.sets : []).slice(0, 10).map(x => ({ done: x?.done === true, weight: str(x?.weight, 8), reps: str(x?.reps, 8), minutes: str(x?.minutes, 8), speed: str(x?.speed, 8) })) };
  });
  return steps.length ? { id: r.id.slice(0, 40), date: new Date(r.date).toISOString(), routine: str(r.routine, 60) || 'Sesión importada', steps, entries, finished: new Date(r.date).toISOString() } : null;
}
function registerEx(o) { const i = EXERCISES.findIndex(e => e.id === o.id); if (i >= 0) EXERCISES.splice(i, 1); EXERCISES.push(o); }
function saveExDraft() {
  const d = ui.exDraft, cardio = d.type === 'cardio';
  if (!d.name.trim()) return toast('Ponle un nombre al ejercicio');
  const raw = { id: d.id || 'c-' + uid(), name: d.name, kind: cardio ? 'cardio' : 'fuerza', mode: d.type === 'cuerpo' ? 'cuerpo' : d.mode, machine: d.machine || (cardio ? '' : 'Máquina'),
    plan: cardio ? { minutes: d.minutes === '' ? 10 : d.minutes } : { sets: d.sets === '' ? 3 : d.sets, reps: d.reps === '' ? 10 : d.reps }, rest: d.rest === '' ? 60 : d.rest };
  TEXTS.forEach(([k]) => (raw[k] = d[k]));
  const o = cleanEx(raw); registerEx(o);
  db.customExercises = db.customExercises.filter(x => x.id !== o.id).concat([o]); save(); ui.exDraft = null; render(); toast('Ejercicio guardado');
}
function deleteEx(id) {
  if (cur()?.steps.includes(id)) return toast('Está en tu sesión actual: termínala o cancélala primero.');
  const hist = db.sessions.some(s => s.entries?.[id]);
  if (!confirm(hist ? 'Este ejercicio tiene historial. Se ocultará de las listas pero tus sesiones y gráficas se conservan. ¿Continuar?' : '¿Eliminar este ejercicio?')) return;
  db.templates.forEach(t => (t.items = t.items.filter(i => i.ex !== id)));
  if (hist) { const o = { ...exById(id), archived: true }; registerEx(o); db.customExercises = db.customExercises.map(x => (x.id === id ? o : x)); }
  else { const i = EXERCISES.findIndex(e => e.id === id); if (i >= 0) EXERCISES.splice(i, 1); db.customExercises = db.customExercises.filter(x => x.id !== id); }
  save(); render();
}

function viewSet() {
  const u = db.settings.unit;
  return `<div class="card"><h2>Ajustes</h2>
    <label>Unidad de peso<select data-act="unit"><option value="lb" ${u === 'lb' ? 'selected' : ''}>Libras (lb)</option><option value="kg" ${u === 'kg' ? 'selected' : ''}>Kilogramos (kg)</option></select></label>
    <p class="mut">Cada ejercicio indica si el peso es total, por mano o por lado.</p></div>
    ${backupSettings()}
    <div class="card"><h3>Tus datos</h3><p class="mut">Todo queda en este dispositivo (sin cuenta ni servidor).</p>
      <button class="btn danger" data-act="wipe">Borrar todos los datos</button></div>${SAFETY}`;
}

/* ---------- Plantillas ---------- */
// Las plantillas integradas no se editan (siempre puedes volver a ellas); se duplican para personalizar.
// Series/reps/descanso de una plantilla son PROPUESTAS: no cuentan como realizadas.
const LIM = { sets: [1, 10], reps: [1, 100], rest: [0, 600], minutes: [1, 180] };
const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, Math.round(+v) || lo));
const itemOf = id => { const ex = exById(id), p = defPlan(ex); return ex.kind === 'cardio' ? { ex: id, minutes: p.minutes, rest: 0 } : { ex: id, sets: p.sets, reps: p.reps, rest: p.rest }; };
function allTemplates() {
  return [...ROUTINES.map(r => ({ id: r.id, name: r.name, items: r.ex.map(itemOf), mine: false })), ...db.templates.map(t => ({ ...t, mine: true }))];
}
const tplById = id => db.templates.find(t => t.id === id);
function tplSummary(it) { const ex = exById(it.ex); return ex.kind === 'cardio' ? `${it.minutes} min` : `${it.sets} × ${it.reps} · ${it.rest} s`; }
function viewTpl() {
  const t = ui.tplEdit && tplById(ui.tplEdit);
  if (t) {
    const unused = active().filter(e => !t.items.some(i => i.ex === e.id));
    const items = t.items.map((it, n) => { const ex = exById(it.ex), cardio = ex.kind === 'cardio';
      const f = (k, lab) => `<label>${lab}<input type="number" inputmode="numeric" min="${LIM[k][0]}" max="${LIM[k][1]}" data-t="${k}" data-n="${n}" value="${it[k]}"></label>`;
      return `<div class="item"><div class="row sp"><strong>${n + 1}. ${esc(ex.name)}</strong><span class="row">
        <button class="btn sm" data-act="tpl-up" data-n="${n}" ${n === 0 ? 'disabled' : ''} aria-label="Subir">↑</button><button class="btn sm" data-act="tpl-down" data-n="${n}" ${n === t.items.length - 1 ? 'disabled' : ''} aria-label="Bajar">↓</button><button class="btn sm danger" data-act="tpl-rm" data-n="${n}" aria-label="Quitar">✕</button></span></div>
        <div class="row" style="margin-top:6px;gap:8px">${cardio ? f('minutes', 'Minutos') : f('sets', 'Series') + f('reps', 'Reps') + f('rest', 'Descanso (s)')}</div></div>`; }).join('') || '<p class="mut">Plantilla vacía: añade ejercicios.</p>';
    return `<div class="card"><label>Nombre<input type="text" maxlength="40" data-t="name" value="${esc(t.name)}"></label>
      <p class="mut">Series, repeticiones y descanso son <span class="badge b-prop">Propuesta</span> para tu sesión; solo cuentan como realizadas cuando las marques.</p>
      <div class="list">${items}</div>
      ${unused.length ? `<div class="row" style="margin-top:10px"><select id="tpl-add" aria-label="Añadir ejercicio">${unused.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select><button class="btn" data-act="tpl-add">Añadir ejercicio</button></div>` : ''}
      <div class="nav"><button class="btn pri" data-act="tpl-done">Listo</button></div></div>`;
  }
  const list = allTemplates().map(r => `<div class="item"><div class="row sp"><strong>${esc(r.name)}</strong>${r.mine ? '<span class="badge b-ref">Tuya</span>' : '<span class="badge">Integrada</span>'}</div>
    <div class="mut">${r.items.length ? r.items.map(i => `${esc(exById(i.ex).name)} (${tplSummary(i)})`).join(' · ') : 'Sin ejercicios'}</div>
    <div class="row" style="margin-top:6px">${r.mine ? `<button class="btn sm" data-act="tpl-edit" data-id="${esc(r.id)}">Editar</button>` : ''}<button class="btn sm" data-act="tpl-dup" data-id="${esc(r.id)}">Duplicar</button>${r.mine ? `<button class="btn sm danger" data-act="tpl-del" data-id="${esc(r.id)}">Eliminar</button>` : ''}</div></div>`).join('');
  return `<div class="card"><div class="row sp"><h2>Plantillas</h2><button class="btn sm" data-act="tpl-back">← Volver</button></div>
    <div class="list">${list}</div><button class="btn pri" data-act="tpl-new" style="width:100%;margin-top:10px">Nueva plantilla</button></div>`;
}

/* ---------- Progreso (gráficas) ---------- */
// Solo cuentan series CONFIRMADAS de sesiones terminadas; propuestas y omitidos nunca entran.
function series(exId) {
  const out = [];
  db.sessions.forEach(s => {
    const e = s.entries?.[exId]; if (!e || e.skipped) return;
    const done = e.sets.filter(x => x.done); if (!done.length) return;
    const num = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
    const ws = done.map(x => num(x.weight)).filter(n => n !== null);
    out.push({ date: s.date, mode: e.mode, effort: e.effort, sets: done.length,
      maxW: ws.length ? Math.max(...ws) : null,
      vol: done.reduce((a, x) => a + (num(x.weight) || 0) * (num(x.reps) || 0), 0),
      reps: done.reduce((a, x) => a + (num(x.reps) || 0), 0),
      minutes: done.reduce((a, x) => a + (num(x.minutes) || 0), 0),
      speed: Math.max(0, ...done.map(x => num(x.speed) || 0)) || null });
  });
  return out;
}
const METRICS = {
  fuerza: [['maxW', 'Peso máximo'], ['vol', 'Volumen'], ['reps', 'Repeticiones'], ['effort', 'Esfuerzo']],
  cuerpo: [['reps', 'Repeticiones'], ['effort', 'Esfuerzo']],
  cardio: [['minutes', 'Minutos'], ['speed', 'Velocidad máx.'], ['effort', 'Esfuerzo']]
};
const shortDate = iso => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' });
function lineChart(pts, label) {
  const W = 340, H = 190, L = 40, R = 12, T = 14, B = 28;
  const ys = pts.map(p => p.y); let lo = Math.min(...ys), hi = Math.max(...ys);
  const rlo = lo, rhi = hi;
  if (lo === hi) { lo -= 1; hi += 1; } const pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
  const X = i => pts.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (pts.length - 1);
  const Y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const fmt = v => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10);
  const grid = [0, 1, 2].map(k => { const v = rlo === rhi ? rlo + (k - 1) : rlo + ((rhi - rlo) * k) / 2; return `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" style="stroke:var(--line)"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end" style="fill:var(--mut)" font-size="11">${fmt(v)}</text>`; }).join('');
  const maxI = ys.lastIndexOf(Math.max(...ys));
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${X(i)},${Y(p.y)}`).join('');
  const dots = pts.map((p, i) => `<circle cx="${X(i)}" cy="${Y(p.y)}" r="${i === maxI ? 6 : 4}" style="fill:${i === maxI ? 'var(--warn)' : 'var(--acc)'};stroke:var(--card)" stroke-width="2"><title>${shortDate(p.x)}: ${fmt(p.y)}</title></circle>`).join('');
  const ticks = `<text x="${X(0)}" y="${H - 8}" text-anchor="${pts.length > 1 ? 'start' : 'middle'}" style="fill:var(--mut)" font-size="11">${shortDate(pts[0].x)}</text>` +
    (pts.length > 1 ? `<text x="${X(pts.length - 1)}" y="${H - 8}" text-anchor="end" style="fill:var(--mut)" font-size="11">${shortDate(pts[pts.length - 1].x)}</text>` : '');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}" style="width:100%;height:auto">${grid}<path d="${path}" fill="none" style="stroke:var(--acc)" stroke-width="2.5" stroke-linejoin="round"/>${dots}${ticks}</svg>`;
}
function weekBars() {
  const monday = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.getTime(); };
  const now = monday(new Date()), WK = 7 * 864e5, counts = Array(8).fill(0);
  db.sessions.forEach(s => { const k = Math.round((now - monday(s.date)) / WK); if (k >= 0 && k < 8) counts[7 - k]++; });
  const max = Math.max(1, ...counts), W = 340, H = 110, bw = 28, gap = (W - 8 * bw) / 9;
  const bars = counts.map((c, i) => { const h = (c / max) * (H - 36), x = gap + i * (bw + gap);
    const d = new Date(now - (7 - i) * WK);
    return `<rect x="${x}" y="${H - 20 - h}" width="${bw}" height="${h}" rx="4" style="fill:var(--acc)"><title>${c} sesiones</title></rect>
      <text x="${x + bw / 2}" y="${H - 22 - h}" text-anchor="middle" style="fill:var(--fg)" font-size="11">${c || ''}</text>
      <text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle" style="fill:var(--mut)" font-size="10">${shortDate(d)}</text>`; }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Sesiones por semana, últimas 8 semanas" style="width:100%;height:auto">${bars}</svg>`;
}
function viewProg() {
  if (!db.sessions.length) return `<div class="card"><h2>Progreso</h2><p class="mut">Cuando termines tu primera sesión verás aquí tus gráficas. Solo cuentan series que hayas confirmado.</p></div>`;
  const withData = EXERCISES.filter(ex => series(ex.id).length);
  const sel = withData.find(e => e.id === ui.pex) || withData[0];
  const week = `<div class="card"><h3>Sesiones por semana</h3>${weekBars()}</div>`;
  if (!sel) return week + `<div class="card"><p class="mut">Aún no hay series confirmadas para graficar.</p></div>`;
  const kind = sel.kind === 'cardio' ? 'cardio' : sel.mode === 'cuerpo' ? 'cuerpo' : 'fuerza';
  const metrics = METRICS[kind], m = metrics.find(x => x[0] === ui.pmet) ? ui.pmet : metrics[0][0];
  let data = series(sel.id), warn = '';
  if (kind === 'fuerza') { // no mezclar por lado / por mano / total
    const lastMode = data[data.length - 1].mode;
    if (data.some(d => d.mode !== lastMode)) { warn = `<p class="alert" style="font-weight:400">Cambiaste el tipo de peso en este ejercicio. Se grafican solo las sesiones “${MODES[lastMode]}”, porque no son comparables entre sí.</p>`; data = data.filter(d => d.mode === lastMode); }
  }
  const pts = data.filter(d => d[m] !== null && d[m] !== undefined && (m !== 'speed' || d[m] > 0)).map(d => ({ x: d.date, y: d[m] }));
  const unit = db.settings.unit, mdl = metrics.find(x => x[0] === m)[1];
  const u = { maxW: unit, vol: unit + '·rep', reps: 'rep', effort: '/10', minutes: 'min', speed: 'km/h' }[m];
  const best = pts.length ? pts.reduce((a, b) => (b.y >= a.y ? b : a)) : null;
  const first = pts[0], last = pts[pts.length - 1];
  const delta = pts.length > 1 ? Math.round((last.y - first.y) * 10) / 10 : null;
  const hasMode = kind === 'fuerza' ? ` · ${MODES[data[data.length - 1].mode]}` : '';
  const rows = [...data].reverse().slice(0, 12).map(d => `<tr><td>${shortDate(d.date)}</td><td>${d.sets} s.</td><td>${d.maxW ?? '—'}${d.maxW != null ? ' ' + unit : ''}</td><td>${d.reps || d.minutes ? (kind === 'cardio' ? d.minutes + ' min' : d.reps + ' rep') : '—'}</td><td>${d.effort != null ? d.effort + '/10' : '—'}</td></tr>`).join('');
  return `${week}
    <div class="card"><h2>Progreso por ejercicio</h2>
      <select data-act="pex" aria-label="Ejercicio">${withData.map(ex => `<option value="${ex.id}" ${ex.id === sel.id ? 'selected' : ''}>${esc(ex.name)}</option>`).join('')}</select>
      <div class="row" style="margin:10px 0">${metrics.map(([k, n]) => `<button class="btn sm ${k === m ? 'pri' : ''}" data-act="pmet" data-m="${k}">${n}</button>`).join('')}</div>
      ${warn}
      ${pts.length ? `<div class="row sp"><span><span class="badge b-ok">Realizado</span> <span class="mut">${esc(mdl)}${hasMode} (${u})</span></span>
        ${m !== 'effort' && best ? `<span class="badge b-prop">🏆 Récord ${Math.round(best.y * 10) / 10} ${u}</span>` : ''}</div>
        ${lineChart(pts, `${sel.name}: ${mdl}`)}
        <p class="mut">${pts.length} sesiones${delta !== null ? ` · cambio desde la primera: ${delta > 0 ? '+' : ''}${delta} ${u}` : ' · necesitas al menos 2 sesiones para ver tendencia'}.${m === 'effort' ? ' Esfuerzo bajo con mismo peso suele indicar adaptación; la decisión de subir carga es tuya.' : ''}</p>`
      : '<p class="mut">No hay datos de esta métrica para este ejercicio.</p>'}
      <details><summary>Últimas sesiones</summary><div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Fecha</th><th>Series</th><th>Peso máx.</th><th>Total</th><th>Esfuerzo</th></tr></thead><tbody>${rows}</tbody></table></div></details>
      <p class="mut">Los pesos no se convierten entre lb y kg: cada gráfica usa los números tal como los registraste.</p></div>`;
}

/* ---------- Copias de seguridad ---------- */
// Sin servidor: copias automáticas en IndexedDB (protegen de errores) + copia a tu nube vía menú de compartir.
const dropCustom = () => { for (let i = EXERCISES.length - 1; i >= 0; i--) if (EXERCISES[i].custom) EXERCISES.splice(i, 1); };
function backupData() {
  return { app: 'pert', version: 1, exportedAt: new Date().toISOString(), sessions: db.sessions, templates: db.templates, customExercises: db.customExercises,
    photos: db.photos, settings: { unit: db.settings.unit } };
}
// Fusiona datos externos (siempre saneados) dentro de t. Devuelve cuántas sesiones se añadieron.
function ingest(t, d) {
  const arr = v => (Array.isArray(v) ? v : []), eids = new Set(EXERCISES.map(e => e.id));
  arr(d.customExercises).forEach(r => { const o = cleanEx(r); if (o && !eids.has(o.id)) { registerEx(o); t.customExercises.push(o); eids.add(o.id); } });
  const ids = new Set(t.sessions.map(s => s.id)); let added = 0;
  arr(d.sessions).forEach(r => { const c = cleanSession(r); if (c && !ids.has(c.id)) { t.sessions.push(c); ids.add(c.id); added++; } });
  const tids = new Set(t.templates.map(x => x.id));
  arr(d.templates).filter(x => x && typeof x.id === 'string' && typeof x.name === 'string' && Array.isArray(x.items) && !tids.has(x.id))
    .forEach(x => t.templates.push({ id: x.id.slice(0, 40), name: x.name.slice(0, 40), items: x.items.filter(i => i && exById(i.ex)).map(i => ({ ...itemOf(i.ex), ...Object.fromEntries(Object.keys(LIM).filter(k => k in itemOf(i.ex)).map(k => [k, clamp(i[k], LIM[k])])) })) }));
  if (d.photos && typeof d.photos === 'object') Object.entries(d.photos).forEach(([k, v]) => {
    if (exById(k) && !t.photos[k] && typeof v === 'string' && v.length < 400000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(v)) t.photos[k] = v; });
  t.sessions.sort((x, y) => x.date.localeCompare(y.date)); return added;
}
async function restoreData(d) {
  if (cur()) return toast('Termina o cancela la sesión actual antes de restaurar.');
  await snap('Antes de restaurar');
  const old = db.customExercises.slice(); dropCustom();
  const next = blank(); next.settings = { ...db.settings };
  const added = ingest(next, d);
  if (!added && !next.templates.length && !next.customExercises.length && !Object.keys(next.photos).length) { dropCustom(); old.forEach(registerEx); return toast('El archivo no contiene datos reconocibles. No se cambió nada.'); }
  if (d.settings?.unit === 'kg' || d.settings?.unit === 'lb') next.settings.unit = d.settings.unit;
  db = next; save(); render(); toast(`Restaurado: ${added} sesiones`);
}
async function wipeAll() {
  if (cur()) return toast('Termina o cancela la sesión actual antes de borrar.');
  if (!confirm('Se borrarán todas las sesiones, plantillas, ejercicios propios y fotos de este dispositivo. Antes se guarda una copia automática. ¿Continuar?')) return;
  await snap('Antes de borrar'); dropCustom(); db = blank(); save(); render();
  if (confirm('¿Borrar también las copias automáticas de este dispositivo? (Aceptar = no podrás recuperar nada)')) { await snapClear(); render(); }
}
const hash = str => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return h; };
const idb = () => new Promise((res, rej) => { const r = indexedDB.open('pert-backups', 1); r.onupgradeneeded = () => r.result.createObjectStore('snaps', { keyPath: 'ts' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function snapOp(mode, fn) {
  const d = await idb();
  return new Promise((res, rej) => { const t = d.transaction('snaps', mode), req = fn(t.objectStore('snaps')); t.oncomplete = () => { d.close(); res(req?.result); }; t.onerror = t.onabort = () => { d.close(); rej(t.error); }; });
}
const snapAll = async () => { try { return ((await snapOp('readonly', s => s.getAll())) || []).sort((a, b) => a.ts - b.ts); } catch { return []; } };
const snapClear = async () => { try { await snapOp('readwrite', s => s.clear()); } catch { /* sin IndexedDB */ } };
async function snap(reason) {
  try {
    if (!db.sessions.length && !db.templates.length && !db.customExercises.length && !Object.keys(db.photos).length) return;
    const text = JSON.stringify(backupData()), h = hash(text.replace(/"exportedAt":"[^"]*"/, '')), all = await snapAll();
    if (all.length && all[all.length - 1].h === h) return;
    await snapOp('readwrite', s => s.put({ ts: Date.now(), reason, h, sessions: db.sessions.length, text }));
    for (const r of all.slice(0, Math.max(0, all.length + 1 - 7))) await snapOp('readwrite', s => s.delete(r.ts));
  } catch { /* la copia automática nunca debe romper la app */ }
}
async function saveBackup() {
  const text = JSON.stringify(backupData()), name = `pert-copia-${new Date().toISOString().slice(0, 10)}.json`, file = new File([text], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Copia de seguridad PERT' });
    else download(name, text, 'application/json');
  } catch (e) {
    if (e?.name === 'AbortError') return toast('Copia cancelada: no se guardó.');
    download(name, text, 'application/json');
  }
  db.settings.lastBackup = Date.now(); save(); render(); toast('Copia lista. Comprueba que quedó en tu nube o en Archivos.');
}
const unsaved = () => db.sessions.filter(s => Date.parse(s.finished || s.date) > (db.settings.lastBackup || 0)).length;
const daysAgo = ms => Math.floor((Date.now() - ms) / 864e5);
function backupCard() {
  const n = unsaved(), lb = db.settings.lastBackup; if (!n || (lb && daysAgo(lb) < 7)) return '';
  return `<div class="card safety"><strong>Copia de seguridad:</strong> ${n} sesión(es) sin respaldar ${lb ? `· última copia hace ${daysAgo(lb)} días` : '· aún no has guardado ninguna copia'}.
    <button class="btn sm pri" data-act="bk-save" style="margin-top:8px">Guardar copia</button></div>`;
}
function backupSettings() {
  const lb = db.settings.lastBackup;
  return `<div class="card"><h3>Copia de seguridad</h3>
    <p>${lb ? `Última copia: ${fmtDate(new Date(lb).toISOString())} (hace ${daysAgo(lb)} días)` : 'Todavía no has guardado ninguna copia.'}<br>Sesiones sin respaldar: <strong>${unsaved()}</strong></p>
    <button class="btn pri" data-act="bk-save" style="width:100%">Guardar copia (Drive, iCloud, Archivos…)</button>
    <label class="btn" style="display:block;text-align:center;margin-top:8px">Restaurar desde archivo<input type="file" accept="application/json" hidden data-act="restore"></label>
    <p class="mut">En el menú elige Google Drive, iCloud Drive, Archivos o tu correo. Si tu navegador no ofrece compartir, se descarga el archivo. La copia incluye sesiones, plantillas, ejercicios propios y fotos.</p>
    <h3 style="margin-top:12px">Copias automáticas en este dispositivo</h3><div id="snaps" class="list mut">Cargando…</div>
    <p class="mut">Se guardan al terminar una sesión y antes de importar, restaurar o borrar (las últimas 7). Te protegen de errores, <strong>no</strong> de perder o cambiar de teléfono: para eso guarda una copia en tu nube.</p>
    <p class="mut" id="persist"></p></div>`;
}
async function fillSnaps() {
  const all = (await snapAll()).reverse(), el = $('#snaps'); if (!el) return;
  el.innerHTML = all.length ? all.map(r => `<div class="item row sp"><span>${new Date(r.ts).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })}<br><span class="mut">${esc(r.reason)} · ${r.sessions} sesiones</span></span><button class="btn sm" data-act="snap-restore" data-ts="${r.ts}">Restaurar</button></div>`).join('') : 'Aún no hay copias automáticas.';
  const p = $('#persist'), ok = await navigator.storage?.persisted?.();
  if (p) p.textContent = ok ? 'Almacenamiento protegido por el navegador: sí.' : navigator.storage?.persisted ? 'Almacenamiento protegido: no garantizado. En iPhone instala la app en la pantalla de inicio: Safari puede borrar los datos de sitios que no usas.' : '';
}

/* ---------- Acciones ---------- */
let rest = { t: null, left: 0 };
function stopRest() { clearInterval(rest.t); rest.t = null; }
function startRest() {
  const ex = stepEx(); stopRest(); rest.left = planOf(ex).rest;
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
  db.sessions.push(s); db.current = null; save(); stopRest(); snap('Sesión terminada');
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
  if (tab) { ui.tab = tab.dataset.tab; ui.exDraft = null; return render(); }
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const a = b.dataset.act;
  if (a === 'start') {
    const all = allTemplates(), r = all.find(r => r.id === document.querySelector('input[name=routine]:checked')?.value) || all[0];
    if (!r.items.length) return toast('Esa plantilla no tiene ejercicios. Edítala primero.');
    ui.picked = r.id; startSession(r.name, r.items.map(i => i.ex), Object.fromEntries(r.items.map(i => [i.ex, { sets: i.sets, reps: i.reps, rest: i.rest, minutes: i.minutes }])));
  }
  else if (a === 'ex-new') { ui.exDraft = draftOf(null); render(); }
  else if (a === 'ex-edit') { ui.exDraft = draftOf(exById(b.dataset.id)); render(); }
  else if (a === 'ex-cancel') { ui.exDraft = null; render(); }
  else if (a === 'ex-save') saveExDraft();
  else if (a === 'ex-del') deleteEx(b.dataset.id);
  else if (a === 'tpl-open') { ui.tab = 'plantillas'; ui.tplEdit = null; render(); }
  else if (a === 'tpl-back') { ui.tab = 'hoy'; ui.tplEdit = null; render(); }
  else if (a === 'tpl-new') { const t = { id: uid(), name: 'Mi plantilla', items: [] }; db.templates.push(t); save(); ui.tplEdit = t.id; render(); }
  else if (a === 'tpl-edit') { ui.tplEdit = b.dataset.id; render(); }
  else if (a === 'tpl-done') { const t = tplById(ui.tplEdit); if (t && !t.name.trim()) t.name = 'Mi plantilla'; save(); ui.tplEdit = null; render(); }
  else if (a === 'tpl-dup') { const src = allTemplates().find(r => r.id === b.dataset.id); if (src) { const t = { id: uid(), name: (src.name + ' (copia)').slice(0, 40), items: src.items.map(i => ({ ...i })) }; db.templates.push(t); save(); ui.tplEdit = t.id; render(); } }
  else if (a === 'tpl-del') { if (confirm('¿Eliminar esta plantilla? Tus sesiones ya guardadas no cambian.')) { db.templates = db.templates.filter(t => t.id !== b.dataset.id); if (ui.picked === b.dataset.id) ui.picked = null; save(); render(); } }
  else if (a === 'tpl-add') { const t = tplById(ui.tplEdit), id = $('#tpl-add')?.value; if (t && id && !t.items.some(i => i.ex === id)) { t.items.push(itemOf(id)); save(); render(); } }
  else if (a === 'tpl-rm') { const t = tplById(ui.tplEdit); t.items.splice(+b.dataset.n, 1); save(); render(); }
  else if (a === 'tpl-up' || a === 'tpl-down') { const t = tplById(ui.tplEdit), n = +b.dataset.n, m = a === 'tpl-up' ? n - 1 : n + 1; if (t.items[m]) { [t.items[n], t.items[m]] = [t.items[m], t.items[n]]; save(); render(); } }
  else if (a === 'start-custom') { const ids = [...document.querySelectorAll('.cx:checked')].map(i => i.value); ids.length ? startSession('Sesión personalizada', ids) : toast('Marca al menos un ejercicio'); }
  else if (a === 'cancel') { if (confirm('¿Cancelar la sesión? No se guardará nada.')) { db.current = null; save(); stopRest(); render(); } }
  else if (a === 'prev') { cur().idx--; save(); stopRest(); render(); }
  else if (a === 'next') { const c = cur(); if (c.idx === c.steps.length - 1) { if (confirm('¿Finalizar y guardar la sesión?')) finish(); } else { c.idx++; save(); stopRest(); render(); } }
  else if (a === 'useref') {
    const ref = reference(stepEx().id), e2 = cur().entries[stepEx().id]; if (!ref) return;
    const last = ref.e.sets.find(s => s.done); e2.mode = ref.e.mode ?? e2.mode;
    e2.sets.forEach(s => { s.weight = last.weight; s.reps = last.reps; }); save(); render(); toast('Valores copiados. Marca cada serie solo cuando la hagas.');
  }
  else if (a === 'pmet') { ui.pmet = b.dataset.m; render(); }
  else if (a === 'rest') startRest(); else if (a === 'restoff') { stopRest(); const t = $('#tval'); if (t) t.textContent = planOf(stepEx()).rest + ' s'; }
  else if (a === 'toggle') { ui.openSession = ui.openSession === b.dataset.id ? null : b.dataset.id; render(); }
  else if (a === 'del') { if (confirm('¿Borrar esta sesión?')) { db.sessions = db.sessions.filter(s => s.id !== b.dataset.id); save(); render(); } }
  else if (a === 'export-json') { download('pert-datos.json', JSON.stringify(backupData(), null, 2), 'application/json'); db.settings.lastBackup = Date.now(); save(); }
  else if (a === 'bk-save') saveBackup();
  else if (a === 'snap-restore') { if (confirm('Esto reemplaza TODOS los datos actuales por los de esa copia. Antes se guarda una copia automática de lo actual. ¿Continuar?')) snapAll().then(all => { const r = all.find(x => String(x.ts) === b.dataset.ts); if (!r) return toast('Esa copia ya no existe.'); try { restoreData(JSON.parse(r.text)); } catch { toast('La copia está dañada.'); } }); }
  else if (a === 'export-csv') exportCsv();
  else if (a === 'wipe') wipeAll();
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.x && ui.exDraft) { ui.exDraft[t.dataset.x] = t.value; return; }
  if (t.dataset.t && ui.tplEdit) { const tp = tplById(ui.tplEdit); if (!tp) return; if (t.dataset.t === 'name') tp.name = t.value.slice(0, 40); save(); return; }
  const f = t.dataset.f; if (!f || !cur()) return;
  const en = cur().entries[stepEx().id], i = t.dataset.i;
  if (f === 'effort') { en.effort = +t.value; $('#effv').textContent = t.value; }
  else if (f === 'comment') en.comment = t.value;
  else if (f === 'weight' || f === 'reps' || f === 'minutes' || f === 'speed') { en.sets[i][f] = t.value; if (f === 'weight') $('#totalnote').textContent = totalNote(stepEx(), en); }
  save();
});
document.addEventListener('change', async e => {
  const t = e.target, f = t.dataset.f, a = t.dataset.act;
  if (t.dataset.x && ui.exDraft) { if (t.tagName === 'SELECT') render(); return; }
  if (t.dataset.t && t.dataset.t !== 'name' && ui.tplEdit) { const tp = tplById(ui.tplEdit), it = tp?.items[+t.dataset.n]; if (it) { it[t.dataset.t] = clamp(t.value, LIM[t.dataset.t]); t.value = it[t.dataset.t]; save(); } return; }
  if (a === 'pex') { ui.pex = t.value; ui.pmet = null; return render(); }
  if (a === 'unit') { db.settings.unit = t.value; save(); return render(); }
  if (a === 'photo' && t.files[0]) { try { db.photos[stepEx().id] = await resize(t.files[0]); save(); render(); } catch { toast('No se pudo leer la imagen'); } return; }
  if (a === 'import' && t.files[0]) {
    try { const d = JSON.parse(await t.files[0].text()); if (!d || typeof d !== 'object') throw 0;
      await snap('Antes de importar'); const added = ingest(db, d); save(); render(); toast(added ? `Importadas ${added} sesiones` : 'Datos importados (sin sesiones nuevas)'); }
    catch { toast('Archivo no válido'); } t.value = ''; return;
  }
  if (a === 'restore' && t.files[0]) {
    let d; try { d = JSON.parse(await t.files[0].text()); if (!d || typeof d !== 'object') throw 0; } catch { t.value = ''; return toast('Archivo no válido'); }
    t.value = ''; if (confirm('Esto reemplaza TODOS los datos actuales por los del archivo. Antes se guarda una copia automática. ¿Continuar?')) await restoreData(d); return;
  }
  if (!f || !cur()) return;
  const en = cur().entries[stepEx().id];
  if (f === 'done') { en.sets[t.dataset.i].done = t.checked; save(); t.closest('.set').classList.toggle('done', t.checked); if (t.checked && planOf(stepEx()).rest) startRest(); return; }
  if (f === 'skipped') { en.skipped = t.checked; save(); return render(); }
  if (f === 'symptoms') { en.symptoms = t.value; save(); return render(); }
  if (f === 'mode') { en.mode = t.value; save(); return render(); }
});

db.customExercises = db.customExercises.map(cleanEx).filter(Boolean); db.customExercises.forEach(registerEx);
navigator.storage?.persist?.().catch(() => {});
snapAll().then(all => { if (!all.length || Date.now() - all[all.length - 1].ts > 12 * 36e5) snap('Automática'); });
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
render();
