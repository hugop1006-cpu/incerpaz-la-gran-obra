'use strict';
// Sincronización opcional con Supabase (GoTrue + PostgREST por fetch; sin SDK ni servidor propio).
// Se carga antes que app.js: solo usa globals de app.js (db, cur, ui, render…) cuando se llama a sus funciones.
// La configuración y la sesión viven aparte (pert.cloud.v1) y NUNCA entran en copias de seguridad ni exportaciones.
const CKEY = 'pert.cloud.v1';
const KINDS = ['sessions', 'templates', 'custom', 'photos'];
const freshState = () => ({ uid: null, revs: {}, known: { sessions: [], templates: [], custom: [], photos: [] }, hashes: {}, photoTimes: {},
  tomb: { sessions: {}, templates: {}, custom: {}, photos: {} }, remoteMeta: null, last: 0, error: '' });
let cloud = (() => {
  try { const c = JSON.parse(localStorage.getItem(CKEY) || 'null'); if (c && typeof c === 'object') return { url: '', key: '', email: '', session: null, ...c, state: { ...freshState(), ...(c.state || {}) } }; } catch { /* vacío */ }
  return { url: '', key: '', email: '', session: null, state: freshState() };
})();
const csave = () => { try { localStorage.setItem(CKEY, JSON.stringify(cloud)); } catch { /* sin espacio */ } };
const okUrl = u => /^https:\/\/[a-z0-9-]{3,40}\.supabase\.(co|in)$/.test(u) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d{2,5})?$/.test(u);
const okKey = k => /^[A-Za-z0-9._-]{20,600}$/.test(k);
const stable = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(i => [i, x[i]])) : x));
const ihash = x => { const { updatedAt, ...r } = x; return hash(stable(r)); };
const conflict = () => Object.assign(new Error('conflicto'), { conflict: true });

