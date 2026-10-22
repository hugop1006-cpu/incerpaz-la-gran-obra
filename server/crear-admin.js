#!/usr/bin/env node
'use strict';
/* Crea (o actualiza) una cuenta del equipo.
   Uso: node server/crear-admin.js correo contraseña "Nombre" [ciudad] [rol]
   rol: admin (ve todas las ciudades) o ejecutivo (solo su ciudad). Por defecto: admin, cochabamba. */
const { abrir } = require('./lib/db');
const { hashPassword } = require('./lib/auth');
const [correo, password, nombre, ciudad = 'cochabamba', rol = 'admin'] = process.argv.slice(2);
if (!correo || !password || !nombre || password.length < 8 || !['admin', 'ejecutivo'].includes(rol) || !['cochabamba', 'santa-cruz', 'oruro', 'sucre'].includes(ciudad)) {
  console.error('Uso: node server/crear-admin.js correo contraseña(8+) "Nombre" [cochabamba|santa-cruz|oruro|sucre] [admin|ejecutivo]'); process.exit(1);
}
const db = abrir();
const existe = db.prepare('SELECT id FROM usuarios WHERE correo = ?').get(correo.toLowerCase());
if (existe) db.prepare("UPDATE usuarios SET pass_hash = ?, rol = ?, estado = 'verificado', nombre = ?, ciudad = ? WHERE id = ?").run(hashPassword(password), rol, nombre, ciudad, existe.id);
else db.prepare("INSERT INTO usuarios (rol, estado, tipo, nombre, ciudad, celular, correo, pass_hash) VALUES (?, 'verificado', 'empresa', ?, ?, '00000000', ?, ?)").run(rol, nombre, ciudad, correo.toLowerCase(), hashPassword(password));
console.log(`${existe ? 'Actualizada' : 'Creada'} la cuenta ${rol} de ${correo}.`);
