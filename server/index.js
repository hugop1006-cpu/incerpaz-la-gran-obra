#!/usr/bin/env node
'use strict';
/* Servidor de INCERPAZ: sitio + cuentas, precios, presupuestos y pedidos.
   Uso: node server/index.js   (variables en server/README.md) */
const http = require('node:http');
const { abrir } = require('./lib/db');
const { elegir } = require('./lib/erp');
const { crearContenido } = require('./lib/contenido');
const { sembrarCuentas } = require('./lib/semilla');
const auth = require('./lib/auth');
const { crearApp } = require('./lib/app');

const db = abrir();
const erp = elegir(db);
const contenido = crearContenido();
sembrarCuentas(db);
const puerto = Number(process.env.PORT || 8080);
const host = process.env.HOST || '127.0.0.1';
let servidor;
/* regenera las páginas con el contenido guardado (así un despliegue nuevo no pierde las ediciones del panel) y arranca */
contenido.reconstruir().catch((e) => console.error('[build]', e.message)).then(() => {
servidor = http.createServer(crearApp({ db, erp, contenido }));
servidor.listen(puerto, host, () => console.log(`INCERPAZ en http://${host}:${puerto}/  (ERP: ${erp.nombre}${erp.ejemplo ? ', precios de ejemplo' : ''})`));
});

/* limpieza de sesiones vencidas y, si el ERP lo permite, sincronización del estado de los pedidos abiertos */
setInterval(() => auth.limpiarSesiones(db), 6 * 3600_000).unref();
if (erp.nombre === 'seasoft') {
  setInterval(async () => {
    const abiertos = db.prepare("SELECT id, erp_ref, estado FROM pedidos WHERE erp_ref IS NOT NULL AND estado IN ('recibido','confirmado','en_despacho')").all();
    for (const p of abiertos) {
      try {
        const r = await erp.estadoPedido(p.erp_ref);
        if (r && r.estado && r.estado !== p.estado) {
          db.prepare("UPDATE pedidos SET estado = ?, actualizado_en = datetime('now') WHERE id = ?").run(r.estado, p.id);
          db.prepare("INSERT INTO pedido_eventos (pedido_id, estado, nota) VALUES (?, ?, 'Actualizado desde el ERP')").run(p.id, r.estado);
        }
      } catch (e) { console.error('[sync]', p.erp_ref, e.message); }
    }
  }, Number(process.env.SYNC_MS || 300_000)).unref();
}
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => (servidor ? servidor.close(() => process.exit(0)) : process.exit(0)));
