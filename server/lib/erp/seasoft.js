'use strict';
/* Adaptador para el ERP Seasoft de INCERPAZ.
   ESTADO: propuesta de contrato, SIN PROBAR contra el ERP real. No tenemos la documentación de Seasoft,
   así que este adaptador asume una API REST con JSON. Si Seasoft expone otra interfaz (otras rutas, base de
   datos, archivos), solo hay que reescribir este archivo: el resto del sitio usa los cuatro métodos de abajo.
   Contrato esperado: ver server/ERP.md. Variables: SEASOFT_URL, SEASOFT_TOKEN. */
const base = () => { const u = process.env.SEASOFT_URL; if (!u) throw new Error('Falta SEASOFT_URL: el adaptador de Seasoft no está configurado.'); return u.replace(/\/$/, ''); };
async function llamar(ruta, { metodo = 'GET', cuerpo } = {}) {
  const r = await fetch(base() + ruta, {
    method: metodo,
    headers: Object.assign({ Accept: 'application/json', Authorization: `Bearer ${process.env.SEASOFT_TOKEN || ''}` }, cuerpo ? { 'Content-Type': 'application/json' } : {}),
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    signal: AbortSignal.timeout(Number(process.env.SEASOFT_TIMEOUT_MS || 10000))
  });
  if (!r.ok) throw new Error(`Seasoft respondió ${r.status} en ${metodo} ${ruta}`);
  return r.status === 204 ? null : r.json();
}
module.exports = {
  nombre: 'seasoft',
  ejemplo: false,
  /* GET /tarifas?ciudad=cochabamba&lista=general  ->  [{ "codigo": "PVC STD", "precio": 1.5 }, ...] */
  async getPrecios({ ciudad, listaPrecios, productos }) {
    const filas = await llamar(`/tarifas?ciudad=${encodeURIComponent(ciudad)}&lista=${encodeURIComponent(listaPrecios)}`);
    const porCodigo = new Map((filas || []).map((f) => [String(f.codigo).trim().toUpperCase(), Number(f.precio)]));
    const out = {};
    for (const p of productos) { const v = porCodigo.get(String(p.codigo || '').trim().toUpperCase()); out[p.slug] = Number.isFinite(v) ? v : null; }
    return out;
  },
  /* POST /pedidos  ->  { "ref": "PD-000123" } */
  async enviarPedido(pedido) {
    const r = await llamar('/pedidos', { metodo: 'POST', cuerpo: pedido });
    return { erpRef: String(r.ref) };
  },
  /* GET /pedidos/{ref}  ->  { "estado": "confirmado" | "en_despacho" | "entregado" | "anulado" } */
  async estadoPedido(erpRef) { const r = await llamar(`/pedidos/${encodeURIComponent(erpRef)}`); return r && r.estado ? { estado: r.estado } : null; },
  /* GET /clientes?nit=123  ->  { "id": "C-45", "nombre": "..." } o 404 */
  async buscarCliente({ nit }) { try { const r = await llamar(`/clientes?nit=${encodeURIComponent(nit)}`); return r ? { erpId: String(r.id), nombre: r.nombre } : null; } catch { return null; } }
};
