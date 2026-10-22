'use strict';
/* Adaptador local (por defecto mientras no hay ERP): los precios salen de la tabla `precios`, que se edita en el
   panel de administración, y los pedidos quedan registrados en el servidor para que el equipo los atienda.
   Cuando exista la API de Seasoft se cambia ERP_ADAPTER=seasoft. */
const fs = require('node:fs');
const path = require('node:path');

const PUBLICADOS = path.join(__dirname, '..', '..', 'data', 'precios-publicados.json');

function sembrarPrecios(db) {
  const hay = db.prepare('SELECT COUNT(*) AS n FROM precios').get().n;
  if (hay) return 0;
  let datos; try { datos = JSON.parse(fs.readFileSync(PUBLICADOS, 'utf8')); } catch { return 0; }
  const ins = db.prepare("INSERT OR IGNORE INTO precios (ciudad, slug, lista, precio) VALUES (?, ?, 'general', ?)");
  let n = 0;
  db.exec('BEGIN');
  for (const [clave, precio] of Object.entries(datos.general || {})) { const [c, s] = clave.split(':'); ins.run(c, s, precio); n += 1; }
  db.exec('COMMIT');
  return n;
}

function crear(db) {
  sembrarPrecios(db);
  let secuencia = 0;
  return {
    nombre: 'local',
    ejemplo: false,
    async getPrecios({ ciudad, listaPrecios, productos }) {
      const filas = db.prepare("SELECT slug, lista, precio FROM precios WHERE ciudad = ? AND lista IN (?, 'general')").all(ciudad, listaPrecios);
      const out = {};
      for (const p of productos) {
        const propio = filas.find((f) => f.slug === p.slug && f.lista === listaPrecios);
        const general = filas.find((f) => f.slug === p.slug && f.lista === 'general');
        const f = propio || general;
        out[p.slug] = f ? f.precio : null;
      }
      return out;
    },
    async enviarPedido() { secuencia += 1; return { erpRef: null }; },
    async estadoPedido() { return null; },
    async buscarCliente() { return null; }
  };
}
module.exports = { crear, sembrarPrecios };
