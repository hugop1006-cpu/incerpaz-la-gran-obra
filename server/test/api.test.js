'use strict';
/* Pruebas de la API: node --test server/test */
process.env.ERP_ADAPTER = 'mock';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { abrir } = require('../lib/db');
const { hashPassword } = require('../lib/auth');
const { crearApp } = require('../lib/app');
const erpMock = require('../lib/erp/mock');

function levantar(erp = erpMock) {
  const db = abrir(':memory:');
  const servidor = http.createServer(crearApp({ db, erp }));
  return new Promise((ok) => servidor.listen(0, '127.0.0.1', () => ok({ db, servidor, base: `http://127.0.0.1:${servidor.address().port}` })));
}
const cerrar = (servidor) => { servidor.closeAllConnections(); servidor.close(); };
function cliente(base) {
  let cookie = '';
  const llamar = async (metodo, ruta, cuerpo, extra = {}) => {
    const r = await fetch(base + ruta, { method: metodo, redirect: 'manual',
      headers: Object.assign({ cookie, 'X-Requested-With': 'incerpaz' }, cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}, extra),
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    const texto = await r.text(); let json = null; try { json = JSON.parse(texto); } catch { /* no es JSON */ }
    return { status: r.status, json, texto, headers: r.headers };
  };
  return { get: (r) => llamar('GET', r), post: (r, b = {}) => llamar('POST', r, b), del: (r) => llamar('DELETE', r), raw: llamar };
}
const registro = (o = {}) => Object.assign({ tipo: 'empresa', nombre: 'Ana Ejemplo', razon_social: 'Constructora Ejemplo SRL', nit: '1234567012', ciudad: 'cochabamba', celular: '70000001', correo: 'ana@ejemplo.com', password: 'clave-segura-1' }, o);
const items = [{ ciudad: 'cochabamba', slug: 'pavic-estandar', cantidad: 1000 }, { ciudad: 'cochabamba', slug: '18-h', cantidad: 500 }];

test('registro: valida datos, crea cuenta pendiente y rechaza duplicados', async () => {
  const { servidor, base } = await levantar(); const c = cliente(base);
  assert.equal((await c.post('/api/registro', registro({ correo: 'mal' }))).status, 400);
  assert.equal((await c.post('/api/registro', registro({ password: 'corta' }))).status, 400);
  assert.equal((await c.post('/api/registro', registro({ celular: '123' }))).status, 400);
  assert.equal((await c.post('/api/registro', registro({ nit: '', razon_social: '' }))).status, 400, 'una empresa necesita NIT y razón social');
  assert.equal((await c.post('/api/registro', registro({ ciudad: 'tarija' }))).status, 400);
  const ok = await c.post('/api/registro', registro());
  assert.equal(ok.status, 201); assert.equal(ok.json.estado, 'pendiente');
  assert.equal((await c.post('/api/registro', registro())).status, 409);
  cerrar(servidor);
});

test('los precios solo salen para cuentas verificadas', async () => {
  const { db, servidor, base } = await levantar(); const c = cliente(base);
  assert.equal((await c.get('/api/precios?ciudad=cochabamba')).status, 401, 'sin sesión');
  await c.post('/api/registro', registro());
  assert.equal((await c.post('/api/login', { correo: 'ana@ejemplo.com', password: 'mala-clave-1' })).status, 401);
  const login = await c.post('/api/login', { correo: 'ANA@ejemplo.com', password: 'clave-segura-1' });
  assert.equal(login.status, 200); assert.equal(login.json.usuario.estado, 'pendiente');
  assert.ok(!('pass_hash' in login.json.usuario), 'no se filtra el hash');
  const pend = await c.get('/api/precios?ciudad=cochabamba');
  assert.equal(pend.status, 403); assert.ok(!/\d\.\d/.test(pend.texto), 'ninguna cifra en la respuesta');
  db.prepare("UPDATE usuarios SET estado = 'verificado' WHERE correo = 'ana@ejemplo.com'").run();
  const ver = await c.get('/api/precios?ciudad=cochabamba');
  assert.equal(ver.status, 200); assert.equal(ver.json.ejemplo, true);
  assert.equal(typeof ver.json.precios['pavic-estandar'], 'number');
  assert.equal((await c.get('/api/precios?ciudad=tarija')).status, 400);
  await c.post('/api/logout');
  assert.equal((await c.get('/api/precios?ciudad=cochabamba')).status, 401, 'la sesión se cierra');
  cerrar(servidor);
});

test('un ejecutivo verifica cuentas solo de su ciudad y asigna la lista de precios', async () => {
  const { db, servidor, base } = await levantar(); const cli = cliente(base), ej = cliente(base), ejSC = cliente(base);
  db.prepare("INSERT INTO usuarios (rol, estado, tipo, nombre, ciudad, celular, correo, pass_hash) VALUES ('ejecutivo','verificado','empresa','Ejecutivo CBBA','cochabamba','70000002','ej@incerpaz.test',?)").run(hashPassword('ejecutivo-clave'));
  db.prepare("INSERT INTO usuarios (rol, estado, tipo, nombre, ciudad, celular, correo, pass_hash) VALUES ('ejecutivo','verificado','empresa','Ejecutivo SCZ','santa-cruz','70000003','sc@incerpaz.test',?)").run(hashPassword('ejecutivo-clave'));
  await cli.post('/api/registro', registro());
  assert.equal((await cli.get('/api/admin/cuentas')).status, 401);
  await cli.post('/api/login', { correo: 'ana@ejemplo.com', password: 'clave-segura-1' });
  assert.equal((await cli.get('/api/admin/cuentas')).status, 403, 'un cliente no entra al panel');
  await ej.post('/api/login', { correo: 'ej@incerpaz.test', password: 'ejecutivo-clave' });
  await ejSC.post('/api/login', { correo: 'sc@incerpaz.test', password: 'ejecutivo-clave' });
  assert.equal((await ejSC.get('/api/admin/cuentas')).json.cuentas.length, 0, 'otra ciudad no la ve');
  const lista = (await ej.get('/api/admin/cuentas')).json.cuentas; assert.equal(lista.length, 1);
  assert.equal((await ejSC.post(`/api/admin/cuentas/${lista[0].id}`, { accion: 'verificar' })).status, 404);
  assert.equal((await ej.post(`/api/admin/cuentas/${lista[0].id}`, { accion: 'verificar', lista_precios: 'constructor' })).status, 200);
  const yo = (await cli.get('/api/yo')).json.usuario; assert.equal(yo.estado, 'verificado'); assert.equal(yo.lista_precios, 'constructor');
  const general = (await ej.get('/api/precios?ciudad=cochabamba')).json.precios['pavic-estandar'];
  const constructor = (await cli.get('/api/precios?ciudad=cochabamba')).json.precios['pavic-estandar'];
  assert.ok(constructor < general, 'la lista de constructor es distinta de la general');
  cerrar(servidor);
});

test('presupuesto y pedido: totales en el servidor, un catálogo por pedido y paso al ERP', async () => {
  const { db, servidor, base } = await levantar(); const c = cliente(base);
  await c.post('/api/registro', registro());
  await c.post('/api/login', { correo: 'ana@ejemplo.com', password: 'clave-segura-1' });
  const pend = await c.post('/api/presupuestos', { obra: 'Edificio Av. Ejemplo', items });
  assert.equal(pend.status, 201); assert.equal(pend.json.total_estimado, null, 'una cuenta pendiente no ve totales');
  assert.equal((await c.post('/api/pedidos', { presupuesto_id: pend.json.id, entrega: { tipo: 'retiro', agencia: 'Central' }, pago: 'qr' })).status, 403);
  db.prepare("UPDATE usuarios SET estado = 'verificado' WHERE correo = 'ana@ejemplo.com'").run();
  assert.equal((await c.post('/api/presupuestos', { items: [{ ciudad: 'cochabamba', slug: 'no-existe', cantidad: 1 }] })).status, 400);
  assert.equal((await c.post('/api/presupuestos', { items: [{ ...items[0], cantidad: -5 }] })).status, 400);
  assert.equal((await c.post('/api/presupuestos', { items: [items[0], items[0]] })).status, 400, 'repetidos');
  const pres = await c.post('/api/presupuestos', { id: pend.json.id, obra: 'Edificio Av. Ejemplo', items });
  assert.equal(pres.status, 200); assert.ok(pres.json.total_estimado > 0);
  const det = (await c.get(`/api/presupuestos/${pend.json.id}`)).json.presupuesto;
  assert.equal(det.items.length, 2); assert.equal(Math.round(det.items.reduce((t, i) => t + i.subtotal, 0) * 100) / 100, pres.json.total_estimado);
  assert.equal((await c.post('/api/pedidos', { items: [items[0], { ciudad: 'santa-cruz', slug: 'pavic-estandar', cantidad: 10 }], entrega: { tipo: 'retiro', agencia: 'Central' }, pago: 'qr' })).status, 400, 'mezcla de catálogos');
  assert.equal((await c.post('/api/pedidos', { presupuesto_id: pend.json.id, entrega: { tipo: 'envio' }, pago: 'qr' })).status, 400, 'envío sin dirección');
  assert.equal((await c.post('/api/pedidos', { presupuesto_id: pend.json.id, entrega: { tipo: 'retiro', agencia: 'Central' }, pago: 'tarjeta' })).status, 400, 'pago no aceptado');
  const ped = await c.post('/api/pedidos', { presupuesto_id: pend.json.id, entrega: { tipo: 'retiro', agencia: 'Central' }, pago: 'transferencia' });
  assert.equal(ped.status, 201); assert.match(ped.json.pedido.numero, /^PD-\d{5}$/); assert.match(ped.json.pedido.erp_ref, /^MOCK-/);
  assert.equal(ped.json.pedido.total_estimado, pres.json.total_estimado); assert.equal(ped.json.pedido.estado, 'recibido');
  assert.ok(!('erp_error' in ped.json.pedido));
  assert.equal((await c.post('/api/pedidos', { presupuesto_id: pend.json.id, entrega: { tipo: 'retiro', agencia: 'Central' }, pago: 'qr' })).status, 409, 'ya convertido');
  const rep = await c.post(`/api/pedidos/${ped.json.pedido.id}/repetir`); assert.equal(rep.json.items.length, 2);
  assert.equal((await c.get('/api/pedidos')).json.pedidos.length, 1);
  cerrar(servidor);
});

test('si el ERP falla, el pedido queda guardado y se marca el error sin mostrarlo al cliente', async () => {
  const roto = { ...erpMock, enviarPedido: async () => { throw new Error('Seasoft no responde'); } };
  const { db, servidor, base } = await levantar(roto); const c = cliente(base);
  await c.post('/api/registro', registro()); await c.post('/api/login', { correo: 'ana@ejemplo.com', password: 'clave-segura-1' });
  db.prepare("UPDATE usuarios SET estado = 'verificado' WHERE correo = 'ana@ejemplo.com'").run();
  const ped = await c.post('/api/pedidos', { items, entrega: { tipo: 'envio', direccion: 'Av. Ejemplo 123' }, pago: 'agencia' });
  assert.equal(ped.status, 201); assert.equal(ped.json.pedido.erp_ref, null); assert.ok(!('erp_error' in ped.json.pedido));
  assert.match(db.prepare('SELECT erp_error FROM pedidos').get().erp_error, /Seasoft/);
  cerrar(servidor);
});

test('el panel cambia el estado del pedido y deja historial', async () => {
  const { db, servidor, base } = await levantar(); const c = cliente(base), a = cliente(base);
  db.prepare("INSERT INTO usuarios (rol, estado, tipo, nombre, ciudad, celular, correo, pass_hash) VALUES ('admin','verificado','empresa','Admin','cochabamba','70000009','admin@incerpaz.test',?)").run(hashPassword('admin-clave-1'));
  await c.post('/api/registro', registro()); await c.post('/api/login', { correo: 'ana@ejemplo.com', password: 'clave-segura-1' });
  db.prepare("UPDATE usuarios SET estado = 'verificado' WHERE correo = 'ana@ejemplo.com'").run();
  const ped = (await c.post('/api/pedidos', { items, entrega: { tipo: 'retiro', agencia: 'Central' }, pago: 'qr' })).json.pedido;
  await a.post('/api/login', { correo: 'admin@incerpaz.test', password: 'admin-clave-1' });
  assert.equal((await a.post(`/api/admin/pedidos/${ped.id}/estado`, { estado: 'volando' })).status, 400);
  assert.equal((await a.post(`/api/admin/pedidos/${ped.id}/estado`, { estado: 'en_despacho', nota: 'Sale hoy' })).status, 200);
  const det = (await c.get(`/api/pedidos/${ped.id}`)).json.pedido;
  assert.equal(det.estado, 'en_despacho'); assert.deepEqual(det.eventos.map((e) => e.estado), ['recibido', 'en_despacho']);
  assert.equal((await a.get('/api/admin/pedidos')).json.pedidos.length, 1);
  cerrar(servidor);
});

test('seguridad: CSRF, archivos fuera del sitio y límite de intentos', async () => {
  const { servidor, base } = await levantar(); const c = cliente(base);
  assert.equal((await c.raw('POST', '/api/login', { correo: 'a@b.co', password: 'x' }, { 'X-Requested-With': '' })).status, 403, 'sin cabecera anti-CSRF');
  assert.equal((await c.raw('POST', '/api/login', { correo: 'a@b.co', password: 'x' }, { Origin: 'http://malo.example' })).status, 403, 'origen ajeno');
  const traversal = await fetch(`${base}/..%2f..%2fserver%2flib%2fdb.js`); assert.equal(traversal.status, 404);
  assert.equal((await fetch(`${base}/server/lib/db.js`)).status, 404);
  assert.equal((await fetch(`${base}/`)).status, 200);
  assert.match((await fetch(`${base}/`)).headers.get('x-content-type-options'), /nosniff/);
  let ultimo = 0; for (let i = 0; i < 12; i++) ultimo = (await c.post('/api/login', { correo: 'nadie@ejemplo.com', password: 'cualquiera-1' })).status;
  assert.equal(ultimo, 429, 'tras varios intentos fallidos se bloquea');
  cerrar(servidor);
});
