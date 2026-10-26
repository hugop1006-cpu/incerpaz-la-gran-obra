'use strict';
/* Utilidades HTTP sin dependencias: cuerpo JSON, respuestas, cookies, límite de intentos. */
const crypto = require('node:crypto');

const MAX_CUERPO = 1_000_000;

class ErrorHttp extends Error {
  constructor(status, mensaje, detalle) { super(mensaje); this.status = status; this.detalle = detalle; }
}
const falla = (status, mensaje, detalle) => { throw new ErrorHttp(status, mensaje, detalle); };

function leerJson(req, max = MAX_CUERPO) {
  return new Promise((resolve, reject) => {
    const tipo = (req.headers['content-type'] || '').split(';')[0].trim();
    if (tipo !== 'application/json') return reject(new ErrorHttp(415, 'El contenido debe ser application/json'));
    let tam = 0; const partes = [];
    req.on('data', (c) => { tam += c.length; if (tam > max) { reject(new ErrorHttp(413, 'Solicitud demasiado grande')); req.destroy(); } else partes.push(c); });
    req.on('end', () => { try { resolve(partes.length ? JSON.parse(Buffer.concat(partes).toString('utf8')) : {}); } catch { reject(new ErrorHttp(400, 'JSON inválido')); } });
    req.on('error', reject);
  });
}
function responder(res, status, cuerpo, cabeceras = {}) {
  const data = JSON.stringify(cuerpo);
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(data), 'Cache-Control': 'no-store' }, cabeceras));
  res.end(data);
}
function cookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}
function cookie(nombre, valor, { maxAge, seguro }) {
  return `${nombre}=${encodeURIComponent(valor)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${seguro ? '; Secure' : ''}`;
}
function ip(req) {
  /* detrás de Cloudflare (CLOUDFLARE=1) la IP real viene en CF-Connecting-IP, que Cloudflare siempre reescribe;
     X-Forwarded-For lo puede falsear el visitante, así que no se usa en ese caso */
  if (process.env.CLOUDFLARE === '1' && req.headers['cf-connecting-ip']) return String(req.headers['cf-connecting-ip']).trim();
  const xf = process.env.TRUST_PROXY === '1' ? (req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '';
  return xf || req.socket.remoteAddress || 'desconocida';
}
/* Límite de intentos en memoria: ventana deslizante simple por clave. */
function limitador({ max, ventanaMs }) {
  const golpes = new Map();
  return (clave) => {
    const ahora = Date.now(); const lista = (golpes.get(clave) || []).filter((t) => ahora - t < ventanaMs);
    if (lista.length >= max) { golpes.set(clave, lista); return false; }
    lista.push(ahora); golpes.set(clave, lista);
    if (golpes.size > 5000) for (const [k, v] of golpes) if (!v.length || ahora - v[v.length - 1] > ventanaMs) golpes.delete(k);
    return true;
  };
}
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
module.exports = { ErrorHttp, falla, leerJson, responder, cookies, cookie, ip, limitador, sha256 };
