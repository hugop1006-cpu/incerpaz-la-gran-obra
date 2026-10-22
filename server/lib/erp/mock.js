'use strict';
/* Adaptador de ejemplo: precios ficticios y pedidos que no salen a ningún sistema.
   Sirve para desarrollar y probar el sitio sin el ERP. NO usar en producción. */
const fs = require('node:fs');
const path = require('node:path');

const archivo = process.env.TARIFAS_PATH || path.join(__dirname, '..', '..', 'data', 'tarifas.ejemplo.json');
let tarifas = { listas: {} };
try { tarifas = JSON.parse(fs.readFileSync(archivo, 'utf8')); } catch { /* sin archivo: no habrá precios */ }
let secuencia = 0;

module.exports = {
  nombre: 'mock',
  ejemplo: true,
  async getPrecios({ ciudad, listaPrecios, productos }) {
    const lista = (tarifas.listas || {})[listaPrecios] || (tarifas.listas || {}).general || {};
    const out = {};
    for (const p of productos) { const v = lista[`${ciudad}:${p.slug}`]; out[p.slug] = typeof v === 'number' ? v : null; }
    return out;
  },
  async enviarPedido(pedido) { secuencia += 1; return { erpRef: `MOCK-${Date.now().toString(36)}-${secuencia}` }; },
  async estadoPedido() { return null; },
  async buscarCliente() { return null; }
};
