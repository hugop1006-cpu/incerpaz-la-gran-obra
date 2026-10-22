'use strict';
/* Elige el adaptador del ERP con la variable ERP_ADAPTER (mock por defecto, seasoft para producción). */
const nombre = (process.env.ERP_ADAPTER || 'mock').toLowerCase();
if (!['mock', 'seasoft'].includes(nombre)) throw new Error(`ERP_ADAPTER desconocido: ${nombre}`);
module.exports = require(`./${nombre}.js`);
