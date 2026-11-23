#!/usr/bin/env node
'use strict';
/* Crea un respaldo ahora mismo.  Uso: node server/respaldo.js [carpeta]
   Por defecto: BACKUP_DIR o /datos/respaldos (junto a la base). Restaurar: ver server/DESPLIEGUE.md. */
const path = require('node:path');
const { abrir } = require('./lib/db');
const { crearRespaldo } = require('./lib/respaldo');
const db = abrir();
const base = process.env.DB_PATH ? path.dirname(process.env.DB_PATH) : path.join(__dirname, 'data');
const carpeta = process.argv[2] || process.env.BACKUP_DIR || path.join(base, 'respaldos');
const contenido = process.env.CONTENT_DIR || path.join(__dirname, 'data', 'contenido');
console.log('Respaldo creado en', crearRespaldo(db, { carpeta, contenidoDir: contenido }));
