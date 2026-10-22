'use strict';
/* Contenido editable del sitio (productos, agencias, teléfonos, WhatsApp…). Vive en una carpeta de datos del
   servidor (CONTENT_DIR o server/data/contenido) y el generador site-src/build.js lo convierte en las páginas.
   Cada guardado conserva una copia anterior en historial/ para poder volver atrás. */
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { falla } = require('./http');

const RAIZ = path.resolve(__dirname, '..', '..');
const SEMILLA = path.join(RAIZ, 'site-src', 'data');
const CIUDADES = ['cochabamba', 'santa-cruz', 'oruro', 'sucre'];
const TIPOS_AGENCIA = ['agencia', 'fabrica'];

const cad = (v, max, nombre, obligatorio = true) => {
  const s = v == null ? '' : String(v).replace(/\s+/g, ' ').trim();
  if (obligatorio && !s) falla(400, `Falta ${nombre}`);
  if (s.length > max) falla(400, `${nombre} es demasiado largo`);
  return s;
};
const url = (v, nombre) => { const s = cad(v, 300, nombre, false); if (s && !/^https:\/\//.test(s)) falla(400, `${nombre} debe empezar con https://`); return s; };

function crearContenido({ dir = process.env.CONTENT_DIR || path.join(RAIZ, 'server', 'data', 'contenido'), construir = true } = {}) {
  fs.mkdirSync(path.join(dir, 'historial'), { recursive: true });
  for (const f of ['sitio.json', 'productos.json']) if (!fs.existsSync(path.join(dir, f))) fs.copyFileSync(path.join(SEMILLA, f), path.join(dir, f));
  const leer = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  function escribir(f, datos) {
    const destino = path.join(dir, f);
    const marca = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(destino, path.join(dir, 'historial', `${marca}-${f}`));
    const viejos = fs.readdirSync(path.join(dir, 'historial')).filter((n) => n.endsWith(`-${f}`)).sort();
    viejos.slice(0, Math.max(0, viejos.length - 40)).forEach((n) => fs.rmSync(path.join(dir, 'historial', n)));
    const tmp = destino + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(datos, null, 1));
    fs.renameSync(tmp, destino);
  }

  /* regenera las páginas; se encolan para que dos guardados seguidos no choquen */
  let cola = Promise.resolve();
  const reconstruir = () => {
    if (!construir) return Promise.resolve();
    cola = cola.then(() => new Promise((resolve, reject) => {
      execFile(process.execPath, [path.join(RAIZ, 'site-src', 'build.js')], { env: Object.assign({}, process.env, { CONTENT_DIR: dir }), timeout: 120_000 },
        (err, _o, e) => (err ? reject(new Error('No se pudo regenerar el sitio: ' + String(e || err.message).slice(0, 300))) : resolve()));
    })).catch((e) => { console.error('[build]', e.message); throw e; });
    return cola;
  };

  /* ---------- validaciones ---------- */
  function validarCiudades(lista) {
    if (!Array.isArray(lista) || lista.length !== CIUDADES.length) falla(400, 'Las ciudades de operación son cuatro; edita sus datos, no las agregues ni borres');
    return CIUDADES.map((slug) => {
      const c = lista.find((x) => x && x.slug === slug); if (!c) falla(400, `Falta la ciudad ${slug}`);
      const wa = String(c.whatsapp || '').replace(/\D/g, '');
      if (!/^[67]\d{7}$/.test(wa)) falla(400, `El WhatsApp de ${c.nombre || slug} debe tener 8 dígitos y empezar con 6 o 7`);
      return { slug, nombre: cad(c.nombre, 40, 'el nombre de la ciudad'), whatsapp: wa };
    });
  }
  function validarAgencias(obj) {
    if (!obj || typeof obj !== 'object') falla(400, 'Agencias inválidas');
    const out = {};
    for (const ciudad of CIUDADES) {
      const lista = obj[ciudad] || [];
      if (!Array.isArray(lista) || lista.length > 40) falla(400, `Agencias inválidas en ${ciudad}`);
      out[ciudad] = lista.map((a, i) => {
        const nombre = cad(a && a.nombre, 80, `el nombre de la agencia ${i + 1} de ${ciudad}`);
        if (!TIPOS_AGENCIA.includes(a.tipo)) falla(400, `Tipo inválido en ${nombre}`);
        const tels = (Array.isArray(a.telefonos) ? a.telefonos : String(a.telefonos || '').split(/[,\n]/)).map((t) => String(t).trim()).filter(Boolean);
        tels.forEach((t) => { if (!/^\d-\d{6,8}$|^\d{7,9}$/.test(t)) falla(400, `Teléfono inválido en ${nombre}: ${t}. Usa el formato 4-4271684`); });
        const wa = String(a.whatsapp || '').replace(/\D/g, '');
        if (wa && !/^[67]\d{7}$/.test(wa)) falla(400, `WhatsApp inválido en ${nombre}`);
        return { nombre, tipo: a.tipo, direccion: cad(a.direccion, 200, `la dirección de ${nombre}`), telefonos: tels, whatsapp: wa };
      });
    }
    return out;
  }
  function validarProducto(p, existente) {
    if (!CIUDADES.slice(0, 2).includes(p.ciudad)) falla(400, 'El catálogo debe ser Cochabamba o Santa Cruz');
    const slug = existente ? existente.slug : cad(p.slug, 80, 'el identificador');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) falla(400, 'El identificador solo admite minúsculas, números y guiones');
    const sitio = leer('sitio.json'); const cats = sitio.categorias.map((c) => c.slug);
    const categorias = (Array.isArray(p.categorias) ? p.categorias : []).filter((c) => cats.includes(c));
    if (!categorias.length) falla(400, 'Elige al menos una categoría');
    const medidas = (Array.isArray(p.medidas) ? p.medidas : []).map((m) => {
      const v = Number(m && m[1]); const e = cad(m && m[0], 30, 'una medida');
      if (!Number.isFinite(v) || v <= 0 || v > 10000) falla(400, `Medida inválida: ${e}`);
      return [e, v];
    });
    const peso = p.peso === '' || p.peso == null ? null : Number(p.peso);
    if (peso != null && (!Number.isFinite(peso) || peso <= 0 || peso > 1000)) falla(400, 'Peso inválido');
    const imagenes = (Array.isArray(p.imagenes) ? p.imagenes : []).map((i) => String(i)).filter((i) => /^assets\/img\/(productos|subidas)\/[\w.-]+\.(jpg|jpeg|png|webp)$/i.test(i));
    return { ciudad: p.ciudad, slug, titulo: cad(p.titulo, 120, 'el nombre'), codigo: cad(p.codigo, 40, 'el código', false), linea: cad(p.linea, 60, 'la línea', false),
      descripcion: cad(p.descripcion, 600, 'la descripción', false), color: cad(p.color, 60, 'el color', false), acabado: cad(p.acabado, 200, 'el acabado', false),
      medidas, peso, rendimiento: cad(p.rendimiento, 200, 'el rendimiento', false), a_pedido: !!p.a_pedido, categorias, imagenes };
  }

  return {
    dir, reconstruir,
    leer: () => ({ sitio: leer('sitio.json'), productos: leer('productos.json') }),
    guardarSitio(parcial) {
      const s = leer('sitio.json');
      if (parcial.ciudades) s.ciudades = validarCiudades(parcial.ciudades);
      if (parcial.agencias) s.agencias = validarAgencias(parcial.agencias);
      if (parcial.correo != null) { const c = cad(parcial.correo, 120, 'el correo'); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c)) falla(400, 'Correo inválido'); s.correo = c; }
      if (parcial.servicio_cliente) {
        const tel = String(parcial.servicio_cliente.tel || '').replace(/\D/g, '');
        if (!/^\d{7,12}$/.test(tel)) falla(400, 'Teléfono de servicio al cliente inválido');
        s.servicio_cliente = { texto: cad(parcial.servicio_cliente.texto || tel, 30, 'el texto del teléfono'), tel };
      }
      if (parcial.redes) s.redes = { facebook: url(parcial.redes.facebook, 'Facebook'), instagram: url(parcial.redes.instagram, 'Instagram'), youtube: url(parcial.redes.youtube, 'YouTube') };
      escribir('sitio.json', s);
    },
    guardarProducto(ciudad, slug, datos) {
      const lista = leer('productos.json');
      const i = lista.findIndex((p) => p.ciudad === ciudad && p.slug === slug);
      if (i < 0) falla(404, 'No existe ese producto');
      lista[i] = validarProducto(Object.assign({}, datos, { ciudad }), lista[i]);
      escribir('productos.json', lista);
    },
    crearProducto(datos) {
      const lista = leer('productos.json'); const p = validarProducto(datos, null);
      if (lista.some((x) => x.ciudad === p.ciudad && x.slug === p.slug)) falla(409, 'Ya existe un producto con ese identificador en ese catálogo');
      lista.push(p); escribir('productos.json', lista); return p;
    },
    borrarProducto(ciudad, slug) {
      const lista = leer('productos.json'); const n = lista.filter((p) => !(p.ciudad === ciudad && p.slug === slug));
      if (n.length === lista.length) falla(404, 'No existe ese producto');
      escribir('productos.json', n);
    },
    historial: () => fs.readdirSync(path.join(dir, 'historial')).sort().reverse().slice(0, 60),
    restaurar(nombre) {
      if (!/^[\w.-]+-(sitio|productos)\.json$/.test(nombre)) falla(400, 'Versión inválida');
      const origen = path.join(dir, 'historial', nombre); if (!fs.existsSync(origen)) falla(404, 'No existe esa versión');
      const f = nombre.endsWith('-sitio.json') ? 'sitio.json' : 'productos.json';
      JSON.parse(fs.readFileSync(origen, 'utf8')); escribir(f, JSON.parse(fs.readFileSync(origen, 'utf8')));
    }
  };
}
module.exports = { crearContenido, CIUDADES };
