'use strict';
/* Respaldos: una copia consistente de la base (VACUUM INTO) y del contenido editable (productos, agencias,
   imágenes subidas e historial). Se guardan en carpetas con fecha y se conservan las últimas RESPALDOS_MAX. */
const fs = require('node:fs');
const path = require('node:path');

function marca(d = new Date()) { return d.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-'); }

function copiarDirectorio(origen, destino) {
  if (!fs.existsSync(origen)) return;
  fs.cpSync(origen, destino, { recursive: true, filter: (f) => !f.includes(`${path.sep}historial`) });
}

/* Devuelve la ruta de la carpeta creada. `contenidoDir` puede ser null. */
function crearRespaldo(db, { carpeta, contenidoDir, max = Number(process.env.RESPALDOS_MAX || 14) }) {
  fs.mkdirSync(carpeta, { recursive: true });
  const destino = path.join(carpeta, marca());
  fs.mkdirSync(destino, { recursive: true });
  const archivoDb = path.join(destino, 'incerpaz.db');
  fs.rmSync(archivoDb, { force: true });
  db.exec(`VACUUM INTO '${archivoDb.replace(/'/g, "''")}'`);
  if (contenidoDir) copiarDirectorio(contenidoDir, path.join(destino, 'contenido'));
  const todos = fs.readdirSync(carpeta, { withFileTypes: true }).filter((e) => e.isDirectory() && /^\d{8}-\d{4}$/.test(e.name)).map((e) => e.name).sort();
  todos.slice(0, Math.max(0, todos.length - max)).forEach((n) => fs.rmSync(path.join(carpeta, n), { recursive: true, force: true }));
  return destino;
}

/* Copia consistente de la base en un archivo temporal, para descargarla desde el panel. */
function copiaTemporal(db, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const archivo = path.join(dir, `descarga-${Date.now()}.db`);
  db.exec(`VACUUM INTO '${archivo.replace(/'/g, "''")}'`);
  return archivo;
}
module.exports = { crearRespaldo, copiaTemporal };
