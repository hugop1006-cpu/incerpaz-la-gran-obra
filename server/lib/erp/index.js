'use strict';
/* Elige el adaptador con ERP_ADAPTER: local (por defecto: precios y pedidos en este servidor), mock (precios
   ficticios para pruebas) o seasoft (producción con ERP). Devuelve el adaptador listo para usar. */
function elegir(db) {
  const nombre = (process.env.ERP_ADAPTER || 'local').toLowerCase();
  if (nombre === 'local') return require('./local').crear(db);
  if (nombre === 'mock' || nombre === 'seasoft') return require(`./${nombre}.js`);
  throw new Error(`ERP_ADAPTER desconocido: ${nombre}`);
}
module.exports = { elegir };
