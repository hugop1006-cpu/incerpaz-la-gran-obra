'use strict';
/* Contraseñas con scrypt y sesiones con token aleatorio guardado como hash. */
const crypto = require('node:crypto');
const { sha256 } = require('./http');

const DIAS_SESION = 7;

function hashPassword(password) {
  const sal = crypto.randomBytes(16);
  const h = crypto.scryptSync(password, sal, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${sal.toString('hex')}$${h.toString('hex')}`;
}
function verificarPassword(password, guardado) {
  const [alg, salHex, hHex] = String(guardado).split('$');
  if (alg !== 'scrypt' || !salHex || !hHex) return false;
  const esperado = Buffer.from(hHex, 'hex');
  const h = crypto.scryptSync(password, Buffer.from(salHex, 'hex'), esperado.length, { N: 16384, r: 8, p: 1 });
  return h.length === esperado.length && crypto.timingSafeEqual(h, esperado);
}
function crearSesion(db, usuarioId) {
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare("INSERT INTO sesiones (token_hash, usuario_id, expira_en) VALUES (?, ?, datetime('now', ?))").run(sha256(token), usuarioId, `+${DIAS_SESION} days`);
  return token;
}
function usuarioDeSesion(db, token) {
  if (!token) return null;
  return db.prepare(`SELECT u.* FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
                     WHERE s.token_hash = ? AND s.expira_en > datetime('now')`).get(sha256(token)) || null;
}
function cerrarSesion(db, token) { if (token) db.prepare('DELETE FROM sesiones WHERE token_hash = ?').run(sha256(token)); }
function limpiarSesiones(db) { db.prepare("DELETE FROM sesiones WHERE expira_en <= datetime('now')").run(); }
module.exports = { hashPassword, verificarPassword, crearSesion, usuarioDeSesion, cerrarSesion, limpiarSesiones, DIAS_SESION };