/* ---------- HTTP ---------- */
async function creq(path, { method = 'GET', body, headers = {}, auth = true } = {}) {
  if (auth) await cfresh();
  const h = { apikey: cloud.key, 'Content-Type': 'application/json', ...headers };
  if (auth && cloud.session) h.Authorization = 'Bearer ' + cloud.session.access_token;
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 25000);
  try {
    const r = await fetch(cloud.url + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), signal: ac.signal });
    const txt = await r.text(); let data = null; try { data = txt ? JSON.parse(txt) : null; } catch { data = txt; }
    return { ok: r.ok, status: r.status, data };
  } catch (e) { throw new Error(e.name === 'AbortError' ? 'Tiempo de espera agotado.' : 'Sin conexión con el servidor.'); }
  finally { clearTimeout(to); }
}
function httpErr(r) {
  const d = r.data && typeof r.data === 'object' ? r.data : {}, m = d.error_description || d.msg || d.message || d.error || '';
  if (/invalid login/i.test(m)) return new Error('Correo o contraseña incorrectos.');
  if (/already registered/i.test(m)) return new Error('Ese correo ya tiene cuenta: usa «Iniciar sesión».');
  if (/pert_docs/.test(m) && /(not find|does not exist|relation)/i.test(m)) return new Error('Falta la tabla pert_docs: ejecuta supabase/schema.sql en tu proyecto.');
  if (r.status === 401) return Object.assign(new Error('Sesión caducada: inicia sesión de nuevo.'), { auth: true });
  return new Error(m ? String(m).slice(0, 160) : `Error del servidor (${r.status}).`);
}
function setSession(d) {
  cloud.session = { access_token: String(d.access_token), refresh_token: String(d.refresh_token || ''), expires_at: d.expires_at ? d.expires_at * 1000 : Date.now() + (d.expires_in || 3600) * 1000,
    uid: d.user?.id || cloud.session?.uid, email: d.user?.email || cloud.session?.email }; csave();
}
async function cfresh() {
  const s = cloud.session; if (!s || s.expires_at - Date.now() > 60000) return;
  const r = await creq('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refresh_token }, auth: false });
  if (!r.ok || !r.data?.access_token) { cloud.session = null; csave(); throw new Error('Sesión caducada: inicia sesión de nuevo.'); }
  setSession(r.data);
}
async function cAuth(mode, email, password) {
  const r = await creq(mode === 'signup' ? '/auth/v1/signup' : '/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password }, auth: false });
  if (!r.ok) throw httpErr(r);
  if (!r.data?.access_token) return 'confirm';
  setSession(r.data); return 'ok';
}

/* ---------- Filas ---------- */
async function listRows() {
  const out = [];
  for (let i = 0; ; i += 1000) {
    const r = await creq('/rest/v1/pert_docs?select=key,rev&order=key', { headers: { Range: `${i}-${i + 999}`, 'Range-Unit': 'items' } });
    if (!r.ok) throw httpErr(r); if (!Array.isArray(r.data)) throw new Error('Respuesta inesperada del servidor.');
    out.push(...r.data); if (r.data.length < 1000) break;
  }
  return out;
}
async function getRows(keys) {
  const out = [];
  for (let i = 0; i < keys.length; i += 40) {
    const v = '(' + keys.slice(i, i + 40).map(k => `"${k}"`).join(',') + ')';
    const r = await creq('/rest/v1/pert_docs?select=key,body&key=in.' + encodeURIComponent(v)); if (!r.ok) throw httpErr(r);
    if (Array.isArray(r.data)) out.push(...r.data);
  }
  return out;
}
async function delRows(keys) {
  for (let i = 0; i < keys.length; i += 40) {
    const v = '(' + keys.slice(i, i + 40).map(k => `"${k}"`).join(',') + ')';
    const r = await creq('/rest/v1/pert_docs?key=in.' + encodeURIComponent(v), { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); if (!r.ok) throw httpErr(r);
  }
}
async function upsertRow(key, body) { // con control de versión: si otro dispositivo escribió antes, hay conflicto y se reintenta
  const s = cloud.state, rev = s.revs[key];
  if (rev === undefined) {
    const r = await creq('/rest/v1/pert_docs', { method: 'POST', body: { key, body, rev: 1 }, headers: { Prefer: 'return=minimal' } });
    if (r.status === 409) throw conflict(); if (!r.ok) throw httpErr(r); s.revs[key] = 1;
  } else {
    const r = await creq(`/rest/v1/pert_docs?key=eq.${encodeURIComponent(key)}&rev=eq.${rev}`, { method: 'PATCH', body: { body, rev: rev + 1, updated_at: new Date().toISOString() }, headers: { Prefer: 'return=representation' } });
    if (!r.ok) throw httpErr(r); if (!Array.isArray(r.data) || !r.data.length) throw conflict(); s.revs[key] = rev + 1;
  }
}
const parseJ = t => { try { const v = JSON.parse(t); return v && typeof v === 'object' ? v : null; } catch { return null; } };

/* ---------- Mezcla (pura) ---------- */
function cMerge(L, R) {
  const tomb = {};
  KINDS.forEach(k => {
    tomb[k] = { ...(R.tomb?.[k] || {}) };
    Object.entries(L.tomb[k] || {}).forEach(([id, t]) => { if (!(tomb[k][id] >= t)) tomb[k][id] = t; });
  });
  const byId = (a, b, tk) => { // gana el más reciente; empate: el local. Una tumba más nueva que la última edición borra.
    const m = new Map(); [...b, ...a].forEach(x => { const o = m.get(x.id); if (!o || (x.updatedAt || 0) >= (o.updatedAt || 0)) m.set(x.id, x); });
    return [...m.values()].filter(x => (x.updatedAt || 0) > (tomb[tk][x.id] ?? -1));
  };
  const sm = new Map(); [...L.sessions, ...R.sessions].forEach(s => { if (!sm.has(s.id) && tomb.sessions[s.id] === undefined) sm.set(s.id, s); });
  const photos = {};
  new Set([...Object.keys(L.photoTimes), ...Object.keys(R.photoTimes || {})]).forEach(id => {
    const lt = L.photoTimes[id] ?? -1, rt = R.photoTimes?.[id] ?? -1, t = Math.max(lt, rt);
    if (t < 0 || (tomb.photos[id] ?? -1) >= t) return;
    photos[id] = { t, from: rt > lt ? 'remote' : 'local', rt };
  });
  return { tomb, sessions: [...sm.values()].sort((x, y) => x.date.localeCompare(y.date)), templates: byId(L.templates, R.templates, 'templates'), customExercises: byId(L.customExercises, R.customExercises, 'custom'), photos };
}

/* ---------- Sincronización ---------- */
function cStamp() { // detecta ediciones y borrados locales sin tocar cada manejador de la app
  const s = cloud.state, now = Date.now(), ids = { sessions: db.sessions.map(x => x.id), templates: db.templates.map(x => x.id), custom: db.customExercises.map(x => x.id), photos: Object.keys(db.photos) };
  [['templates', db.templates], ['custom', db.customExercises]].forEach(([kind, arr]) => arr.forEach(x => { const h = ihash(x); if (s.hashes[kind + ':' + x.id] !== h) { x.updatedAt = now; s.hashes[kind + ':' + x.id] = h; } }));
  ids.photos.forEach(id => { const h = hash(db.photos[id]); if (s.hashes['photo:' + id] !== h) { s.photoTimes[id] = now; s.hashes['photo:' + id] = h; } else if (s.photoTimes[id] === undefined) s.photoTimes[id] = now; });
  KINDS.forEach(k => (s.known[k] || []).forEach(id => { if (!ids[k].includes(id) && s.tomb[k][id] === undefined) s.tomb[k][id] = now; }));
  Object.keys(s.photoTimes).forEach(id => { if (!ids.photos.includes(id)) delete s.photoTimes[id]; });
  return ids;
}
const numMap = o => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([k, v]) => typeof k === 'string' && Number.isFinite(v)).map(([k, v]) => [sid(k), v]));
const cleanTomb = t => Object.fromEntries(KINDS.map(k => [k, numMap(t?.[k])]));
const validPhoto = d => typeof d === 'string' && d.length < 400000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(d);

async function cSyncOnce() {
  const s = cloud.state, rows = await listRows(), remote = new Map(rows.map(r => [r.key, r.rev]));
  Object.keys(s.revs).forEach(k => { if (!remote.has(k)) delete s.revs[k]; }); remote.forEach((v, k) => { s.revs[k] = v; });
  let rmeta = null;
  if (remote.has('meta')) rmeta = s.remoteMeta && s.remoteMeta.__rev === remote.get('meta') ? s.remoteMeta : parseJ((await getRows(['meta']))[0]?.body);
  if (rmeta) rmeta.__rev = remote.get('meta');
  // los ejercicios propios remotos se registran antes de limpiar plantillas/sesiones que dependan de ellos
  const rCustom = (Array.isArray(rmeta?.customExercises) ? rmeta.customExercises : []).map(cleanEx).filter(Boolean);
  rCustom.forEach(o => { if (!exById(o.id)) registerEx(o); });
  const rTomb = cleanTomb(rmeta?.tomb), localIds = new Set(db.sessions.map(x => x.id));
  const needS = [...remote.keys()].filter(k => k.startsWith('session:')).map(k => k.slice(8)).filter(id => !localIds.has(id) && rTomb.sessions[id] === undefined && cloud.state.tomb.sessions[id] === undefined);
  const rSessions = [];
  for (const r of await getRows(needS.map(id => 'session:' + id))) { const c = cleanSession(parseJ(r.body)); if (c && 'session:' + c.id === r.key) rSessions.push(c); }
  const R = { sessions: rSessions, templates: (Array.isArray(rmeta?.templates) ? rmeta.templates : []).map(cleanTemplate).filter(Boolean), customExercises: rCustom, photoTimes: numMap(rmeta?.photoTimes), tomb: rTomb };
  const rc = new Map(); let merged;
  for (let pass = 0; pass < 3; pass++) {
    cStamp(); merged = cMerge({ sessions: db.sessions, templates: db.templates, customExercises: db.customExercises, photoTimes: s.photoTimes, tomb: s.tomb }, R);
    const need = Object.entries(merged.photos).filter(([id, p]) => p.from === 'remote' && !rc.has(id) && remote.has('photo:' + id)).map(([id]) => id);
    if (!need.length) break;
    for (const r of await getRows(need.map(id => 'photo:' + id))) { const o = parseJ(r.body); rc.set(r.key.slice(6), o && validPhoto(o.d) ? o.d : null); }
    need.forEach(id => { if (!rc.has(id)) rc.set(id, null); });
  }
  /* aplicar (síncrono, justo después de la última espera) */
  const keepCustom = cur() ? db.customExercises.filter(x => cur().steps.includes(x.id) && !merged.customExercises.some(y => y.id === x.id)) : [];
  db.sessions = merged.sessions; db.templates = merged.templates; db.customExercises = [...merged.customExercises, ...keepCustom];
  dropCustom(); db.customExercises.forEach(registerEx);
  db.templates.forEach(t => (t.items = t.items.filter(i => exById(i.ex))));
  const photos = {}, times = {};
  Object.entries(merged.photos).forEach(([id, p]) => { const d = p.from === 'remote' ? rc.get(id) : db.photos[id]; if (validPhoto(d) && exById(id)) { photos[id] = d; times[id] = p.t; } });
  db.photos = photos; photosDirty = true; s.photoTimes = times; s.tomb = merged.tomb;
  s.hashes = {}; db.templates.forEach(x => (s.hashes['templates:' + x.id] = ihash(x))); db.customExercises.forEach(x => (s.hashes['custom:' + x.id] = ihash(x))); Object.entries(photos).forEach(([id, d]) => (s.hashes['photo:' + id] = hash(d)));
  s.known = { sessions: db.sessions.map(x => x.id), templates: db.templates.map(x => x.id), custom: db.customExercises.map(x => x.id), photos: Object.keys(photos) };
  save();
  /* subir lo que falte en la nube */
  const toPush = db.sessions.filter(x => !remote.has('session:' + x.id));
  for (let i = 0; i < toPush.length; i += 25) {
    const r = await creq('/rest/v1/pert_docs?on_conflict=user_id,key', { method: 'POST', body: toPush.slice(i, i + 25).map(x => ({ key: 'session:' + x.id, body: JSON.stringify(x) })), headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' } });
    if (!r.ok) throw httpErr(r);
  }
  const delKeys = [...remote.keys()].filter(k => (k.startsWith('session:') && merged.tomb.sessions[k.slice(8)] !== undefined) || (k.startsWith('photo:') && !photos[k.slice(6)] && merged.tomb.photos[k.slice(6)] !== undefined));
  if (delKeys.length) { await delRows(delKeys); delKeys.forEach(k => delete s.revs[k]); }
  for (const [id, p] of Object.entries(merged.photos)) if (photos[id] && p.from === 'local' && (!remote.has('photo:' + id) || p.t > p.rt)) await upsertRow('photo:' + id, JSON.stringify({ t: p.t, d: photos[id] }));
  const meta = { v: 1, templates: db.templates, customExercises: db.customExercises.map(({ custom, ...x }) => x), photoTimes: times, tomb: merged.tomb };
  const { __rev, ...rm } = rmeta || {};
  if (!rmeta || stable(rm) !== stable(meta)) await upsertRow('meta', JSON.stringify(meta));
  s.remoteMeta = { ...meta, __rev: s.revs.meta };
}
async function cSync() {
  if (cloud.syncing || !cloud.session || !cloud.url) return;
  cloud.syncing = true; cloud.state.error = ''; cloudRefresh();
  try {
    for (let i = 0; i < 3; i++) {
      try { await cSyncOnce(); cloud.state.last = Date.now(); break; }
      catch (e) { if (e.conflict && i < 2) continue; throw e; }
    }
  } catch (e) {
    cloud.state.error = e.message || 'Error de sincronización.'; if (e.auth) cloud.session = null;
    dropCustom(); db.customExercises.forEach(registerEx); // un fallo a medias no deja ejercicios remotos "fantasma" en el catálogo
  }
  finally { cloud.syncing = false; csave(); cloudRefresh(true); }
}
function cloudRefresh(dataChanged) { // no interrumpe una sesión ni un formulario abierto
  if (cur() || ui.exDraft || ui.tplEdit) return;
  if (dataChanged || ui.tab === 'ajustes') render();
}
let syncTimer = null;
function cloudSyncSoon(ms = 2500) { if (!cloud.session) return; clearTimeout(syncTimer); syncTimer = setTimeout(cSync, ms); }
function cloudResetKnown() { cloud.state.known = { sessions: [], templates: [], custom: [], photos: [] }; cloud.state.hashes = {}; csave(); }
function cloudInit() {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - cloud.state.last > 120000) cloudSyncSoon(500); });
  window.addEventListener('online', () => cloudSyncSoon(500));
  cloudSyncSoon(800);
}

