'use strict';
/* Base de datos SQLite (módulo integrado de Node 22.5 o superior). El archivo se guarda en server/data/ o
   en la ruta de la variable DB_PATH. */
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

function abrir(ruta) {
  const archivo = ruta || process.env.DB_PATH || path.join(__dirname, '..', 'data', 'incerpaz.db');
  if (archivo !== ':memory:') fs.mkdirSync(path.dirname(archivo), { recursive: true });
  const db = new DatabaseSync(archivo);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(`
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rol TEXT NOT NULL DEFAULT 'cliente' CHECK (rol IN ('cliente','ejecutivo','admin')),
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','verificado','rechazado')),
  tipo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  razon_social TEXT,
  nit TEXT,
  ciudad TEXT NOT NULL,
  celular TEXT NOT NULL,
  correo TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash TEXT NOT NULL,
  lista_precios TEXT NOT NULL DEFAULT 'general',
  erp_id TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  verificado_por INTEGER REFERENCES usuarios(id),
  verificado_en TEXT
);
CREATE TABLE IF NOT EXISTS sesiones (
  token_hash TEXT PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  expira_en TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS presupuestos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  obra TEXT,
  notas TEXT,
  estado TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','enviado','convertido')),
  total_estimado REAL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS presupuesto_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  presupuesto_id INTEGER NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
  ciudad_catalogo TEXT NOT NULL,
  slug TEXT NOT NULL,
  codigo TEXT,
  nombre TEXT NOT NULL,
  cantidad REAL NOT NULL CHECK (cantidad > 0)
);
CREATE TABLE IF NOT EXISTS pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT NOT NULL UNIQUE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  presupuesto_id INTEGER REFERENCES presupuestos(id),
  estado TEXT NOT NULL DEFAULT 'recibido' CHECK (estado IN ('recibido','confirmado','en_despacho','entregado','anulado')),
  ciudad TEXT NOT NULL,
  entrega_tipo TEXT NOT NULL CHECK (entrega_tipo IN ('retiro','envio')),
  entrega_agencia TEXT,
  entrega_direccion TEXT,
  fecha_deseada TEXT,
  pago TEXT NOT NULL CHECK (pago IN ('transferencia','qr','agencia')),
  nit TEXT,
  razon_social TEXT,
  notas TEXT,
  total_estimado REAL,
  erp_ref TEXT,
  erp_error TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS pedido_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  ciudad_catalogo TEXT NOT NULL,
  slug TEXT NOT NULL,
  codigo TEXT,
  nombre TEXT NOT NULL,
  cantidad REAL NOT NULL,
  precio_unitario REAL,
  subtotal REAL
);
CREATE TABLE IF NOT EXISTS pedido_eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  estado TEXT NOT NULL,
  nota TEXT,
  autor_id INTEGER,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS precios (
  ciudad TEXT NOT NULL,
  slug TEXT NOT NULL,
  lista TEXT NOT NULL,
  precio REAL NOT NULL CHECK (precio >= 0),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_por INTEGER,
  PRIMARY KEY (ciudad, slug, lista)
);
CREATE TABLE IF NOT EXISTS ajustes (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cambios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER,
  entidad TEXT NOT NULL,
  detalle TEXT NOT NULL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  asunto TEXT NOT NULL,
  ciudad TEXT NOT NULL DEFAULT 'otra',
  nombre TEXT NOT NULL,
  empresa TEXT,
  correo TEXT,
  celular TEXT,
  datos TEXT,
  pagina TEXT,
  estado TEXT NOT NULL DEFAULT 'nuevo' CHECK (estado IN ('nuevo','contactado','cotizado','ganado','perdido')),
  nota TEXT,
  atendido_por INTEGER REFERENCES usuarios(id),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_leads_estado ON leads(estado, ciudad);
CREATE INDEX IF NOT EXISTS ix_pedidos_usuario ON pedidos(usuario_id);
CREATE INDEX IF NOT EXISTS ix_presupuestos_usuario ON presupuestos(usuario_id);
`);
  return db;
}
module.exports = { abrir };
