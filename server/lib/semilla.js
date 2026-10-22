'use strict';
/* Cuentas iniciales del equipo. El administrador se crea una sola vez; si no hay ADMIN_PASSWORD se genera
   una contraseña al azar y se muestra en el registro del servidor (cámbiala entrando a Mi cuenta del equipo
   o con server/crear-admin.js). La cuenta de prueba solo existe con SEMBRAR_DEMO=1. */
const crypto = require('node:crypto');
const { hashPassword } = require('./auth');

function crearCuenta(db, { correo, nombre, ciudad, rol, password }) {
  if (db.prepare('SELECT id FROM usuarios WHERE correo = ?').get(correo)) return false;
  db.prepare("INSERT INTO usuarios (rol, estado, tipo, nombre, ciudad, celular, correo, pass_hash) VALUES (?, 'verificado', 'empresa', ?, ?, '00000000', ?, ?)")
    .run(rol, nombre, ciudad, correo, hashPassword(password));
  return true;
}

function sembrarCuentas(db, log = console.log) {
  const correo = (process.env.ADMIN_CORREO || 'hugop1006@gmail.com').toLowerCase();
  const generada = crypto.randomBytes(9).toString('base64url');
  const password = process.env.ADMIN_PASSWORD || generada;
  if (crearCuenta(db, { correo, nombre: process.env.ADMIN_NOMBRE || 'Hugo', ciudad: 'cochabamba', rol: 'admin', password })) {
    log(`[cuentas] Administrador creado: ${correo}${process.env.ADMIN_PASSWORD ? '' : `  contraseña inicial: ${generada}  (anótala y cámbiala)`}`);
  }
  if (process.env.SEMBRAR_DEMO === '1') {
    const demo = { correo: 'ejecutivo.prueba@incerpaz.test', nombre: 'Ejecutivo de Prueba', ciudad: 'cochabamba', rol: 'ejecutivo', password: process.env.DEMO_PASSWORD || 'Prueba-Incerpaz-2026' };
    if (crearCuenta(db, demo)) log(`[cuentas] Cuenta de prueba (ejecutivo Cochabamba): ${demo.correo}`);
  }
}
module.exports = { sembrarCuentas };