/* ---------- Interfaz ---------- */
function cloudCard() {
  ui.cf = ui.cf || {};
  const c = cloud, st = c.state, f = (k, lab, type = 'text', ph = '') => `<label>${lab}<input type="${type}" data-c="${k}" value="${esc(ui.cf[k] ?? (k === 'email' ? c.email : ''))}" placeholder="${esc(ph)}" autocapitalize="off" autocomplete="${k === 'pass' ? 'current-password' : 'off'}"></label>`;
  const head = '<h3>Nube (opcional)</h3>';
  if (!c.url || !c.key) return `<div class="card xf">${head}<p class="mut">Sincroniza entre dispositivos con <strong>tu propio</strong> proyecto de Supabase (guía en supabase/SETUP.md). Tus datos de salud van a ese proyecto; sin cifrado de extremo a extremo.</p>
    ${f('url', 'URL del proyecto', 'text', 'https://xxxx.supabase.co')}${f('key', 'Clave pública (anon o publishable; nunca service_role)')}<button class="btn pri" data-act="cloud-config" style="margin-top:8px">Guardar</button></div>`;
  if (!c.session) return `<div class="card xf">${head}<p class="mut">Proyecto: ${esc(c.url)}</p>${f('email', 'Correo', 'email')}${f('pass', 'Contraseña (mín. 6)', 'password')}
    ${st.error ? `<p class="alert" style="font-weight:400">${esc(st.error)}</p>` : ''}
    <div class="row" style="margin-top:8px"><button class="btn pri" data-act="cloud-login">Iniciar sesión</button><button class="btn" data-act="cloud-signup">Crear cuenta</button><button class="btn sm danger" data-act="cloud-disconnect">Cambiar proyecto</button></div></div>`;
  return `<div class="card xf">${head}<p>Cuenta: <strong>${esc(c.session.email || '')}</strong><br>${st.last ? `Última sincronización: ${new Date(st.last).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Aún no se ha sincronizado.'}${c.syncing ? ' · sincronizando…' : ''}</p>
    ${st.error ? `<p class="alert" style="font-weight:400">No se pudo sincronizar: ${esc(st.error)} Tus datos locales están a salvo.</p>` : ''}
    <div class="row"><button class="btn pri" data-act="cloud-sync" ${c.syncing ? 'disabled' : ''}>Sincronizar ahora</button><button class="btn" data-act="cloud-logout">Cerrar sesión</button></div>
    <div class="row" style="margin-top:8px"><button class="btn sm danger" data-act="cloud-wipe">Eliminar mis datos en la nube</button><button class="btn sm danger" data-act="cloud-disconnect">Desconectar</button></div>
    <div class="row" style="margin-top:8px"><button class="btn sm danger" data-act="cloud-delete-account">Eliminar mi cuenta</button></div>
    <p class="mut">Se sincroniza al abrir la app, al terminar una sesión y al recuperar conexión. La sesión en curso no se sincroniza hasta terminarla.</p></div>`;
}
async function cloudAction(a) {
  ui.cf = ui.cf || {};
  if (a === 'cloud-config') {
    const url = String(ui.cf.url || '').trim().replace(/\/+$/, ''), key = String(ui.cf.key || '').trim();
    if (!okUrl(url)) return toast('La URL debe ser https://<proyecto>.supabase.co');
    if (!okKey(key)) return toast('La clave pública no parece válida.');
    cloud.url = url; cloud.key = key; csave(); ui.cf = {}; return render();
  }
  if (a === 'cloud-disconnect') {
    if (!confirm('Se quitará la conexión de este dispositivo. Tus datos locales y los de la nube no se borran. ¿Continuar?')) return;
    cloud = { url: '', key: '', email: '', session: null, state: freshState() }; csave(); return render();
  }
  if (a === 'cloud-logout') { cloud.session = null; csave(); return render(); }
  if (a === 'cloud-login' || a === 'cloud-signup') {
    const email = String(ui.cf.email || '').trim(), pass = String(ui.cf.pass || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast('Escribe un correo válido.');
    if (pass.length < 6) return toast('La contraseña necesita al menos 6 caracteres.');
    try {
      const r = await cAuth(a === 'cloud-signup' ? 'signup' : 'login', email, pass); ui.cf.pass = ''; cloud.email = email; cloud.state.error = ''; csave();
      if (r === 'confirm') { render(); return toast('Te enviamos un correo para confirmar la cuenta. Después inicia sesión aquí.'); }
      if (cloud.state.uid !== cloud.session.uid) {
        if (!confirm(`Se combinarán los datos de este dispositivo con los de la cuenta ${email}. ¿Continuar?`)) { cloud.session = null; csave(); return render(); }
        cloud.state = { ...freshState(), uid: cloud.session.uid };
      }
      csave(); render(); await cSync();
    } catch (e) { cloud.state.error = e.message; csave(); render(); }
    return;
  }
  if (a === 'cloud-sync') return cSync();
  if (a === 'cloud-delete-account') {
    if (!cloud.session || !confirm(`Se eliminará DEFINITIVAMENTE tu cuenta ${cloud.session.email || ''} y todos tus datos en la nube. Este dispositivo conserva sus datos. Esta acción no se puede deshacer. ¿Continuar?`)) return;
    try {
      const r = await creq('/rest/v1/rpc/delete_my_account', { method: 'POST', body: {} });
      if (!r.ok) throw /delete_my_account/.test(JSON.stringify(r.data)) && r.status === 404 ? new Error('Falta la función delete_my_account: ejecuta supabase/schema.sql en tu proyecto.') : httpErr(r);
      cloud.session = null; cloud.email = ''; cloud.state = freshState(); csave(); render(); toast('Cuenta eliminada. Tus datos locales siguen en este dispositivo.');
    } catch (e) { cloud.state.error = e.message; csave(); render(); }
    return;
  }
  if (a === 'cloud-wipe') {
    if (!cloud.session || !confirm('Se borrarán TODOS tus datos en la nube (sesiones, plantillas, ejercicios y fotos). Este dispositivo conserva los suyos. ¿Continuar?')) return;
    try { const r = await creq(`/rest/v1/pert_docs?user_id=eq.${encodeURIComponent(cloud.session.uid)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); if (!r.ok) throw httpErr(r); cloud.state = { ...freshState(), uid: cloud.session.uid }; csave(); render(); toast('Datos de la nube eliminados.'); }
    catch (e) { cloud.state.error = e.message; csave(); render(); }
  }
}
