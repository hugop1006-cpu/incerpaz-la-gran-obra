'use strict';
/* Aplicación web de INCERPAZ: sirve el sitio estático (/site) y la API de cuentas, precios, presupuestos y pedidos.
   Sin dependencias externas. Los precios solo salen de aquí para cuentas verificadas. */
const fs = require('node:fs');
const zlib = require('node:zlib');
const path = require('node:path');
const { ErrorHttp, falla, leerJson, responder, cookies, cookie, ip, limitador } = require('./http');
const auth = require('./auth');
const { copiaTemporal } = require('./respaldo');

const RAIZ = path.resolve(__dirname, '..', '..');
const SITIO = path.join(RAIZ, 'site');
const NOMBRE_COOKIE = 'incerpaz_sid';
const TIPOS = ['constructor', 'empresa', 'ferreteria', 'entidad', 'proyectista', 'dueno'];
const CIUDADES = ['cochabamba', 'santa-cruz', 'oruro', 'sucre'];
const CATALOGOS = ['cochabamba', 'santa-cruz'];
const PAGOS = ['transferencia', 'qr', 'agencia'];
const ESTADOS_LEAD = ['nuevo', 'contactado', 'cotizado', 'ganado', 'perdido'];
const ESTADOS_PEDIDO = ['recibido', 'confirmado', 'en_despacho', 'entregado', 'anulado'];
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8' };

const COMPRIMIBLES = new Set(['.html', '.css', '.js', '.json', '.svg', '.xml', '.txt']);
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
const txt = (v, max, nombre, { obligatorio = false } = {}) => {
  const s = v == null ? '' : String(v).trim();
  if (obligatorio && !s) falla(400, `Falta ${nombre}`);
  if (s.length > max) falla(400, `${nombre} es demasiado largo`);
  return s;
};
const publico = (u) => u && ({ id: u.id, rol: u.rol, estado: u.estado, tipo: u.tipo, nombre: u.nombre, razon_social: u.razon_social, nit: u.nit, ciudad: u.ciudad, celular: u.celular, correo: u.correo, lista_precios: u.lista_precios });

function crearApp({ db, erp, contenido, catalogoRuta, seguro = process.env.COOKIE_SECURE === '1' }) {
  const rutaCatalogo = catalogoRuta || path.join(__dirname, '..', 'data', 'catalogo.json');
  let catalogo; let porClave;
  const cargarCatalogo = () => { catalogo = JSON.parse(fs.readFileSync(rutaCatalogo, 'utf8')); porClave = new Map(catalogo.map((p) => [`${p.ciudad}:${p.slug}`, p])); };
  cargarCatalogo();
  const SUBIDAS = contenido ? path.join(contenido.dir, 'imagenes') : null;
  if (SUBIDAS) fs.mkdirSync(SUBIDAS, { recursive: true });
  db.prepare("INSERT OR IGNORE INTO ajustes (clave, valor) VALUES ('nota_precios:cochabamba', 'Precio por pieza, puesto en obra dentro del radio urbano.')").run();
  const limLogin = limitador({ max: 10, ventanaMs: 15 * 60_000 });
  const limRegistro = limitador({ max: 20, ventanaMs: 60 * 60_000 });
  const limLeads = limitador({ max: 15, ventanaMs: 60 * 60_000 });

  /* ---------- utilidades de negocio ---------- */
  const verificado = (u) => u && (u.estado === 'verificado' || u.rol !== 'cliente');
  function requerirUsuario(u) { if (!u) falla(401, 'Inicia sesión para continuar'); return u; }
  function requerirVerificado(u) { requerirUsuario(u); if (!verificado(u)) falla(403, 'Tu cuenta está en revisión. Un ejecutivo la verificará pronto.'); return u; }
  function requerirAdmin(u) { requerirUsuario(u); if (u.rol !== 'admin') falla(403, 'Solo un administrador puede hacer este cambio'); if (!contenido) falla(501, 'El panel de contenido no está activo en este servidor'); return u; }
  function requerirStaff(u) { requerirUsuario(u); if (u.rol === 'cliente') falla(403, 'No tienes permiso para esta acción'); return u; }

  function validarItems(items) {
    if (!Array.isArray(items) || !items.length) falla(400, 'Agrega al menos un producto');
    if (items.length > 100) falla(400, 'Demasiados productos en un solo documento');
    const vistos = new Set();
    return items.map((it) => {
      const p = porClave.get(`${it && it.ciudad}:${it && it.slug}`);
      if (!p) falla(400, 'Hay un producto que no existe en el catálogo');
      const cantidad = Number(it.cantidad);
      if (!Number.isFinite(cantidad) || cantidad <= 0 || cantidad > 10_000_000) falla(400, `Cantidad inválida para ${p.nombre}`);
      if (vistos.has(`${p.ciudad}:${p.slug}`)) falla(400, `${p.nombre} está repetido`);
      vistos.add(`${p.ciudad}:${p.slug}`);
      return { ciudad: p.ciudad, slug: p.slug, codigo: p.codigo, nombre: p.nombre, cantidad };
    });
  }
  async function preciosDe(items, usuario) {
    /* items ya validados; devuelve Map clave -> precio|null agrupando por catálogo */
    const out = new Map();
    for (const c of new Set(items.map((i) => i.ciudad))) {
      const lista = items.filter((i) => i.ciudad === c);
      const r = await erp.getPrecios({ ciudad: c, listaPrecios: usuario.lista_precios, productos: lista.map((i) => ({ slug: i.slug, codigo: i.codigo })) });
      lista.forEach((i) => out.set(`${i.ciudad}:${i.slug}`, typeof r[i.slug] === 'number' ? r[i.slug] : null));
    }
    return out;
  }
  const total = (items) => items.every((i) => i.precio_unitario != null) ? Math.round(items.reduce((t, i) => t + i.subtotal, 0) * 100) / 100 : null;

  function guardarPresupuesto(usuario, id, { obra, notas }, items, totalEst) {
    db.exec('BEGIN');
    try {
      let pid = id;
      if (pid) {
        db.prepare("UPDATE presupuestos SET obra = ?, notas = ?, total_estimado = ?, actualizado_en = datetime('now') WHERE id = ?").run(obra, notas, totalEst, pid);
        db.prepare('DELETE FROM presupuesto_items WHERE presupuesto_id = ?').run(pid);
      } else {
        pid = Number(db.prepare('INSERT INTO presupuestos (usuario_id, obra, notas, total_estimado) VALUES (?, ?, ?, ?)').run(usuario.id, obra, notas, totalEst).lastInsertRowid);
      }
      const ins = db.prepare('INSERT INTO presupuesto_items (presupuesto_id, ciudad_catalogo, slug, codigo, nombre, cantidad) VALUES (?, ?, ?, ?, ?, ?)');
      items.forEach((i) => ins.run(pid, i.ciudad, i.slug, i.codigo, i.nombre, i.cantidad));
      db.exec('COMMIT');
      return pid;
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }
  const presupuestoDe = (usuario, id) => {
    const p = db.prepare('SELECT * FROM presupuestos WHERE id = ? AND usuario_id = ?').get(id, usuario.id);
    if (!p) falla(404, 'No encontramos ese presupuesto');
    p.items = db.prepare('SELECT ciudad_catalogo AS ciudad, slug, codigo, nombre, cantidad FROM presupuesto_items WHERE presupuesto_id = ? ORDER BY id').all(id);
    return p;
  };
  const pedidoDe = (usuario, id, staff) => {
    const p = staff ? db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id) : db.prepare('SELECT * FROM pedidos WHERE id = ? AND usuario_id = ?').get(id, usuario.id);
    if (!p) falla(404, 'No encontramos ese pedido');
    p.items = db.prepare('SELECT ciudad_catalogo AS ciudad, slug, codigo, nombre, cantidad, precio_unitario, subtotal FROM pedido_items WHERE pedido_id = ? ORDER BY id').all(id);
    p.eventos = db.prepare('SELECT estado, nota, creado_en FROM pedido_eventos WHERE pedido_id = ? ORDER BY id').all(id);
    return p;
  };
  const ocultarErp = (p) => { const { erp_error, ...resto } = p; return resto; };

  /* ---------- rutas de la API ---------- */
  const rutas = [];
  const ruta = (metodo, patron, fn) => rutas.push({ metodo, re: new RegExp(`^${patron.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`), fn });

  ruta('GET', '/api/salud', async () => { try { db.prepare('SELECT 1').get(); } catch { falla(503, 'Base de datos no disponible'); } if (!fs.existsSync(path.join(SITIO, 'index.html'))) falla(503, 'El sitio aún no está generado'); return { ok: true, erp: erp.nombre }; });

  ruta('POST', '/api/registro', async ({ req, body }) => {
    if (!limRegistro(ip(req))) falla(429, 'Demasiados intentos. Prueba más tarde.');
    const tipo = txt(body.tipo, 20, 'el tipo de cliente', { obligatorio: true });
    if (!TIPOS.includes(tipo)) falla(400, 'Tipo de cliente inválido');
    const ciudad = txt(body.ciudad, 20, 'la ciudad', { obligatorio: true });
    if (!CIUDADES.includes(ciudad)) falla(400, 'Elige una ciudad con agencia');
    const nombre = txt(body.nombre, 120, 'el nombre', { obligatorio: true });
    const razon = txt(body.razon_social, 160, 'la razón social');
    const nit = txt(body.nit, 20, 'el NIT o CI');
    if (nit && !/^[0-9A-Za-z-]{4,20}$/.test(nit)) falla(400, 'El NIT o CI no es válido');
    if (['empresa', 'entidad', 'ferreteria'].includes(tipo) && (!nit || !razon)) falla(400, 'Para empresas y entidades, el NIT y la razón social son obligatorios');
    const celular = txt(body.celular, 20, 'el celular', { obligatorio: true }).replace(/[\s-]/g, '');
    if (!/^\d{8}$/.test(celular)) falla(400, 'El celular debe tener 8 dígitos');
    const correo = txt(body.correo, 160, 'el correo', { obligatorio: true }).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) falla(400, 'El correo no es válido');
    const password = String(body.password || '');
    if (password.length < 8 || password.length > 200) falla(400, 'La contraseña debe tener al menos 8 caracteres');
    if (db.prepare('SELECT 1 FROM usuarios WHERE correo = ?').get(correo)) falla(409, 'Ya existe una cuenta con ese correo');
    let erpId = null;
    if (nit) { try { const c = await erp.buscarCliente({ nit }); if (c) erpId = c.erpId; } catch { /* el ERP puede no responder: se verifica a mano */ } }
    const r = db.prepare('INSERT INTO usuarios (tipo, nombre, razon_social, nit, ciudad, celular, correo, pass_hash, erp_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(tipo, nombre, razon || null, nit || null, ciudad, celular, correo, auth.hashPassword(password), erpId);
    return { status: 201, cuerpo: { id: Number(r.lastInsertRowid), estado: 'pendiente', mensaje: 'Recibimos tu registro. Un ejecutivo de tu ciudad verificará tu cuenta y te avisará.' } };
  });

  ruta('POST', '/api/login', async ({ req, res, body }) => {
    const correo = txt(body.correo, 160, 'el correo', { obligatorio: true }).toLowerCase();
    if (!limLogin(`${ip(req)}|${correo}`)) falla(429, 'Demasiados intentos. Espera unos minutos.');
    const u = db.prepare('SELECT * FROM usuarios WHERE correo = ?').get(correo);
    /* mismo trabajo de hash aunque el usuario no exista, para no revelar qué correos están registrados */
    const ok = auth.verificarPassword(String(body.password || ''), u ? u.pass_hash : 'scrypt$00$00');
    if (!u || !ok) falla(401, 'Correo o contraseña incorrectos');
    if (u.estado === 'rechazado') falla(403, 'Esta cuenta no fue aprobada. Comunícate con tu agencia.');
    const token = auth.crearSesion(db, u.id);
    res.setHeader('Set-Cookie', cookie(NOMBRE_COOKIE, token, { maxAge: auth.DIAS_SESION * 86400, seguro }));
    return { usuario: publico(u) };
  });

  ruta('POST', '/api/logout', async ({ req, res }) => {
    auth.cerrarSesion(db, cookies(req)[NOMBRE_COOKIE]);
    res.setHeader('Set-Cookie', cookie(NOMBRE_COOKIE, '', { maxAge: 0, seguro }));
    return { ok: true };
  });

  ruta('GET', '/api/yo', async ({ usuario }) => ({ usuario: publico(usuario) || null, erp_ejemplo: !!erp.ejemplo }));

  ruta('GET', '/api/precios', async ({ usuario, url }) => {
    requerirVerificado(usuario);
    const ciudad = url.searchParams.get('ciudad');
    if (!CATALOGOS.includes(ciudad)) falla(400, 'Catálogo inexistente');
    const lista = catalogo.filter((p) => p.ciudad === ciudad);
    const r = await erp.getPrecios({ ciudad, listaPrecios: usuario.lista_precios, productos: lista.map((p) => ({ slug: p.slug, codigo: p.codigo })) });
    const precios = {}; lista.forEach((p) => { precios[p.slug] = typeof r[p.slug] === 'number' ? r[p.slug] : null; });
    const nota = db.prepare('SELECT valor FROM ajustes WHERE clave = ?').get(`nota_precios:${ciudad}`);
    return { moneda: 'BOB', ejemplo: !!erp.ejemplo, nota: nota ? nota.valor : '', precios };
  });

  /* presupuestos */
  ruta('GET', '/api/presupuestos', async ({ usuario }) => {
    requerirUsuario(usuario);
    return { presupuestos: db.prepare(`SELECT p.id, p.obra, p.estado, p.total_estimado, p.creado_en, p.actualizado_en,
      (SELECT COUNT(*) FROM presupuesto_items i WHERE i.presupuesto_id = p.id) AS productos FROM presupuestos p WHERE p.usuario_id = ? ORDER BY p.actualizado_en DESC, p.id DESC`).all(usuario.id) };
  });
  ruta('POST', '/api/presupuestos', async ({ usuario, body }) => {
    requerirUsuario(usuario);
    const items = validarItems(body.items);
    const datos = { obra: txt(body.obra, 120, 'la obra') || null, notas: txt(body.notas, 1000, 'las notas') || null };
    let id = null;
    if (body.id != null) { const p = presupuestoDe(usuario, Number(body.id)); if (p.estado === 'convertido') falla(409, 'Este presupuesto ya se convirtió en pedido'); id = p.id; }
    let totalEst = null;
    if (verificado(usuario)) {
      const pr = await preciosDe(items, usuario);
      const conPrecio = items.map((i) => ({ ...i, precio_unitario: pr.get(`${i.ciudad}:${i.slug}`) }));
      conPrecio.forEach((i) => { i.subtotal = i.precio_unitario == null ? null : Math.round(i.precio_unitario * i.cantidad * 100) / 100; });
      totalEst = total(conPrecio);
    }
    const pid = guardarPresupuesto(usuario, id, datos, items, totalEst);
    return { status: id ? 200 : 201, cuerpo: { id: pid, total_estimado: totalEst } };
  });
  ruta('GET', '/api/presupuestos/:id', async ({ usuario, params }) => {
    requerirUsuario(usuario);
    const p = presupuestoDe(usuario, Number(params.id));
    if (verificado(usuario)) {
      const pr = await preciosDe(p.items, usuario);
      p.items.forEach((i) => { i.precio_unitario = pr.get(`${i.ciudad}:${i.slug}`); i.subtotal = i.precio_unitario == null ? null : Math.round(i.precio_unitario * i.cantidad * 100) / 100; });
      p.total_estimado = total(p.items);
    }
    return { presupuesto: p };
  });
  ruta('POST', '/api/presupuestos/:id/enviar', async ({ usuario, params }) => {
    requerirUsuario(usuario);
    const p = presupuestoDe(usuario, Number(params.id));
    if (p.estado === 'convertido') falla(409, 'Este presupuesto ya se convirtió en pedido');
    db.prepare("UPDATE presupuestos SET estado = 'enviado', actualizado_en = datetime('now') WHERE id = ?").run(p.id);
    return { ok: true, estado: 'enviado' };
  });
  ruta('DELETE', '/api/presupuestos/:id', async ({ usuario, params }) => {
    requerirUsuario(usuario);
    const p = presupuestoDe(usuario, Number(params.id));
    if (p.estado === 'convertido') falla(409, 'Este presupuesto ya se convirtió en pedido');
    db.prepare('DELETE FROM presupuestos WHERE id = ?').run(p.id);
    return { ok: true };
  });

  /* pedidos */
  ruta('GET', '/api/pedidos', async ({ usuario }) => {
    requerirUsuario(usuario);
    return { pedidos: db.prepare('SELECT id, numero, estado, ciudad, total_estimado, entrega_tipo, creado_en, actualizado_en FROM pedidos WHERE usuario_id = ? ORDER BY id DESC').all(usuario.id) };
  });
  ruta('POST', '/api/pedidos', async ({ usuario, body }) => {
    requerirVerificado(usuario);
    let items; let presupuesto = null;
    if (body.presupuesto_id != null) { presupuesto = presupuestoDe(usuario, Number(body.presupuesto_id)); if (presupuesto.estado === 'convertido') falla(409, 'Este presupuesto ya se convirtió en pedido'); items = validarItems(presupuesto.items); }
    else items = validarItems(body.items);
    const ciudades = new Set(items.map((i) => i.ciudad));
    if (ciudades.size > 1) falla(400, 'Un pedido solo puede tener productos de un catálogo. Haz un pedido por ciudad.');
    const ciudadCatalogo = [...ciudades][0];
    const e = body.entrega || {};
    const tipoEntrega = txt(e.tipo, 10, 'la entrega', { obligatorio: true });
    if (!['retiro', 'envio'].includes(tipoEntrega)) falla(400, 'Elige retiro en agencia o envío a obra');
    const agencia = txt(e.agencia, 80, 'la agencia'); const direccion = txt(e.direccion, 240, 'la dirección');
    if (tipoEntrega === 'retiro' && !agencia) falla(400, 'Elige la agencia donde retirarás');
    if (tipoEntrega === 'envio' && !direccion) falla(400, 'Indica la dirección de la obra');
    const pago = txt(body.pago, 20, 'la forma de pago', { obligatorio: true });
    if (!PAGOS.includes(pago)) falla(400, 'Forma de pago inválida');
    const pr = await preciosDe(items, usuario);
    const sinPrecio = items.filter((i) => pr.get(`${i.ciudad}:${i.slug}`) == null);
    if (sinPrecio.length) falla(422, `Estos productos no tienen precio y hay que cotizarlos con tu ejecutivo: ${sinPrecio.map((i) => i.nombre).join(', ')}`);
    const lineas = items.map((i) => { const pu = pr.get(`${i.ciudad}:${i.slug}`); return { ...i, precio_unitario: pu, subtotal: Math.round(pu * i.cantidad * 100) / 100 }; });
    const totalPedido = total(lineas);
    const notas = txt(body.notas, 1000, 'las notas') || (presupuesto && presupuesto.notas) || null;
    let id;
    db.exec('BEGIN');
    try {
      id = Number(db.prepare(`INSERT INTO pedidos (numero, usuario_id, presupuesto_id, ciudad, entrega_tipo, entrega_agencia, entrega_direccion, fecha_deseada, pago, nit, razon_social, notas, total_estimado)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(`TMP-${Math.random().toString(36).slice(2)}`, usuario.id, presupuesto ? presupuesto.id : null, ciudadCatalogo, tipoEntrega, agencia || null, direccion || null,
        txt(e.fecha, 40, 'la fecha') || null, pago, usuario.nit, usuario.razon_social || usuario.nombre, notas, totalPedido).lastInsertRowid);
      const numero = `PD-${String(id).padStart(5, '0')}`;
      db.prepare('UPDATE pedidos SET numero = ? WHERE id = ?').run(numero, id);
      const ins = db.prepare('INSERT INTO pedido_items (pedido_id, ciudad_catalogo, slug, codigo, nombre, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      lineas.forEach((l) => ins.run(id, l.ciudad, l.slug, l.codigo, l.nombre, l.cantidad, l.precio_unitario, l.subtotal));
      db.prepare("INSERT INTO pedido_eventos (pedido_id, estado, nota, autor_id) VALUES (?, 'recibido', 'Pedido recibido desde el sitio', ?)").run(id, usuario.id);
      if (presupuesto) db.prepare("UPDATE presupuestos SET estado = 'convertido', actualizado_en = datetime('now') WHERE id = ?").run(presupuesto.id);
      db.exec('COMMIT');
    } catch (err) { db.exec('ROLLBACK'); throw err; }
    const pedido = pedidoDe(usuario, id, false);
    try {
      const r = await erp.enviarPedido({ numero: pedido.numero, cliente: { erp_id: usuario.erp_id, nit: usuario.nit, razon_social: usuario.razon_social || usuario.nombre, nombre: usuario.nombre, celular: usuario.celular, correo: usuario.correo },
        ciudad: ciudadCatalogo, entrega: { tipo: tipoEntrega, agencia, direccion, fecha: e.fecha || null }, pago, notas, total: totalPedido, items: lineas.map((l) => ({ codigo: l.codigo, nombre: l.nombre, cantidad: l.cantidad, precio: l.precio_unitario })) });
      db.prepare("UPDATE pedidos SET erp_ref = ?, erp_error = NULL WHERE id = ?").run(r.erpRef, id);
    } catch (err) {
      /* el pedido queda guardado; un ejecutivo lo reenvía al ERP desde el panel */
      db.prepare('UPDATE pedidos SET erp_error = ? WHERE id = ?').run(String(err.message).slice(0, 300), id);
    }
    return { status: 201, cuerpo: { pedido: ocultarErp(pedidoDe(usuario, id, false)) } };
  });
  ruta('GET', '/api/pedidos/:id', async ({ usuario, params }) => { requerirUsuario(usuario); return { pedido: ocultarErp(pedidoDe(usuario, Number(params.id), false)) }; });
  ruta('POST', '/api/pedidos/:id/repetir', async ({ usuario, params }) => {
    requerirUsuario(usuario);
    const p = pedidoDe(usuario, Number(params.id), false);
    return { items: p.items.map((i) => ({ ciudad: i.ciudad, slug: i.slug, codigo: i.codigo, nombre: i.nombre, cantidad: i.cantidad })), obra: null };
  });

  /* panel del equipo (ejecutivos y administradores) */
  const alcance = (u) => (u.rol === 'admin' ? { sql: '', args: [] } : { sql: ' AND ciudad = ?', args: [u.ciudad] });
  ruta('GET', '/api/admin/cuentas', async ({ usuario, url }) => {
    requerirStaff(usuario);
    const estado = url.searchParams.get('estado') || 'pendiente';
    if (!['pendiente', 'verificado', 'rechazado'].includes(estado)) falla(400, 'Estado inválido');
    const a = alcance(usuario);
    return { cuentas: db.prepare(`SELECT id, estado, tipo, nombre, razon_social, nit, ciudad, celular, correo, lista_precios, erp_id, creado_en FROM usuarios WHERE rol = 'cliente' AND estado = ?${a.sql} ORDER BY id DESC LIMIT 200`).all(estado, ...a.args) };
  });
  ruta('POST', '/api/admin/cuentas/:id', async ({ usuario, params, body }) => {
    requerirStaff(usuario);
    const a = alcance(usuario);
    const u = db.prepare(`SELECT * FROM usuarios WHERE id = ? AND rol = 'cliente'${a.sql}`).get(Number(params.id), ...a.args);
    if (!u) falla(404, 'No encontramos esa cuenta');
    if (!['verificar', 'rechazar'].includes(body.accion)) falla(400, 'Acción inválida');
    const lista = txt(body.lista_precios, 40, 'la lista de precios') || u.lista_precios;
    if (!/^[a-z0-9_-]+$/i.test(lista)) falla(400, 'Lista de precios inválida');
    db.prepare("UPDATE usuarios SET estado = ?, lista_precios = ?, erp_id = COALESCE(?, erp_id), verificado_por = ?, verificado_en = datetime('now') WHERE id = ?")
      .run(body.accion === 'verificar' ? 'verificado' : 'rechazado', lista, txt(body.erp_id, 40, 'el código del ERP') || null, usuario.id, u.id);
    return { ok: true };
  });
  ruta('GET', '/api/admin/pedidos', async ({ usuario, url }) => {
    requerirStaff(usuario);
    const estado = url.searchParams.get('estado');
    if (estado && !ESTADOS_PEDIDO.includes(estado)) falla(400, 'Estado inválido');
    const a = alcance(usuario);
    const filas = db.prepare(`SELECT p.id, p.numero, p.estado, p.ciudad, p.total_estimado, p.entrega_tipo, p.entrega_agencia, p.entrega_direccion, p.pago, p.erp_ref, p.erp_error, p.creado_en, u.nombre AS cliente, u.celular
      FROM pedidos p JOIN usuarios u ON u.id = p.usuario_id WHERE 1 = 1${estado ? ' AND p.estado = ?' : ''}${a.sql.replace('ciudad', 'p.ciudad')} ORDER BY p.id DESC LIMIT 200`).all(...(estado ? [estado] : []), ...a.args);
    return { pedidos: filas };
  });
  ruta('POST', '/api/admin/pedidos/:id/estado', async ({ usuario, params, body }) => {
    requerirStaff(usuario);
    const a = alcance(usuario);
    const p = db.prepare(`SELECT * FROM pedidos WHERE id = ?${a.sql}`).get(Number(params.id), ...a.args);
    if (!p) falla(404, 'No encontramos ese pedido');
    if (!ESTADOS_PEDIDO.includes(body.estado)) falla(400, 'Estado inválido');
    db.prepare("UPDATE pedidos SET estado = ?, actualizado_en = datetime('now') WHERE id = ?").run(body.estado, p.id);
    db.prepare('INSERT INTO pedido_eventos (pedido_id, estado, nota, autor_id) VALUES (?, ?, ?, ?)').run(p.id, body.estado, txt(body.nota, 300, 'la nota') || null, usuario.id);
    return { ok: true };
  });

  /* ---------- leads: solicitudes de los formularios del sitio ---------- */
  const sinTildes = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const ciudadLead = (v) => { const n = sinTildes(v).replace(/\s+/g, '-'); return CIUDADES.includes(n) ? n : 'otra'; };
  ruta('POST', '/api/leads', async ({ req, body }) => {
    if (!limLeads(ip(req))) falla(429, 'Demasiados envíos. Prueba más tarde.');
    if (body.web) return { ok: true }; /* campo trampa: los bots lo llenan */
    const asunto = txt(body.asunto, 120, 'el asunto', { obligatorio: true });
    const nombre = txt(body.nombre, 120, 'el nombre', { obligatorio: true });
    const correo = txt(body.correo, 120, 'el correo').toLowerCase();
    const celular = txt(body.celular, 30, 'el celular');
    if (!correo && !celular) falla(400, 'Déjanos un celular o un correo para responderte');
    if (correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) falla(400, 'El correo no es válido');
    if (celular && !/^[\d\s+()-]{6,30}$/.test(celular)) falla(400, 'El celular no es válido');
    const aparte = new Set(['asunto', 'nombre', 'correo', 'celular', 'empresa', 'ciudad', 'pagina', 'web']);
    const datos = {};
    Object.keys(body).filter((k) => !aparte.has(k) && typeof body[k] !== 'object').slice(0, 20).forEach((k) => { const v = txt(body[k], 500, k); if (v) datos[txt(k, 40, 'un campo')] = v; });
    const ciudad = ciudadLead(body.ciudad);
    const r = db.prepare('INSERT INTO leads (asunto, ciudad, nombre, empresa, correo, celular, datos, pagina) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(asunto, ciudad, nombre, txt(body.empresa, 120, 'la empresa') || null, correo || null, celular || null, Object.keys(datos).length ? JSON.stringify(datos) : null, txt(body.pagina, 120, 'la página') || null);
    return { status: 201, cuerpo: { ok: true, id: Number(r.lastInsertRowid) } };
  });
  const alcanceLeads = (u) => (u.rol === 'admin' ? { sql: '', args: [] } : { sql: ' AND ciudad = ?', args: [u.ciudad] });
  const filaLead = (l) => ({ ...l, datos: l.datos ? JSON.parse(l.datos) : {} });
  function consultaLeads(usuario, url) {
    const a = alcanceLeads(usuario); const estado = url.searchParams.get('estado'); const q = (url.searchParams.get('q') || '').trim().slice(0, 60);
    if (estado && !ESTADOS_LEAD.includes(estado)) falla(400, 'Estado inválido');
    let sql = `SELECT id, creado_en, asunto, ciudad, nombre, empresa, correo, celular, datos, pagina, estado, nota, actualizado_en FROM leads WHERE 1 = 1${a.sql}`; const args = [...a.args];
    if (estado) { sql += ' AND estado = ?'; args.push(estado); }
    if (q) { sql += " AND (nombre LIKE ? ESCAPE '\\' OR empresa LIKE ? ESCAPE '\\' OR correo LIKE ? ESCAPE '\\' OR celular LIKE ? ESCAPE '\\' OR asunto LIKE ? ESCAPE '\\')"; const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`; args.push(like, like, like, like, like); }
    return { sql: sql + ' ORDER BY id DESC LIMIT 500', args, a };
  }
  ruta('GET', '/api/admin/leads', async ({ usuario, url }) => {
    requerirStaff(usuario);
    const c = consultaLeads(usuario, url);
    const cuentas = db.prepare(`SELECT estado, COUNT(*) AS n FROM leads WHERE 1 = 1${c.a.sql} GROUP BY estado`).all(...c.a.args);
    return { leads: db.prepare(c.sql).all(...c.args).map(filaLead), cuentas: Object.fromEntries(cuentas.map((x) => [x.estado, x.n])), estados: ESTADOS_LEAD };
  });
  ruta('GET', '/api/admin/leads.csv', async ({ usuario, url }) => {
    requerirStaff(usuario);
    const c = consultaLeads(usuario, url);
    const celda = (v) => { let s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; };
    const filas = db.prepare(c.sql).all(...c.args).map(filaLead);
    const cab = ['Fecha (UTC)', 'Asunto', 'Ciudad', 'Nombre', 'Empresa', 'Correo', 'Celular', 'Estado', 'Nota', 'Detalle', 'Página'];
    const csv = '﻿' + [cab, ...filas.map((l) => [l.creado_en, l.asunto, l.ciudad, l.nombre, l.empresa, l.correo, l.celular, l.estado, l.nota, Object.entries(l.datos).map(([k, v]) => `${k}: ${v}`).join(' | '), l.pagina])].map((r) => r.map(celda).join(';')).join('\r\n');
    return { crudo: csv, cabeceras: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="leads-incerpaz.csv"', 'Cache-Control': 'no-store' } };
  });
  ruta('POST', '/api/admin/leads/:id', async ({ usuario, params, body }) => {
    requerirStaff(usuario);
    const a = alcanceLeads(usuario);
    const l = db.prepare(`SELECT id FROM leads WHERE id = ?${a.sql}`).get(Number(params.id), ...a.args);
    if (!l) falla(404, 'No encontramos ese contacto');
    if (body.estado !== undefined && !ESTADOS_LEAD.includes(body.estado)) falla(400, 'Estado inválido');
    const nota = body.nota === undefined ? undefined : txt(body.nota, 500, 'la nota');
    db.prepare("UPDATE leads SET estado = COALESCE(?, estado), nota = CASE WHEN ? = 1 THEN ? ELSE nota END, atendido_por = ?, actualizado_en = datetime('now') WHERE id = ?")
      .run(body.estado === undefined ? null : body.estado, nota === undefined ? 0 : 1, nota || null, usuario.id, l.id);
    return { ok: true };
  });

  /* ---------- administración del contenido (solo administradores) ---------- */
  const LISTAS = ['general', 'constructor'];
  const registrar = (u, entidad, detalle) => db.prepare('INSERT INTO cambios (usuario_id, entidad, detalle) VALUES (?, ?, ?)').run(u.id, entidad, String(detalle).slice(0, 300));
  async function publicar() { await contenido.reconstruir(); cargarCatalogo(); }
  const ciudadCat = (v) => { if (!CATALOGOS.includes(v)) falla(400, 'Catálogo inexistente'); return v; };

  ruta('GET', '/api/admin/contenido', async ({ usuario }) => {
    requerirAdmin(usuario);
    const { sitio, productos } = contenido.leer();
    return { sitio: { ciudades: sitio.ciudades, agencias: sitio.agencias, correo: sitio.correo, servicio_cliente: sitio.servicio_cliente, redes: sitio.redes }, categorias: sitio.categorias, productos, listas: LISTAS };
  });
  ruta('PUT', '/api/admin/sitio', async ({ usuario, body }) => {
    requerirAdmin(usuario);
    contenido.guardarSitio(body);
    registrar(usuario, 'sitio', `Actualizó ${Object.keys(body).join(', ')}`);
    await publicar();
    return { ok: true };
  });
  ruta('POST', '/api/admin/productos', async ({ usuario, body }) => {
    requerirAdmin(usuario);
    const p = contenido.crearProducto(body);
    registrar(usuario, 'producto', `Creó ${p.ciudad}:${p.slug}`);
    await publicar();
    return { status: 201, cuerpo: { producto: p } };
  });
  ruta('PUT', '/api/admin/productos/:ciudad/:slug', async ({ usuario, params, body }) => {
    requerirAdmin(usuario);
    ciudadCat(params.ciudad);
    contenido.guardarProducto(params.ciudad, params.slug, body);
    registrar(usuario, 'producto', `Editó ${params.ciudad}:${params.slug}`);
    await publicar();
    return { ok: true };
  });
  ruta('DELETE', '/api/admin/productos/:ciudad/:slug', async ({ usuario, params }) => {
    requerirAdmin(usuario);
    ciudadCat(params.ciudad);
    contenido.borrarProducto(params.ciudad, params.slug);
    db.prepare('DELETE FROM precios WHERE ciudad = ? AND slug = ?').run(params.ciudad, params.slug);
    registrar(usuario, 'producto', `Eliminó ${params.ciudad}:${params.slug}`);
    await publicar();
    return { ok: true };
  });

  ruta('GET', '/api/admin/precios', async ({ usuario, url }) => {
    requerirAdmin(usuario);
    const ciudad = ciudadCat(url.searchParams.get('ciudad'));
    const filas = db.prepare('SELECT slug, lista, precio, actualizado_en FROM precios WHERE ciudad = ?').all(ciudad);
    const productos = contenido.leer().productos.filter((p) => p.ciudad === ciudad).map((p) => {
      const precios = {}; let act = null;
      filas.filter((f) => f.slug === p.slug).forEach((f) => { precios[f.lista] = f.precio; if (!act || f.actualizado_en > act) act = f.actualizado_en; });
      return { slug: p.slug, nombre: p.titulo, codigo: p.codigo, precios, actualizado_en: act };
    });
    const nota = db.prepare('SELECT valor FROM ajustes WHERE clave = ?').get(`nota_precios:${ciudad}`);
    return { ciudad, listas: LISTAS, nota: nota ? nota.valor : '', productos };
  });
  ruta('PUT', '/api/admin/precios', async ({ usuario, body }) => {
    requerirAdmin(usuario);
    const ciudad = ciudadCat(body.ciudad);
    const cambios = Array.isArray(body.cambios) ? body.cambios : [];
    if (cambios.length > 500) falla(400, 'Demasiados cambios a la vez');
    const slugs = new Set(contenido.leer().productos.filter((p) => p.ciudad === ciudad).map((p) => p.slug));
    db.exec('BEGIN');
    try {
      for (const c of cambios) {
        if (!slugs.has(c.slug)) falla(400, `Producto inexistente: ${c.slug}`);
        if (!LISTAS.includes(c.lista)) falla(400, 'Lista de precios inválida');
        if (c.precio === null || c.precio === '') { db.prepare('DELETE FROM precios WHERE ciudad = ? AND slug = ? AND lista = ?').run(ciudad, c.slug, c.lista); continue; }
        const v = Number(c.precio);
        if (!Number.isFinite(v) || v < 0 || v > 100000) falla(400, `Precio inválido para ${c.slug}`);
        db.prepare("INSERT INTO precios (ciudad, slug, lista, precio, actualizado_por) VALUES (?, ?, ?, ?, ?) ON CONFLICT(ciudad, slug, lista) DO UPDATE SET precio = excluded.precio, actualizado_en = datetime('now'), actualizado_por = excluded.actualizado_por").run(ciudad, c.slug, c.lista, Math.round(v * 100) / 100, usuario.id);
      }
      if (body.nota != null) db.prepare('INSERT INTO ajustes (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor').run(`nota_precios:${ciudad}`, txt(body.nota, 200, 'la nota'));
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    registrar(usuario, 'precios', `${ciudad}: ${cambios.length} cambios`);
    return { ok: true, cambios: cambios.length };
  });

  ruta('POST', '/api/admin/imagenes', async ({ usuario, body }) => {
    requerirAdmin(usuario);
    const datos = Buffer.from(String(body.datos || ''), 'base64');
    if (!datos.length || datos.length > 4_000_000) falla(400, 'La imagen debe pesar menos de 4 MB');
    const ext = datos.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ? 'jpg' : datos.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) ? 'png' : (datos.subarray(0, 4).toString() === 'RIFF' && datos.subarray(8, 12).toString() === 'WEBP') ? 'webp' : null;
    if (!ext) falla(400, 'Solo se aceptan imágenes JPG, PNG o WebP');
    const nombre = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    fs.writeFileSync(path.join(SUBIDAS, nombre), datos);
    registrar(usuario, 'imagen', nombre);
    return { status: 201, cuerpo: { ruta: `assets/img/subidas/${nombre}` } };
  });

  ruta('GET', '/api/admin/historial', async ({ usuario }) => {
    requerirAdmin(usuario);
    return { versiones: contenido.historial(), cambios: db.prepare('SELECT c.id, c.entidad, c.detalle, c.creado_en, u.nombre AS autor FROM cambios c LEFT JOIN usuarios u ON u.id = c.usuario_id ORDER BY c.id DESC LIMIT 100').all() };
  });
  ruta('POST', '/api/admin/restaurar', async ({ usuario, body }) => {
    requerirAdmin(usuario);
    contenido.restaurar(String(body.version || ''));
    registrar(usuario, 'restaurar', body.version);
    await publicar();
    return { ok: true };
  });

  /* descarga de la base (solo administradores): copia consistente, queda registrada */
  ruta('GET', '/api/admin/respaldo', async ({ usuario }) => {
    requerirAdmin(usuario);
    const archivo = copiaTemporal(db, path.join(contenido.dir, 'tmp'));
    registrar(usuario, 'respaldo', 'Descargó una copia de la base de datos');
    const buf = fs.readFileSync(archivo); fs.rmSync(archivo, { force: true });
    return { crudo: buf, cabeceras: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="incerpaz-${new Date().toISOString().slice(0, 10)}.db"`, 'Cache-Control': 'no-store' } };
  });

  ruta('GET', '/api/admin/equipo', async ({ usuario }) => {
    requerirAdmin(usuario);
    return { equipo: db.prepare("SELECT id, rol, estado, nombre, ciudad, correo, creado_en FROM usuarios WHERE rol IN ('admin','ejecutivo') ORDER BY rol, id").all() };
  });
  ruta('POST', '/api/admin/equipo', async ({ usuario, body }) => {
    requerirAdmin(usuario);
    const correo = txt(body.correo, 120, 'el correo', { obligatorio: true }).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) falla(400, 'Correo inválido');
    if (!['admin', 'ejecutivo'].includes(body.rol)) falla(400, 'Rol inválido');
    if (!CIUDADES.includes(body.ciudad)) falla(400, 'Ciudad inválida');
    const password = String(body.password || '');
    if (password.length < 10) falla(400, 'La contraseña debe tener al menos 10 caracteres');
    if (db.prepare('SELECT id FROM usuarios WHERE correo = ?').get(correo)) falla(409, 'Ya existe una cuenta con ese correo');
    db.prepare("INSERT INTO usuarios (rol, estado, tipo, nombre, ciudad, celular, correo, pass_hash) VALUES (?, 'verificado', 'empresa', ?, ?, '00000000', ?, ?)")
      .run(body.rol, txt(body.nombre, 80, 'el nombre', { obligatorio: true }), body.ciudad, correo, auth.hashPassword(password));
    registrar(usuario, 'equipo', `Creó ${body.rol} ${correo}`);
    return { status: 201, cuerpo: { ok: true } };
  });
  ruta('POST', '/api/admin/equipo/:id/baja', async ({ usuario, params }) => {
    requerirAdmin(usuario);
    const id = Number(params.id);
    if (id === usuario.id) falla(400, 'No puedes dar de baja tu propia cuenta');
    const r = db.prepare("UPDATE usuarios SET estado = 'rechazado' WHERE id = ? AND rol IN ('admin','ejecutivo')").run(id);
    if (!r.changes) falla(404, 'No encontramos esa cuenta');
    db.prepare('DELETE FROM sesiones WHERE usuario_id = ?').run(id);
    registrar(usuario, 'equipo', `Dio de baja la cuenta ${id}`);
    return { ok: true };
  });

  /* ---------- servidor de archivos del sitio ---------- */
  const comprimidos = new Map();
  function servirEstatico(req, res, url) {
    let p; try { p = decodeURIComponent(url.pathname); } catch { return responder(res, 400, { error: 'Solicitud inválida' }); }
    if (p.includes('\0')) return responder(res, 400, { error: 'Solicitud inválida' });
    if (p === '/' || p === '') p = '/index.html';
    else if (!path.extname(p)) p = fs.existsSync(path.join(SITIO, p + '.html')) ? p + '.html' : p;
    const BASE = SUBIDAS && p.startsWith('/assets/img/subidas/') ? SUBIDAS : SITIO;
    if (BASE === SUBIDAS) p = p.slice('/assets/img/subidas'.length);
    const archivo = path.normalize(path.join(BASE, p));
    const relativo = path.relative(BASE, archivo);
    const oculto = relativo.split(path.sep).some((s) => s.startsWith('.'));
    if (relativo.startsWith('..') || path.isAbsolute(relativo) || oculto) return responder(res, 404, { error: 'No encontrado' });
    fs.stat(archivo, (err, st) => {
      if (err || !st.isFile()) {
        const nf = path.join(SITIO, '404.html');
        const html = fs.existsSync(nf) ? fs.readFileSync(nf) : Buffer.from('No encontrado');
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': html.length }); return res.end(req.method === 'HEAD' ? undefined : html);
      }
      const ext = path.extname(archivo).toLowerCase();
      /* html se revalida siempre (barato con ETag); css y js llevan ?v=hash y no cambian; las imágenes duran una semana */
      const cache = ext === '.html' ? 'no-cache' : (['.css', '.js'].includes(ext) && url.searchParams.has('v')) ? 'public, max-age=31536000, immutable' : /^\.(jpe?g|png|webp|svg|ico)$/.test(ext) ? 'public, max-age=604800' : 'public, max-age=300, must-revalidate';
      const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
      const cab = { 'Content-Type': MIME[ext] || 'application/octet-stream', ETag: etag, 'Cache-Control': cache, Vary: 'Accept-Encoding' };
      if (req.headers['if-none-match'] === etag) { res.writeHead(304, cab); return res.end(); }
      const ae = String(req.headers['accept-encoding'] || '');
      const enc = COMPRIMIBLES.has(ext) && st.size > 512 ? (/\bbr\b/.test(ae) ? 'br' : /\bgzip\b/.test(ae) ? 'gzip' : null) : null;
      if (enc) {
        const clave = `${archivo}|${st.mtimeMs}|${enc}`; let buf = comprimidos.get(clave);
        if (!buf) {
          const crudo = fs.readFileSync(archivo);
          buf = enc === 'br' ? zlib.brotliCompressSync(crudo, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }) : zlib.gzipSync(crudo, { level: 9 });
          if (comprimidos.size > 400) comprimidos.clear();
          comprimidos.set(clave, buf);
        }
        res.writeHead(200, Object.assign(cab, { 'Content-Encoding': enc, 'Content-Length': buf.length }));
        return res.end(req.method === 'HEAD' ? undefined : buf);
      }
      res.writeHead(200, Object.assign(cab, { 'Content-Length': st.size }));
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(archivo).pipe(res);
    });
  }

  /* ---------- manejador principal ---------- */
  return async function manejar(req, res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (seguro) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    /* en producción: un solo dominio (CANONICAL_HOST, ej. www.incerpaz.com) y siempre https detrás del proxy */
    const host = String(req.headers.host || '').toLowerCase(); const canon = (process.env.CANONICAL_HOST || '').toLowerCase();
    const http = process.env.TRUST_PROXY === '1' && req.headers['x-forwarded-proto'] === 'http';
    if (req.url !== '/api/salud' && ((canon && host !== canon && !/^(localhost|127\.|\[::1\])/.test(host)) || (seguro && http))) {
      res.writeHead(301, { Location: `${seguro ? 'https' : 'http'}://${canon || host}${req.url}`, 'Content-Length': 0 }); return res.end();
    }
    const url = new URL(req.url, 'http://localhost');
    try {
      if (!url.pathname.startsWith('/api/')) {
        if (!['GET', 'HEAD'].includes(req.method)) return responder(res, 405, { error: 'Método no permitido' });
        return servirEstatico(req, res, url);
      }
      const usuario = auth.usuarioDeSesion(db, cookies(req)[NOMBRE_COOKIE]);
      const cambia = !['GET', 'HEAD'].includes(req.method);
      if (cambia) {
        if (req.headers['x-requested-with'] !== 'incerpaz') falla(403, 'Solicitud no permitida');
        const origen = req.headers.origin;
        if (origen && new URL(origen).host !== req.headers.host) falla(403, 'Origen no permitido');
      }
      for (const r of rutas) {
        if (r.metodo !== req.method) continue;
        const m = r.re.exec(url.pathname);
        if (!m) continue;
        const body = cambia && req.method !== 'DELETE' ? await leerJson(req, url.pathname === '/api/admin/imagenes' ? 6_000_000 : undefined) : {};
        const salida = await r.fn({ req, res, url, usuario, params: m.groups || {}, body });
        if (salida && salida.crudo !== undefined) { const buf = Buffer.isBuffer(salida.crudo) ? salida.crudo : Buffer.from(salida.crudo, 'utf8'); res.writeHead(200, Object.assign({ 'Content-Length': buf.length }, salida.cabeceras)); return res.end(buf); }
        if (salida && salida.status) return responder(res, salida.status, salida.cuerpo);
        return responder(res, 200, salida);
      }
      return responder(res, 404, { error: 'No encontrado' });
    } catch (e) {
      if (e instanceof ErrorHttp) return responder(res, e.status, { error: e.message });
      console.error('[error]', e);
      return responder(res, 500, { error: 'Ocurrió un error. Intenta de nuevo.' });
    }
  };
}
module.exports = { crearApp };
