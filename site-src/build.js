#!/usr/bin/env node
/* Genera el sitio estático de INCERPAZ en /site a partir de /site-src/data.
   Uso: node site-src/build.js
   Los textos y datos viven en site-src/data (sitio.json y productos.json). Las páginas se
   generan completas en HTML para que carguen rápido en celular y las lea bien Google.
   site-src/config.json: "interno": true mantiene el sitio fuera de Google (noindex) hasta publicarlo.
   "comercio": true activa cuentas, precios con sesión y pedidos (necesita el servidor de /server). */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = process.env.SITE_OUT ? path.resolve(process.env.SITE_OUT) : path.join(ROOT, 'site');
/* CONTENT_DIR: carpeta con sitio.json y productos.json (el panel de administración los edita ahí). */
const DATA = process.env.CONTENT_DIR ? path.resolve(process.env.CONTENT_DIR) : path.join(__dirname, 'data');
const CATALOGO_OUT = process.env.CATALOGO_OUT ? path.resolve(process.env.CATALOGO_OUT) : path.join(ROOT, 'server/data/catalogo.json');
const sitio = JSON.parse(fs.readFileSync(path.join(DATA, 'sitio.json'), 'utf8'));
let productos = JSON.parse(fs.readFileSync(path.join(DATA, 'productos.json'), 'utf8'));
const config = Object.assign({ leadEndpoint: '', interno: true, comercio: true }, fs.existsSync(path.join(__dirname, 'config.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')) : {});

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (n) => Number(n).toLocaleString('es-BO', { maximumFractionDigits: 2 });
const waHref = (numero, msg) => `https://wa.me/591${numero}?text=${encodeURIComponent(msg)}`;
const telDisplay = (t) => t.replace(/^(\d)-(\d+)$/, '($1) $2');
const telHref = (t) => 'tel:+591' + t.replace(/\D/g, '');

/* ---- normalización de los datos del catálogo actual ---- */
const CIUDAD_CATALOGO = { cochabamba: 'Cochabamba', 'santa-cruz': 'Santa Cruz' };
const CAT_NOMBRE = Object.fromEntries(sitio.categorias.map((c) => [c.slug, c.nombre]));
const sentence = (s) => s.toLowerCase().replace(/^./, (c) => c.toUpperCase());
function bonito(nombre) {
  let s = sentence(nombre.replace(/\s+/g, ' ').replace(/\s+–\s+/g, ' ').trim());
  s = s.replace(/\bpavic\b/gi, 'PAVIC').replace(/\bxv\b/gi, 'XV').replace(/\bestandar\b/gi, 'estándar').replace(/\bceloc?ia\b/gi, 'celosía')
    .replace(/\beconomico\b/gi, 'económico').replace(/\brustico\b/gi, 'rústico').replace(/\bcaida\b/gi, 'caída').replace(/\bceramico\b/gi, 'cerámico')
    .replace(/\btrafico\b/gi, 'tráfico').replace(/\brapido\b/gi, 'rápido').replace(/\btrebol\b/gi, 'trébol').replace(/\bsuper\b/gi, 'súper')
    .replace(/(\d+)h\b/gi, '$1H').replace(/\( /g, '(').replace(/ \)/g, ')');
  return s;
}
/* Correcciones puntuales de datos que parecen errores del sitio actual (ver CONTENIDO-PENDIENTE.md) */
const CORRECCIONES = {
  'cochabamba:3-huecos-economico-rayado': { Ancho: 7 },
  'santa-cruz:6-huecos-big-rayado-mitad': { Largo: 12 }
};
const SIN_FICHA = new Set(['santa-cruz:teja-super-colonial-tapa-50']); /* su ficha repite los datos de la tapa */
const CAT_FORZADA = { 'brick-estandar-aligerado': 'muros', 'brick-estandar': 'muros', 'biscocho': 'refractarios', 'biscocho-213': 'refractarios', 'celosia': 'piezas-especiales', 'parasol': 'piezas-especiales' };
const PRIORIDAD = ['techos', 'refractarios', 'piezas-especiales', 'pisos-y-pavimentos', 'revestimientos-y-decorativos', 'muros'];
function categoriaPrincipal(p) {
  if (CAT_FORZADA[p.slug]) return CAT_FORZADA[p.slug];
  if (/punta-redonda/.test(p.slug)) return 'piezas-especiales';
  if (/enchape|gambote|decorativa|terminacion|cornisa/.test(p.slug)) return 'revestimientos-y-decorativos';
  if (/^(teja|tsc)/.test(p.slug)) return 'techos';
  return PRIORIDAD.find((c) => p.categorias.includes(c)) || p.categorias[0];
}
const ETQ = { 'Alto Sup': 'Alto superior', 'Alto Inf': 'Alto inferior', 'Ancho Sup': 'Ancho superior', 'Ancho Inf': 'Ancho inferior' };
productos = productos.map((p) => {
  const key = `${p.ciudad}:${p.slug}`;
  const corr = CORRECCIONES[key] || {};
  const sinFicha = SIN_FICHA.has(key);
  const medidas = sinFicha ? [] : p.medidas.map(([l, v]) => [ETQ[l] || l, corr[l] != null ? corr[l] : v]);
  const dim = (l) => (medidas.find((m) => m[0] === l) || [])[1];
  const variantes = [];
  if (!sinFicha && p.rendimiento) p.rendimiento.replace(/([\d.,]+)\s*pzas\/(m2|ml)\s*(?:\(([^)]*)\))?/gi, (_, n, u, etq) => {
    variantes.push({ rend: parseFloat(n.replace(',', '.')), unidad: u.toLowerCase(), etiqueta: etq ? sentence(etq.trim()) : '' });
    return '';
  });
  const linea = p.linea ? sentence(p.linea.replace(/VARIADADES/i, 'VARIEDADES').replace(/VARIEDAD(?!ES)/i, 'VARIEDADES').replace(/RUSTICO/i, 'RÚSTICO')) : '';
  return Object.assign({}, p, { nombre: bonito(p.titulo), linea, medidas, variantes, sinFicha, peso: sinFicha ? null : p.peso, cat: categoriaPrincipal(p), todas: p.categorias, largo: dim('Largo'), ancho: dim('Ancho'), alto: dim('Alto') });
});
/* catálogo confiable para el servidor: valida pedidos y presupuestos sin fiarse del navegador */
fs.mkdirSync(path.dirname(CATALOGO_OUT), { recursive: true });
fs.writeFileSync(CATALOGO_OUT, JSON.stringify(productos.map((p) => ({ ciudad: p.ciudad, slug: p.slug, codigo: p.codigo || null, nombre: p.nombre })), null, 1));
const pavic = productos.filter((p) => /pavic/i.test(p.linea) || /^pavic/.test(p.slug));
const purl = (p, base = '') => `${base}productos/${p.ciudad}/${p.slug}.html`;
const medidaTexto = (p) => (p.largo && p.ancho && p.alto) ? `${num(p.largo)} × ${num(p.ancho)} × ${num(p.alto)} cm` : (p.medidas.length ? p.medidas.slice(0, 2).map(([l, v]) => `${l.toLowerCase()} ${num(v)} cm`).join(' · ') : (p.codigo ? `Código ${p.codigo}` : ''));

/* ---- plantilla ---- */
const NAV = [
  ['catalogo.html', 'Productos'],
  ['proyectos.html', 'Proyectos'],
  ['guias.html', 'Guías'],
  ['pavic.html', 'PAVIC'],
  ['donde-estamos.html', 'Dónde estamos'],
  ['empresa.html', 'Empresa']
];
const ciudadDefecto = sitio.ciudades[0];
function layout({ file, base = '', title, desc, body, og = 'assets/img/productos/pavic-tabaco-2.jpg', jsonld = '', pagina = '' }) {
  const url = `${sitio.dominio}/${file === 'index.html' ? '' : file}`;
  const nav = NAV.map(([href, label]) => `<a href="${base}${href}"${file === href ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  const cfg = JSON.stringify({ ciudades: sitio.ciudades.map((c) => ({ slug: c.slug, nombre: c.nombre, whatsapp: c.whatsapp })), leadEndpoint: config.leadEndpoint || (config.comercio ? '/api/leads' : '') });
  return `<!doctype html>
<html lang="es-BO">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${config.interno || ['ingresar','registro','presupuesto','cuenta','equipo','admin'].includes(pagina) ? '<meta name="robots" content="noindex, nofollow">' : ''}
<link rel="canonical" href="${url}">
<meta property="og:type" content="website"><meta property="og:locale" content="es_BO"><meta property="og:site_name" content="INCERPAZ">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${sitio.dominio}/${og}">
<meta name="theme-color" content="#b5121b">
<link rel="icon" href="${base}assets/img/logo-icono.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;600&display=swap">
<link rel="stylesheet" href="${base}assets/css/site.css">
${jsonld}
</head>
<body data-base="${base}" data-pagina="${pagina}">
<a class="skip" href="#contenido">Saltar al contenido</a>
<div class="topbar"><div class="wrap">
  <span>Servicio al cliente <a href="tel:${sitio.servicio_cliente.tel}"><strong>${sitio.servicio_cliente.texto}</strong></a></span>
  <span>${config.comercio ? `<span data-acct><a href="${base}presupuesto.html">Presupuesto (<span data-bcount>0</span>)</a> · <a href="${base}ingresar.html">Ingresar</a></span> · ` : ''}<a href="${base}exportaciones.html">Exportaciones</a> · <a href="${sitio.enlaces_externos.promotores}" rel="noopener">Promotores</a></span>
</div></div>
<header class="site-header"><div class="wrap">
  <a class="brand" href="${base || './'}" aria-label="INCERPAZ, inicio"><img src="${base}assets/img/logo-header.png" alt="INCERPAZ" width="235" height="38"></a>
  <button class="nav-toggle" aria-expanded="false" aria-controls="nav" type="button">Menú</button>
  <nav class="nav" id="nav" aria-label="Principal">${nav}</nav>
  <div class="city"><label for="citySel" style="flex-direction:row;align-items:center;font-weight:500;white-space:nowrap">Tu ciudad</label><select id="citySel" aria-label="Tu ciudad"><option>${ciudadDefecto.nombre}</option></select></div>
</div></header>
<main id="contenido">
${body}
</main>
<footer class="site-footer"><div class="wrap">
  <div class="cols">
    <div><a class="brand" href="${base || './'}"><img src="${base}assets/img/logo-header.png" alt="INCERPAZ" width="210" height="34"></a>
      <p style="margin-top:14px;max-width:34ch">Cerámica para construir tu hogar. Fabricamos en Bolivia y atendemos desde Cochabamba, Santa Cruz, Oruro y Sucre.</p></div>
    <div><h4>Sitio</h4><ul>${NAV.map(([h, l]) => `<li><a href="${base}${h}">${l}</a></li>`).join('')}</ul></div>
    <div><h4>Contacto</h4><ul>
      <li><a href="tel:${sitio.servicio_cliente.tel}">Servicio al cliente ${sitio.servicio_cliente.texto}</a></li>
      <li><a href="mailto:${sitio.correo}">${sitio.correo}</a></li>
      <li><a href="${waHref(ciudadDefecto.whatsapp, 'Hola, quisiera más información, por favor.')}" data-wa="Hola, quisiera más información, por favor." rel="noopener">WhatsApp de tu ciudad</a></li></ul></div>
    <div><h4>Síguenos</h4><ul>
      <li><a href="${sitio.redes.facebook}" rel="noopener">Facebook</a></li>
      <li><a href="${sitio.redes.instagram}" rel="noopener">Instagram</a></li>
      <li><a href="${sitio.redes.youtube}" rel="noopener">YouTube</a></li></ul></div>
  </div>
  <div class="legal"><span>© ${new Date().getFullYear()} INCERPAZ. Todos los derechos reservados.</span><span>Bolivia</span></div>
</div></footer>
<a class="wa-float" href="${waHref(ciudadDefecto.whatsapp, 'Hola, quisiera más información, por favor.')}" data-wa="Hola, quisiera más información, por favor." rel="noopener">WhatsApp</a>
<script>window.INCERPAZ=${cfg};</script>
<script src="${base}assets/js/site.js" defer></script>
${config.comercio ? `<script src="${base}assets/js/comercio.js" defer></script>` : ''}
${pagina === 'pavic-recursos' ? `<script src="${base}assets/js/pavic.js" defer></script>` : ''}
${pagina === 'proyecto' ? `<script src="${base}assets/js/proyectos.js" defer></script>` : ''}
${config.comercio && pagina === 'admin' ? `<script src="${base}assets/js/admin.js" defer></script>` : ''}
</body>
</html>`;
}

const orgLd = `<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org', '@type': 'Organization', name: 'INCERPAZ', url: sitio.dominio,
  logo: `${sitio.dominio}/assets/img/logo-header.png`, sameAs: Object.values(sitio.redes),
  contactPoint: [{ '@type': 'ContactPoint', telephone: '+591-800-10-8810', contactType: 'customer service', areaServed: 'BO', availableLanguage: 'es' }]
})}</script>`;

/* ---- piezas reutilizables ---- */
function productCard(p, base = '') {
  const im = p.imagenes[0];
  return `<article class="pcard" data-ciudad="${p.ciudad}" data-cats="${p.todas.concat(p.cat).join(' ')}" data-name="${esc(p.nombre + ' ' + (p.codigo || ''))}">
  <a class="pcard-link" href="${purl(p, base)}">
  <div class="img">${im ? `<img src="${base}${im}" alt="${esc(p.nombre)}" loading="lazy" width="400" height="400">` : `<img src="${base}assets/img/logo-icono.png" alt="" style="width:40%;opacity:.25">`}</div>
  <div class="body"><span class="tag">${esc(CAT_NOMBRE[p.cat] || '')}</span><h3>${esc(p.nombre)}</h3><span class="meta">${esc(medidaTexto(p))}</span></div></a>
  ${config.comercio ? `<div class="pcard-buy"><span class="precio" data-precio data-ciudad="${p.ciudad}" data-slug="${p.slug}">Precio con sesión</span><button class="btn btn--sm" type="button" data-add data-ciudad="${p.ciudad}" data-slug="${p.slug}" data-nombre="${esc(p.nombre)}" data-codigo="${esc(p.codigo || '')}">Añadir</button></div>` : ''}</article>`;
}
function calcOptions(list) {
  const grupos = {};
  list.forEach((p) => { const v = p.variantes[0]; if (v) (grupos[p.ciudad] = grupos[p.ciudad] || []).push(`<option data-rend="${v.rend}" data-peso="${p.peso || 0}" data-unidad="${v.unidad}" data-nombre="${esc(p.nombre)}">${esc(p.nombre)}</option>`); });
  return Object.keys(grupos).map((c) => `<optgroup label="Catálogo de ${CIUDAD_CATALOGO[c]}" data-ciudad="${c}">${grupos[c].join('')}</optgroup>`).join('');
}
function calcBox({ options, idp = 'c', waText, noteExtra = '', addBtn = '' }) {
  return `<div class="calc" data-calc>
  <div class="fields">
    <label class="full">Producto<select data-calc-prod name="${idp}prod">${options}</select></label>
    <label><span data-calc-unit>Superficie (m²)</span><input data-calc-area type="number" inputmode="decimal" min="0" step="any" value="20"></label>
    <label>Merma<select data-calc-merma><option value="0.05">5 %</option><option value="0.08" selected>8 %</option><option value="0.1">10 %</option></select></label>
    <p class="full muted" style="font-size:15px">La merma cubre cortes y roturas. El resultado es una estimación para pedir tu cotización.${noteExtra}</p>
  </div>
  <div class="calc-out">
    <div><span class="num" data-out="pzas">0</span><small>piezas</small></div>
    <div class="pair"><div><span class="num" style="font-size:36px" data-out="kg">0</span><small>kg aprox.</small></div><div><span class="num" style="font-size:36px" data-out="ton">0</span><small>toneladas</small></div></div>
    <a class="btn btn--wa" data-calc-wa data-wa="${esc(waText)}" href="${waHref(ciudadDefecto.whatsapp, waText)}" rel="noopener">Cotizar por WhatsApp</a>
    ${addBtn}
  </div>
</div>`;
}
function leadForm({ asunto, campos, boton, waNum = '' }) {
  return `<div class="form-box"><form data-lead="${esc(asunto)}" ${waNum ? `data-wa-num="${waNum}"` : ''}>
  <div class="form-grid">${campos}</div>
  <div class="hp" aria-hidden="true"><label>No llenar<input type="text" name="web" tabindex="-1" autocomplete="off"></label></div>
  <div class="btn-row" style="margin-top:18px"><button class="btn btn--red" type="submit">${esc(boton)}</button></div>
</form><p class="form-msg" role="status" hidden style="margin-top:16px"></p></div>`;
}
const field = (label, name, extra = '', cls = '') => `<label class="${cls}">${label}<input name="${name}" ${extra}></label>`;
const selectCities = (name = 'ciudad') => `<label>Ciudad<select name="${name}">${sitio.ciudades.map((c) => `<option>${c.nombre}</option>`).join('')}<option>Otra ciudad</option></select></label>`;

function write(file, html) {
  const p = path.join(OUT, file);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, html);
}
/* borra las páginas de producto anteriores para no dejar archivos huérfanos */
fs.rmSync(path.join(OUT, 'productos'), { recursive: true, force: true });

/* ============================ HOME ============================ */
const mosaico = ['18-h', 'brick-enchape-corto', '9-huecos-economico-rayado', 'brick-estandar', 'pavic-peatonal', 'biscocho']
  .map((s) => `assets/img/productos/${s}-2.jpg`);
write('index.html', layout({
  file: 'index.html',
  title: 'INCERPAZ | Cerámica para construir tu hogar',
  desc: 'Ladrillos, pisos, techos, revestimientos y pavimentos cerámicos fabricados en Bolivia. Calcula tus piezas, encuentra tu agencia y cotiza por WhatsApp en Cochabamba, Santa Cruz, Oruro y Sucre.',
  jsonld: orgLd,
  body: `
<section class="hero"><div class="wrap">
  <div>
    <span class="eyebrow">Cerámica industrial boliviana</span>
    <h1>Cerámica para construir <em>tu hogar</em></h1>
    <p class="lead">Ladrillos, techos, revestimientos y pavimentos fabricados en Bolivia. Calcula cuántas piezas necesitas y cotiza con una agencia de tu ciudad.</p>
    <div class="btn-row"><a class="btn btn--red" href="catalogo.html">Ver productos</a><a class="btn btn--wa" data-wa="Hola, quisiera cotizar en {ciudad}." href="${waHref(ciudadDefecto.whatsapp, 'Hola, quisiera cotizar en Cochabamba.')}" rel="noopener">Cotizar por WhatsApp</a></div>
  </div>
  <div class="mosaic" aria-hidden="true">${mosaico.map((m) => `<img src="${m}" alt="" loading="eager" width="400" height="400">`).join('')}</div>
</div></section>

<section class="wrap" style="padding-bottom:8px"><div class="quick">
  <a href="#calculadora"><b>Calcula tus piezas</b><span>Cuántas necesitas por m²</span></a>
  <a href="catalogo.html"><b>Catálogo</b><span>Fichas con medidas y rendimiento</span></a>
  <a href="proyectos.html"><b>Proyectos</b><span>Churrasquero, mesón, pared con enchape</span></a>
  <a href="donde-estamos.html"><b>Dónde comprar</b><span>Agencias y WhatsApp por ciudad</span></a>
  <a href="pavic.html"><b>PAVIC</b><span>Pavimentos para proyectos</span></a>
</div></section>

<section class="section"><div class="wrap">
  <div class="section-head"><span class="eyebrow">Productos</span><h2>Todo para levantar y terminar tu obra</h2></div>
  <div class="cats">${sitio.categorias.map((c) => `<a class="cat" href="catalogo.html?cat=${c.slug}"><img src="${c.imagen}" alt="" loading="lazy" width="600" height="400"><div><h3>${esc(c.nombre)}</h3><span>${esc(c.descripcion)}</span></div></a>`).join('')}</div>
</div></section>

<section class="section dark pavic-band"><div class="wrap">
  <img src="assets/img/productos/pavic-peatonal-2.jpg" alt="Plaza con pavimento cerámico PAVIC" loading="lazy" width="800" height="600">
  <div>
    <span class="eyebrow">Marca PAVIC</span>
    <h2>Pavimento cerámico para proyectos grandes</h2>
    <p class="lead">Calles, plazas, veredas y urbanizaciones. Cotiza tu obra, calcula el material y solicita certificados y ensayos de calidad.</p>
    <ul><li>Fabricado en Santa Cruz, Cochabamba y Oruro</li><li>Certificados de calidad, ensayos de laboratorio y certificación ISO</li><li>Atención para constructoras, entidades públicas y proyectistas</li></ul>
    <a class="btn btn--red" href="pavic.html">Conocer PAVIC</a>
  </div>
</div></section>

<section class="section" id="calculadora"><div class="wrap">
  <div class="section-head"><span class="eyebrow">Herramienta</span><h2>Calcula cuántas piezas necesitas</h2><p class="lead">Elige el producto y la superficie. Usamos el rendimiento por m² de cada ficha técnica.</p></div>
  ${calcBox({ options: calcOptions(productos), waText: 'Hola, quiero cotizar en {ciudad}.' })}
</div></section>

<section class="section section--grey"><div class="wrap">
  <div class="section-head"><div class="row"><div><span class="eyebrow">Dónde estamos</span><h2 style="margin-top:12px">Una agencia cerca de tu obra</h2></div><a class="btn" href="donde-estamos.html">Ver todas las agencias</a></div></div>
  <div class="three" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">${sitio.ciudades.map((c) => {
    const l = sitio.agencias[c.slug]; const ag = l.filter((a) => a.tipo === 'agencia').length;
    return `<div><h3>${c.nombre}</h3><p class="muted">${ag} ${ag === 1 ? 'agencia' : 'agencias'} y fábrica</p><a class="btn btn--sm btn--wa" href="${waHref(c.whatsapp, `Hola, quisiera información en ${c.nombre}.`)}" rel="noopener">WhatsApp</a> <a class="btn btn--sm" href="donde-estamos.html#${c.slug}">Ver</a></div>`;
  }).join('')}</div>
</div></section>

<section class="section"><div class="wrap split">
  <div><span class="eyebrow">Empresa</span><h2 style="margin-block:12px 18px">Calidad que se construye todos los días</h2><p class="lead">${esc(sitio.somos)}</p><div class="btn-row" style="margin-top:24px"><a class="btn" href="empresa.html">Conocer INCERPAZ</a></div></div>
  <div class="values" style="margin-top:8px">${sitio.valores.map((v) => `<span>${v}</span>`).join('')}</div>
</div></section>`
}));

/* ============================ CATÁLOGO ============================ */
write('catalogo.html', layout({
  file: 'catalogo.html',
  title: 'Productos | INCERPAZ',
  desc: 'Catálogo de ladrillos, techos, revestimientos, pisos y piezas especiales de INCERPAZ, con dimensiones, peso y rendimiento por m². Catálogos de Cochabamba y Santa Cruz.',
  body: `
<section class="section" style="padding-bottom:24px"><div class="wrap">
  <span class="eyebrow">Catálogo</span><h1 style="font-size:clamp(40px,6vw,72px);margin-block:12px 14px">Productos</h1>
  <p class="lead">Cada producto tiene sus dimensiones, peso y rendimiento. Los precios los confirma la agencia de tu ciudad por WhatsApp.</p>
</div></section>
<section class="wrap" style="padding-bottom:72px">
  <div class="filters">
    <div><span class="mono-label">Catálogo de</span><div class="chips" role="group" aria-label="Catálogo por ciudad">${Object.entries(CIUDAD_CATALOGO).map(([s, n]) => `<button class="chip" data-catalogo="${s}" type="button" aria-pressed="false">${n}</button>`).join('')}</div></div>
    <div style="flex:1 1 100%"><span class="mono-label">Categoría</span><div class="chips" role="group" aria-label="Categorías"><button class="chip" data-cat="todas" type="button" aria-pressed="true">Todas</button>${sitio.categorias.map((c) => `<button class="chip" data-cat="${c.slug}" type="button" aria-pressed="false">${esc(c.nombre)}</button>`).join('')}</div></div>
    <label class="search">Buscar<input id="q" type="search" placeholder="Ej. 6 huecos, enchape, teja" autocomplete="off"></label>
    <span id="count" class="muted" aria-live="polite"></span>
  </div>
  <p class="price-note" id="catNota" hidden></p>
  <div class="grid-products" id="grid">${productos.map((p) => productCard(p)).join('')}</div>
  <div class="empty" id="empty" hidden><b>No encontramos ese producto en este catálogo.</b><p class="muted" style="margin-top:6px">Prueba otra palabra, cambia de catálogo o escríbenos por WhatsApp y te ayudamos.</p><div class="btn-row" style="margin-top:14px"><a class="btn btn--wa" data-wa="Hola, busco un producto que no encuentro en el catálogo. Estoy en {ciudad}." href="${waHref(ciudadDefecto.whatsapp, 'Hola, busco un producto que no encuentro en el catálogo.')}" rel="noopener">Escribir por WhatsApp</a></div></div>
</section>`
}));

/* ============================ PRODUCTOS ============================ */
for (const p of productos) {
  const rel = productos.filter((q) => q.ciudad === p.ciudad && q.cat === p.cat && q.slug !== p.slug).slice(0, 4);
  const otra = productos.find((q) => q.ciudad !== p.ciudad && q.codigo && q.codigo === p.codigo);
  const rows = [
    p.codigo && ['Código', p.codigo], p.linea && ['Línea', p.linea], p.color && ['Color', p.color], p.acabado && ['Acabado', p.acabado],
    ...p.medidas.map(([l, v]) => [l, `${num(v)} cm`]), p.peso && ['Peso', `${num(p.peso)} kg`],
    p.variantes.length && ['Rendimiento', p.variantes.map((v) => `${num(v.rend)} piezas por ${v.unidad === 'ml' ? 'metro lineal' : 'm²'}${v.etiqueta ? ` (${v.etiqueta.toLowerCase()})` : ''}`).join('<br>')]
  ].filter(Boolean);
  const imgs = p.imagenes;
  const opts = p.variantes.map((v) => `<option data-rend="${v.rend}" data-peso="${p.peso || 0}" data-unidad="${v.unidad}" data-nombre="${esc(p.nombre)}">${num(v.rend)} piezas por ${v.unidad === 'ml' ? 'ml' : 'm²'}${v.etiqueta ? ` · ${esc(v.etiqueta.toLowerCase())}` : ''}</option>`).join('');
  const ld = `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name: p.nombre, description: p.descripcion || p.nombre, sku: p.codigo || undefined, brand: { '@type': 'Brand', name: /pavic/i.test(p.linea) ? 'PAVIC' : 'INCERPAZ' }, image: imgs.map((i) => `${sitio.dominio}/${i}`) })}</script>`;
  const waText = `Hola, quiero cotizar ${p.nombre}${p.codigo ? ` (código ${p.codigo})` : ''} en {ciudad}.`;
  const base = '../../';
  write(`productos/${p.ciudad}/${p.slug}.html`, layout({
    file: `productos/${p.ciudad}/${p.slug}.html`, base,
    title: `${p.nombre} | INCERPAZ`,
    desc: `${p.nombre}${p.descripcion ? ': ' + p.descripcion.replace(/\.$/, '') + '.' : ''} Dimensiones, peso y rendimiento. Cotiza por WhatsApp en tu ciudad.`,
    og: imgs[0] || 'assets/img/logo-header.png', jsonld: ld,
    body: `
<div class="wrap"><nav class="crumbs" aria-label="Ruta"><a href="${base}index.html">Inicio</a> › <a href="${base}catalogo.html?ciudad=${p.ciudad}">Productos</a> › <a href="${base}catalogo.html?ciudad=${p.ciudad}&amp;cat=${p.cat}">${esc(CAT_NOMBRE[p.cat] || '')}</a> › ${esc(p.nombre)}</nav></div>
<section class="wrap" style="padding-bottom:64px"><div class="prod">
  <div class="gallery">
    <div class="main">${imgs[0] ? `<img id="mainImg" src="${base}${imgs[0]}" alt="${esc(p.nombre)}" width="800" height="800">` : `<img id="mainImg" src="${base}assets/img/logo-icono.png" alt="" style="width:30%;opacity:.25">`}</div>
    ${imgs.length > 1 ? `<div class="thumbs">${imgs.map((im, i) => `<button type="button" data-thumb="${base}${im}" aria-pressed="${i === 0}" aria-label="Ver imagen ${i + 1}"><img src="${base}${im}" alt="" width="84" height="84"></button>`).join('')}</div>` : ''}
  </div>
  <div>
    <div class="btn-row" style="gap:8px"><span class="tag">${esc(CAT_NOMBRE[p.cat] || '')}</span><span class="tag">Catálogo de ${CIUDAD_CATALOGO[p.ciudad]}</span>${p.a_pedido ? '<span class="tag" style="background:var(--yellow)">Producto a pedido</span>' : ''}</div>
    <h1>${esc(p.nombre)}</h1>
    ${p.descripcion ? `<p class="lead">${esc(p.descripcion)}</p>` : ''}
    ${rows.length ? `<table class="specs"><tbody>${rows.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${/<br>/.test(v) ? v : esc(v)}</td></tr>`).join('')}</tbody></table>` : `<p class="price-note">Las medidas de este producto las confirma la agencia. Escríbenos y te las enviamos.</p>`}
    ${otra ? `<p class="muted" style="font-size:15px">Este producto también está en el <a href="${base}${purl(otra)}">catálogo de ${CIUDAD_CATALOGO[otra.ciudad]}</a>. Las medidas pueden variar según la fábrica.</p>` : ''}
    ${config.comercio ? `<div class="buy-box"><p class="precio-big" data-precio data-ciudad="${p.ciudad}" data-slug="${p.slug}">Precio con sesión</p>
      <div class="buy-row"><label>Cantidad (piezas)<input id="qty" type="number" min="1" step="1" value="100"></label><button class="btn btn--red" type="button" data-add data-qty-from="#qty" data-ciudad="${p.ciudad}" data-slug="${p.slug}" data-nombre="${esc(p.nombre)}" data-codigo="${esc(p.codigo || '')}">Añadir al presupuesto</button></div>
      <p class="muted" style="font-size:15px;margin-top:10px">Los precios se ven con una cuenta verificada. Para obras grandes, cotiza por WhatsApp.</p></div>` : `<p class="price-note"><strong>Precio:</strong> lo confirma la agencia de tu ciudad según tu obra y la cantidad. Escríbenos y te cotizamos.</p>`}
    <div class="btn-row"><a class="btn btn--wa" data-wa="${esc(waText)}" href="${waHref(ciudadDefecto.whatsapp, waText.replace('{ciudad}', ciudadDefecto.nombre))}" rel="noopener">Cotizar por WhatsApp</a><a class="btn" href="${base}donde-estamos.html">Dónde comprar</a></div>
  </div>
</div></section>
${p.variantes.length ? `<section class="section section--grey"><div class="wrap"><div class="section-head"><h2>Calcula cuántas piezas necesitas</h2></div>
${calcBox({ options: opts, idp: 'p', waText, addBtn: config.comercio ? `<button class="btn" type="button" data-calc-add data-ciudad="${p.ciudad}" data-slug="${p.slug}" data-nombre="${esc(p.nombre)}" data-codigo="${esc(p.codigo || '')}">Añadir al presupuesto</button>` : '' })}</div></section>` : ''}
${rel.length ? `<section class="section"><div class="wrap"><div class="section-head"><h2>Productos relacionados</h2></div><div class="grid-products">${rel.map((q) => productCard(q, base)).join('')}</div></div></section>` : ''}`
  }));
}

/* ============================ PAVIC ============================ */
const fotosPavic = ['pavic-estandar', 'pavic-peatonal', 'pavic-tabaco'].map((s) => `assets/img/productos/${s}-2.jpg`);
write('pavic.html', layout({
  file: 'pavic.html',
  title: 'PAVIC | Pavimento cerámico para proyectos | INCERPAZ',
  desc: 'PAVIC es el pavimento cerámico de INCERPAZ para calles, plazas, veredas y urbanizaciones. Calcula el material, solicita certificados y ensayos de calidad, y cotiza tu proyecto.',
  og: 'assets/img/productos/pavic-tabaco-2.jpg',
  body: `
<section class="pavic-hero"><img src="assets/img/productos/pavic-tabaco-2.jpg" alt="" width="800" height="800">
<div class="wrap"><span class="badge">PAVIC</span><h1>Pavimento cerámico para proyectos</h1>
  <p class="lead" style="color:#e6e1db">Calles, plazas, veredas y urbanizaciones. Una marca de INCERPAZ con certificados de calidad, ensayos de laboratorio y certificación ISO.</p>
  <div class="btn-row"><a class="btn btn--red" href="#cotizar">Cotizar mi proyecto</a><a class="btn btn--ghost" style="color:#fff" href="#calidad">Solicitar documentación técnica</a><a class="btn btn--ghost" style="color:#fff" href="pavic-recursos.html">Recursos para proyectistas</a></div></div></section>

<section class="section"><div class="wrap">
  <div class="section-head"><span class="eyebrow">Para quién</span><h2>Hecho para obras que se miden en miles de metros</h2></div>
  <div class="three">
    <div><h3>Constructoras y obras privadas</h3><p class="muted">Urbanizaciones, condominios y proyectos comerciales que necesitan volumen y plazos claros.</p></div>
    <div><h3>Entidades públicas</h3><p class="muted">Plazas, calles peatonales y espacios públicos, con documentación técnica para licitaciones.</p></div>
    <div><h3>Proyectistas y arquitectos</h3><p class="muted">Datos de producto y asesoría para especificar PAVIC en tu diseño.</p></div>
  </div>
</div></section>

<section class="section section--grey" id="productos"><div class="wrap">
  <div class="section-head"><span class="eyebrow">Productos PAVIC</span><h2>Líneas de pavimento</h2><p class="lead">Cada fábrica publica sus propias medidas y pesos. Elige el catálogo de tu ciudad.</p></div>
  ${Object.entries(CIUDAD_CATALOGO).map(([c, n]) => `<h3 style="margin:8px 0 14px">Catálogo de ${n}</h3><div class="grid-products" style="margin-bottom:32px">${pavic.filter((p) => p.ciudad === c).map((p) => productCard(p)).join('')}</div>`).join('')}
</div></section>

<section class="section" id="calculadora"><div class="wrap">
  <div class="section-head"><span class="eyebrow">Herramienta</span><h2>Calculadora de obra</h2><p class="lead">Estima las piezas y el peso para tu proyecto. Para volumen y plazos, el precio final sale por cotización.</p></div>
  ${calcBox({ options: calcOptions(pavic), idp: 'v', waText: 'Hola, quiero cotizar un proyecto con PAVIC en {ciudad}.', noteExtra: ' Para obras grandes, pide tu cotización con ejecutivo de proyectos.' })}
</div></section>

<section class="section dark" id="calidad"><div class="wrap split">
  <div><span class="eyebrow">Calidad y documentación</span><h2 style="margin-block:12px 18px">Respaldo técnico para tu licitación</h2>
    <p class="lead">PAVIC cuenta con certificados de calidad, ensayos de laboratorio y certificación ISO. Solicita la documentación y un ejecutivo te la envía.</p></div>
  <div>${leadForm({ asunto: 'Solicitud de documentación técnica PAVIC', boton: 'Solicitar documentación', campos:
    field('Nombre', 'nombre', 'required autocomplete="name"') + field('Empresa o entidad', 'empresa', 'required autocomplete="organization"') + field('Correo', 'correo', 'type="email" required autocomplete="email"') + field('Celular', 'celular', 'type="tel" required autocomplete="tel"') +
    `<label class="full">¿Qué necesitas?<select name="documentos"><option>Certificados de calidad</option><option>Ensayos de laboratorio</option><option>Certificación ISO</option><option>Todo lo anterior</option></select></label>` })}</div>
</div></section>

<section class="section"><div class="wrap">
  <div class="section-head"><span class="eyebrow">PAVIC en obra</span><h2>Así se ve instalado</h2></div>
  <div class="photos">${fotosPavic.map((f) => `<img src="${f}" alt="Pavimento cerámico PAVIC instalado" loading="lazy" width="800" height="600">`).join('')}</div>
</div></section>

<section class="section section--grey" id="cotizar"><div class="wrap split">
  <div><span class="eyebrow">Cotiza tu proyecto</span><h2 style="margin-block:12px 18px">Cuéntanos de tu obra</h2>
    <p class="lead">Con estos datos un ejecutivo de tu ciudad prepara una cotización por volumen y plazo.</p>
    <h3 style="margin-top:32px">Dónde comprar PAVIC</h3>
    <p class="muted" style="margin-top:8px">Fabricado en Santa Cruz y Cochabamba, y en nuestra planta de Oruro. Atendemos desde las agencias de Cochabamba, Santa Cruz, Oruro y Sucre, y con un punto de venta especializado en La Paz. <a href="donde-estamos.html">Ver agencias</a></p></div>
  <div>${leadForm({ asunto: 'Cotización de proyecto PAVIC', boton: 'Pedir cotización', campos:
    field('Nombre', 'nombre', 'required autocomplete="name"') + field('Empresa o entidad', 'empresa', 'required autocomplete="organization"') +
    `<label>Tipo de obra<select name="tipo"><option>Privada</option><option>Estatal</option></select></label>` + selectCities('ciudad') +
    field('Superficie aproximada (m²)', 'superficie', 'inputmode="decimal"') + field('Inicio de obra', 'inicio', 'placeholder="Mes y año"') + field('Celular', 'celular', 'type="tel" required autocomplete="tel"') + field('Correo', 'correo', 'type="email" autocomplete="email"') })}</div>
</div></section>`
}));

/* ============================ PAVIC: recursos técnicos para proyectistas ============================ */
const DOCS_PAVIC = [
  { t: 'Certificados de calidad', d: 'Certificados vigentes de las líneas PAVIC, para licitaciones y fiscalización.', estado: 'solicitud' },
  { t: 'Ensayos de laboratorio', d: 'Informes de ensayos de las piezas PAVIC emitidos por laboratorio.', estado: 'solicitud' },
  { t: 'Certificación ISO', d: 'Alcance y vigencia de la certificación ISO de INCERPAZ.', estado: 'solicitud' },
  { t: 'Fichas técnicas', d: 'Medidas, peso y rendimiento de cada pieza, por catálogo de fábrica.', estado: 'aqui', href: 'pavic.html#productos' },
  { t: 'Texto para pliegos', d: 'Especificación de la pieza lista para copiar a tu pliego o memoria.', estado: 'aqui', href: '#pliego' },
  { t: 'Detalle en DXF', d: 'Planta y elevación de la pieza a escala real para tu plano en CAD.', estado: 'aqui', href: '#dxf' }
];
const piezasPavic = pavic.map((p) => {
  const v = p.variantes.find((x) => x.unidad === 'm2') || null;
  return { ciudad: p.ciudad, slug: p.slug, nombre: p.nombre, codigo: p.codigo || '', linea: p.linea, color: p.color || '', descripcion: p.descripcion || '', alto: p.alto, largo: p.largo, ancho: p.ancho, peso: p.peso,
    variantes: p.variantes.filter((x) => x.unidad === 'm2').map((x) => ({ rend: x.rend, etiqueta: x.etiqueta })), m2: !!v };
});
write('pavic-recursos.html', layout({
  file: 'pavic-recursos.html', pagina: 'pavic-recursos', title: 'Recursos técnicos PAVIC para proyectistas | INCERPAZ',
  desc: 'Calculadora de obra, detalle en sección, texto para pliegos, DXF y documentación técnica del pavimento cerámico PAVIC para proyectistas, constructoras y entidades.',
  og: 'assets/img/productos/pavic-peatonal-2.jpg',
  body: `<div class="wrap"><nav class="crumbs" aria-label="Ruta"><a href="index.html">Inicio</a> › <a href="pavic.html">PAVIC</a> › Recursos técnicos</nav></div>
<section class="section" style="padding-top:12px"><div class="wrap">
  <span class="eyebrow">PAVIC · Para proyectistas</span><h1 style="font-size:clamp(36px,5vw,60px);margin-block:12px 12px">Recursos técnicos</h1>
  <p class="lead">Herramientas y documentación para especificar, calcular y licitar obras con pavimento cerámico PAVIC. Cada fábrica (Santa Cruz y Cochabamba) tiene sus propias medidas: elige la tuya.</p>
</div></section>

<section class="section section--grey"><div class="wrap">
  <div class="section-head"><span class="eyebrow">1 · Pieza</span><h2>Ficha de la pieza</h2></div>
  <div class="calc" style="display:block"><div class="fields">
    <label>Catálogo de fábrica<select id="pv-ciudad"><option value="cochabamba">Cochabamba</option><option value="santa-cruz">Santa Cruz</option></select></label>
    <label>Pieza<select id="pv-pieza"></select></label>
  </div></div>
  <div id="pv-ficha" style="margin-top:20px"></div>
</div></section>

<section class="section"><div class="wrap">
  <div class="section-head"><span class="eyebrow">2 · Cantidades</span><h2>Calculadora de obra</h2><p class="lead">Piezas, peso y volúmenes de base y cama de arena para tu superficie. Ajusta los espesores a tu diseño y estudio de suelos.</p></div>
  <div class="proy">
    <div class="calc" style="display:block"><div class="fields">
      <label class="full">Superficie (m²)<input id="pv-area" type="number" inputmode="decimal" min="1" step="any" value="1000"></label>
      <label class="full">Aparejo o disposición<select id="pv-var"></select></label>
      <label>Merma<select id="pv-merma"><option value="0.03">3 %</option><option value="0.05" selected>5 %</option><option value="0.08">8 %</option></select></label>
      <label>Espesor de la base (cm)<input id="pv-base" type="number" inputmode="decimal" min="0" step="1" value="15"></label>
      <label>Espesor de la cama de arena (cm)<input id="pv-cama" type="number" inputmode="decimal" min="0" step="0.5" value="4"></label>
    </div><p class="muted" style="font-size:15px;margin-top:14px">Los espesores son valores de partida editables, no una recomendación de diseño.</p></div>
    <figure class="plano" id="pv-seccion" aria-label="Sección típica del pavimento"></figure>
  </div>
  <div id="pv-resultado" style="margin-top:24px"></div>
  <div class="btn-row" style="margin-top:20px" id="pv-acciones"></div>
</div></section>

<section class="section section--grey" id="pliego"><div class="wrap split">
  <div><span class="eyebrow">3 · Pliegos</span><h2 style="margin-block:12px 18px">Texto para pliegos y memorias</h2>
    <p class="lead">Descripción de la pieza con los datos publicados de la ficha. Los valores de ensayo se adjuntan con los certificados que solicites.</p>
    <div class="btn-row" style="margin-top:20px"><button class="btn" type="button" id="pv-copiar">Copiar texto</button><button class="btn" type="button" id="pv-txt">Descargar .txt</button></div></div>
  <div><textarea id="pv-pliego" rows="12" readonly style="width:100%;font:15px/1.5 var(--body);padding:14px;border:2px solid var(--ink);background:var(--white)"></textarea></div>
</div></section>

<section class="section" id="dxf"><div class="wrap split">
  <div><span class="eyebrow">4 · CAD</span><h2 style="margin-block:12px 18px">Detalle de la pieza en DXF</h2>
    <p class="lead">Planta y elevación de la pieza elegida a escala real, en centímetros, para insertar en tu plano.</p>
    <div class="btn-row" style="margin-top:20px"><button class="btn btn--red" type="button" id="pv-dxf">Descargar DXF</button></div></div>
  <div><figure class="plano" id="pv-pieza-svg" aria-label="Planta y elevación de la pieza"></figure></div>
</div></section>

<section class="section section--grey" id="documentos"><div class="wrap">
  <div class="section-head"><span class="eyebrow">5 · Documentación</span><h2>Certificados, ensayos e ISO</h2><p class="lead">Respaldo técnico para licitaciones y fiscalización. Un ejecutivo de proyectos te lo envía.</p></div>
  <div class="three" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">${DOCS_PAVIC.map((d) => `<div><h3>${esc(d.t)}</h3><p class="muted" style="margin:8px 0 12px">${esc(d.d)}</p>${d.estado === 'aqui' ? `<a class="btn btn--sm" href="${d.href}">Disponible aquí</a>` : `<button class="btn btn--sm btn--wa" type="button" data-doc="${esc(d.t)}">Solicitar</button>`}</div>`).join('')}</div>
</div></section>

<section class="section dark" id="solicitar"><div class="wrap split">
  <div><span class="eyebrow">Solicitud</span><h2 style="margin-block:12px 18px">Pide la documentación de tu proyecto</h2><p class="lead">Cuéntanos qué necesitas y para qué obra. Te respondemos desde el equipo de proyectos.</p></div>
  <div>${leadForm({ asunto: 'Solicitud de documentación técnica PAVIC', boton: 'Solicitar documentación', campos:
    field('Nombre', 'nombre', 'required autocomplete="name"') + field('Empresa o entidad', 'empresa', 'required autocomplete="organization"') + field('Correo', 'correo', 'type="email" required autocomplete="email"') + field('Celular', 'celular', 'type="tel" required autocomplete="tel"') +
    `<label class="full">Documentos<select name="documentos" id="pv-docsel"><option>Todo lo anterior</option>${DOCS_PAVIC.filter((d) => d.estado === 'solicitud').map((d) => `<option>${esc(d.t)}</option>`).join('')}</select></label>` + selectCities('ciudad') + field('Obra o licitación', 'obra', '', 'full') })}</div>
</div></section>
<script type="application/json" id="datos-pavic">${JSON.stringify({ piezas: piezasPavic, ciudades: sitio.ciudades.map((c) => ({ slug: c.slug, nombre: c.nombre, whatsapp: c.whatsapp })) }).replace(/</g, '\\u003c')}</script>`
}));

/* ============================ DÓNDE ESTAMOS ============================ */
function agencyCard(a, ciudad) {
  const msg = `Hola, quisiera información de la ${a.tipo === 'fabrica' ? 'fábrica' : 'agencia'} ${a.nombre} de ${ciudad.nombre}.`;
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${a.direccion}, ${ciudad.nombre}, Bolivia`)}`;
  return `<article class="agency"><span class="tag">${a.tipo === 'fabrica' ? 'Fábrica' : 'Agencia'}</span><h3>${esc(a.nombre)}</h3><address>${esc(a.direccion)}</address>
  ${a.telefonos.length ? `<div class="tels">${a.telefonos.map((t) => `<a href="${telHref(t)}">${telDisplay(t)}</a>`).join('')}</div>` : ''}
  <div class="btn-row" style="margin-top:auto;padding-top:6px">${a.whatsapp ? `<a class="btn btn--sm btn--wa" data-wa="${esc(msg)}" data-wa-num="${a.whatsapp}" href="${waHref(a.whatsapp, msg)}" rel="noopener">WhatsApp</a>` : ''}<a class="btn btn--sm" href="${maps}" rel="noopener" target="_blank">Cómo llegar</a></div></article>`;
}
const tabs = [...sitio.ciudades.map((c) => [c.slug, c.nombre]), ['la-paz', 'La Paz'], ['otra-ciudad', 'Otra ciudad']];
write('donde-estamos.html', layout({
  file: 'donde-estamos.html',
  title: 'Dónde estamos | Agencias y fábricas | INCERPAZ',
  desc: 'Encuentra la agencia INCERPAZ más cercana en Cochabamba, Santa Cruz, Oruro y Sucre, con dirección, teléfono, WhatsApp y cómo llegar.',
  body: `
<section class="section" style="padding-bottom:24px"><div class="wrap">
  <span class="eyebrow">Dónde estamos</span><h1 style="font-size:clamp(40px,6vw,72px);margin-block:12px 14px">Agencias y fábricas</h1>
  <p class="lead">Elige tu ciudad y escribe por WhatsApp a la agencia más cercana a tu obra.</p>
</div></section>
<section class="wrap" style="padding-bottom:80px">
  <div class="city-tabs" role="group" aria-label="Ciudad">${tabs.map(([s, n], i) => `<button class="chip" type="button" data-city-tab="${s}" aria-pressed="${i === 0}">${n}</button>`).join('')}</div>
  ${sitio.ciudades.map((c, i) => `<div class="panel" data-city-panel="${c.slug}" id="${c.slug}"${i ? ' hidden' : ''}><div class="agencies">${sitio.agencias[c.slug].map((a) => agencyCard(a, c)).join('')}</div></div>`).join('')}
  <div class="panel" data-city-panel="la-paz" id="la-paz" hidden><div class="agencies"><article class="agency"><span class="tag">Punto de venta PAVIC</span><h3>La Paz</h3><p class="muted">Contamos con un punto de venta especializado en PAVIC, abastecido desde nuestra planta de Oruro. Escríbenos y te indicamos cómo llegar y cómo cotizar tu proyecto.</p><div class="btn-row" style="margin-top:auto"><a class="btn btn--sm btn--wa" data-wa="Hola, quisiera información del punto de venta PAVIC en La Paz." data-wa-num="${sitio.agencias.oruro[1].whatsapp}" href="${waHref(sitio.agencias.oruro[1].whatsapp, 'Hola, quisiera información del punto de venta PAVIC en La Paz.')}" rel="noopener">Preguntar por WhatsApp</a></div></article></div></div>
  <div class="panel" data-city-panel="otra-ciudad" id="otra-ciudad" hidden>
    <div class="split"><div><h3>¿Estás en otra ciudad?</h3><p class="lead" style="margin-top:10px">Por ahora no tenemos agencia en tu ciudad. Déjanos tu celular y te avisamos cuando abramos, o te orientamos sobre cómo recibir tu pedido.</p></div>
    <div>${leadForm({ asunto: 'Lista de espera: ciudad sin agencia', boton: 'Avísenme', campos: field('Nombre', 'nombre', 'required autocomplete="name"') + field('Celular', 'celular', 'type="tel" required autocomplete="tel"') + field('Ciudad', 'ciudad_otra', 'required placeholder="Tu ciudad"') + field('¿Qué necesitas?', 'necesidad', 'placeholder="Producto y cantidad aproximada"') })}</div></div>
  </div>
</section>`
}));

/* ============================ EMPRESA ============================ */
const fabricas = sitio.ciudades.map((c) => [c, sitio.agencias[c.slug].find((a) => a.tipo === 'fabrica')]).filter(([, f]) => f);
write('empresa.html', layout({
  file: 'empresa.html',
  title: 'Empresa | INCERPAZ',
  desc: 'INCERPAZ fabrica cerámica para la construcción en Bolivia. Conoce nuestra misión, valores, fábricas, calidad y cómo contactarnos.',
  jsonld: orgLd,
  body: `
<section class="section"><div class="wrap split">
  <div><span class="eyebrow">Empresa</span><h1 style="font-size:clamp(40px,6vw,76px);margin-block:12px 20px">Cerámica para construir tu hogar</h1><p class="lead">${esc(sitio.somos)}</p></div>
  <img src="assets/img/productos/9-huecos-economico-rayado-2.jpg" alt="Muro de ladrillo cerámico INCERPAZ" width="800" height="800" loading="eager" style="width:100%;aspect-ratio:4/3;object-fit:cover">
</div></section>

<section class="section section--grey"><div class="wrap split">
  <div><span class="eyebrow">Misión</span><h2 style="margin-block:12px 18px">Producimos para el país que construye</h2><p class="lead">${esc(sitio.mision)}</p></div>
  <div><span class="eyebrow">Valores</span><div class="values" style="margin-top:16px">${sitio.valores.map((v) => `<span>${v}</span>`).join('')}</div></div>
</div></section>

<section class="section"><div class="wrap">
  <div class="section-head"><span class="eyebrow">Fábricas</span><h2>Dónde fabricamos</h2><p class="lead">Fábricas en Cochabamba, Santa Cruz y Oruro, y fábricas especializadas en PAVIC en Cochabamba y Santa Cruz.</p></div>
  <div class="agencies">${fabricas.map(([c, f]) => `<article class="agency"><span class="tag">Fábrica</span><h3>${c.nombre}</h3><address>${esc(f.direccion)}</address><div class="btn-row" style="margin-top:auto"><a class="btn btn--sm" href="donde-estamos.html#${c.slug}">Ver agencias de ${c.nombre}</a></div></article>`).join('')}</div>
</div></section>

<section class="section dark"><div class="wrap split">
  <div><span class="eyebrow">Calidad</span><h2 style="margin-block:12px 18px">Calidad con respaldo técnico</h2>
    <p class="lead">Trabajamos con un sistema integrado de gestión en todos nuestros procesos. PAVIC cuenta con certificados de calidad, ensayos de laboratorio y certificación ISO.</p>
    <div class="btn-row" style="margin-top:24px"><a class="btn btn--red" href="pavic.html#calidad">Solicitar documentación</a></div></div>
  <div><span class="eyebrow">Marcas</span>
    <div class="three" style="grid-template-columns:1fr 1fr;margin-top:16px"><div style="background:#2a2725;border-color:#3a3633;color:#fff"><h3 style="color:#fff">INCERPAZ</h3><p style="color:#cfc9c2">Ladrillos, techos, revestimientos y piezas especiales.</p><a class="btn btn--sm btn--ghost" style="color:#fff" href="catalogo.html">Ver productos</a></div><div style="background:#2a2725;border-color:#3a3633;color:#fff"><h3 style="color:#fff">PAVIC</h3><p style="color:#cfc9c2">Pavimento cerámico para proyectos.</p><a class="btn btn--sm btn--ghost" style="color:#fff" href="pavic.html">Ir a PAVIC</a></div></div></div>
</div></section>

<section class="section"><div class="wrap split">
  <div><span class="eyebrow">Exportaciones y promotores</span><h2 style="margin-block:12px 18px">Más formas de trabajar con INCERPAZ</h2>
    <div class="btn-row"><a class="btn" href="${sitio.enlaces_externos.exportaciones}" rel="noopener">Exportaciones</a><a class="btn" href="${sitio.enlaces_externos.promotores}" rel="noopener">Portal de promotores</a></div></div>
  <div id="contacto"><span class="eyebrow">Contacto</span><h2 style="margin-block:12px 18px">Escríbenos</h2>
    <p class="muted" style="margin-bottom:18px">Servicio al cliente <a href="tel:${sitio.servicio_cliente.tel}"><strong>${sitio.servicio_cliente.texto}</strong></a> · <a href="mailto:${sitio.correo}">${sitio.correo}</a></p>
    ${leadForm({ asunto: 'Contacto desde la página Empresa', boton: 'Enviar', campos: field('Nombre', 'nombre', 'required autocomplete="name"') + selectCities('ciudad') +
      `<label>Motivo<select name="motivo"><option>Quiero comprar</option><option>Quiero cotizar un proyecto</option><option>Reclamo o sugerencia</option><option>Prensa</option><option>Trabajo</option></select></label>` + field('Celular', 'celular', 'type="tel" required autocomplete="tel"') + `<label class="full">Mensaje<textarea name="mensaje"></textarea></label>` })}</div>
</div></section>`
}));

/* ============================ COMERCIO: cuenta, presupuesto, pedidos, panel ============================ */
if (config.comercio) {
  const TIPOS = [['constructor', 'Constructor independiente'], ['empresa', 'Empresa constructora'], ['ferreteria', 'Ferretería o distribuidor'], ['entidad', 'Entidad pública'], ['proyectista', 'Proyectista o calculista'], ['dueno', 'Dueño de casa']];
  const agenciasJson = JSON.stringify(Object.fromEntries(Object.entries(sitio.agencias).map(([c, l]) => [c, l.map((a) => ({ nombre: a.nombre, tipo: a.tipo }))]))).replace(/</g, '\\u003c');
  const sinJs = '<noscript><p class="price-note">Esta sección necesita JavaScript.</p></noscript>';
  write('ingresar.html', layout({ file: 'ingresar.html', pagina: 'ingresar', title: 'Ingresar | INCERPAZ', desc: 'Ingresa a tu cuenta INCERPAZ para ver los precios de tu ciudad y hacer pedidos.', body: `
<section class="section"><div class="wrap narrow"><span class="eyebrow">Mi cuenta</span><h1 style="font-size:clamp(40px,6vw,72px);margin-block:12px 14px">Ingresar</h1>
<p class="lead">Con una cuenta verificada ves los precios de tu ciudad, guardas presupuestos y haces pedidos.</p>
<div class="form-box" style="margin-top:28px"><form id="form-ingreso"><div class="form-grid"><label class="full">Correo<input name="correo" type="email" required autocomplete="username"></label><label class="full">Contraseña<input name="password" type="password" required autocomplete="current-password"></label></div>
<div class="btn-row" style="margin-top:18px"><button class="btn btn--red" type="submit">Ingresar</button><a class="btn" href="registro.html">Crear cuenta</a></div></form><p id="msg" class="form-msg" hidden style="margin-top:16px"></p></div>${sinJs}</div></section>` }));
  write('registro.html', layout({ file: 'registro.html', pagina: 'registro', title: 'Crear cuenta | INCERPAZ', desc: 'Crea tu cuenta INCERPAZ. Un ejecutivo de tu ciudad la verifica y desde ese momento ves los precios y haces pedidos.', body: `
<section class="section"><div class="wrap narrow"><span class="eyebrow">Mi cuenta</span><h1 style="font-size:clamp(40px,6vw,72px);margin-block:12px 14px">Crear cuenta</h1>
<p class="lead">Un ejecutivo de tu ciudad verifica tus datos. Mientras tanto puedes armar presupuestos; al verificarte ves los precios y haces pedidos.</p>
<div class="form-box" style="margin-top:28px"><form id="form-registro"><div class="form-grid">
<label class="full">Soy<select name="tipo">${TIPOS.map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select></label>
<label>Nombre y apellido<input name="nombre" required maxlength="120" autocomplete="name"></label>
<label data-emp>Razón social<input name="razon_social" maxlength="160" autocomplete="organization"></label>
<label data-emp>NIT o CI<input name="nit" maxlength="20" inputmode="numeric"></label>
<label>Ciudad<select name="ciudad">${sitio.ciudades.map((c) => `<option value="${c.slug}">${c.nombre}</option>`).join('')}</select></label>
<label>Celular o WhatsApp<input name="celular" required inputmode="tel" maxlength="20" placeholder="7xxxxxxx" autocomplete="tel"></label>
<label>Correo<input name="correo" type="email" required maxlength="160" autocomplete="email"></label>
<label>Contraseña (8 o más caracteres)<input name="password" type="password" required minlength="8" autocomplete="new-password"></label>
<label>Repite la contraseña<input name="password2" type="password" required minlength="8" autocomplete="new-password"></label></div>
<div class="btn-row" style="margin-top:18px"><button class="btn btn--red" type="submit">Crear cuenta</button><a class="btn" href="ingresar.html">Ya tengo cuenta</a></div></form>
<p id="msg" class="form-msg" hidden style="margin-top:16px"></p>
<div id="despues" hidden style="margin-top:20px"><p class="muted">Puedes seguir viendo el catálogo y armando tu presupuesto mientras verificamos tu cuenta.</p><div class="btn-row" style="margin-top:12px"><a class="btn btn--red" href="catalogo.html">Ver productos</a></div></div></div>${sinJs}</div></section>` }));
  write('presupuesto.html', layout({ file: 'presupuesto.html', pagina: 'presupuesto', title: 'Mi presupuesto | INCERPAZ', desc: 'Arma tu presupuesto con los productos INCERPAZ y pide una cotización o envía tu pedido.', body: `
<section class="section"><div class="wrap"><span class="eyebrow">Presupuesto</span><h1 style="font-size:clamp(40px,6vw,72px);margin-block:12px 28px">Mi presupuesto</h1><div id="app">Cargando…</div>${sinJs}</div></section>
<script type="application/json" id="datos-agencias">${agenciasJson}</script>` }));
  write('mi-cuenta.html', layout({ file: 'mi-cuenta.html', pagina: 'cuenta', title: 'Mi cuenta | INCERPAZ', desc: 'Tus presupuestos y pedidos en INCERPAZ.', body: `
<section class="section"><div class="wrap"><span class="eyebrow">Mi cuenta</span><div id="app" style="margin-top:12px">Cargando…</div>${sinJs}</div></section>` }));
  write('equipo.html', layout({ file: 'equipo.html', pagina: 'equipo', title: 'Panel del equipo | INCERPAZ', desc: 'Verificación de cuentas y seguimiento de pedidos para el equipo de INCERPAZ.', body: `
<section class="section"><div class="wrap"><span class="eyebrow">Equipo INCERPAZ</span><h1 style="font-size:clamp(36px,5vw,60px);margin-block:12px 24px">Panel</h1><div id="app">Cargando…</div>${sinJs}</div></section>
<script type="application/json" id="datos-listas">${JSON.stringify(sitio.listas_precios || ['general'])}</script>` }));
}

if (config.comercio) {
  write('admin.html', layout({ file: 'admin.html', pagina: 'admin', title: 'Administrar el sitio | INCERPAZ', desc: 'Edición de productos, precios, agencias y contacto del sitio de INCERPAZ.', body: `
<section class="section"><div class="wrap"><span class="eyebrow">Administración</span><h1 style="font-size:clamp(36px,5vw,60px);margin-block:12px 24px">Contenido del sitio</h1><div id="app">Cargando…</div><noscript><p class="price-note">Esta sección necesita JavaScript.</p></noscript></div></section>` }));
}

/* ============================ PROYECTOS (qué construir, con lista de materiales) ============================ */
const proyectosData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/proyectos.json'), 'utf8'));
/* rendimiento por m² de una ficha; el catálogo de Santa Cruz publica el enchape corto "por ml" pero la cifra corresponde a m² (20 × 7,5 cm) */
function rendM2(p) {
  const v = p.variantes.find((x) => x.unidad === 'm2') || (/^brick-enchape/.test(p.slug) ? p.variantes[0] : null);
  return v ? v.rend : null;
}
const porSlug = (ciudad, slug) => productos.find((p) => p.ciudad === ciudad && p.slug === slug);
const NIVEL_CLASE = { Básico: 'ok', Medio: 'warn' };
write('proyectos.html', layout({
  file: 'proyectos.html', pagina: 'proyectos', title: 'Proyectos para construir | INCERPAZ',
  desc: 'Churrasquero, mesón y pared con enchape de ladrillo: calcula la lista de materiales, los costos y sigue los pasos para construirlos.',
  body: `<section class="section"><div class="wrap">
  <div class="section-head"><span class="eyebrow">Inspiración y obra</span><h1 style="font-size:clamp(36px,5vw,60px)">Proyectos para construir</h1><p class="lead">Elige un proyecto, ajusta las medidas a tu espacio y obtén la lista de materiales con cantidades, el esquema y los pasos. Con tu cuenta verificada ves el costo y lo envías a tu presupuesto.</p></div>
  <div class="proys">${proyectosData.proyectos.map((pr) => `<a class="cat" href="proyectos/${pr.slug}.html" style="grid-column:auto"><img src="${pr.imagen}" alt="" loading="lazy" width="600" height="400"><div><h3>${esc(pr.titulo)}</h3><span>${esc(pr.resumen)}</span><span style="display:block;margin-top:8px">Nivel ${pr.nivel.toLowerCase()} · ${esc(pr.dias)}</span></div></a>`).join('')}</div>
  <p class="price-note" style="margin-top:32px">${esc(proyectosData.aviso)}</p>
</div></section>
<section class="section section--grey"><div class="wrap split">
  <div><span class="eyebrow">¿Tienes otra idea?</span><h2 style="margin-block:12px 18px">Cuéntanos tu proyecto</h2><p class="lead">Escríbenos con la medida de tu espacio y te ayudamos a elegir la pieza y a calcular el material.</p></div>
  <div><a class="btn btn--wa" data-wa="Hola, tengo un proyecto de construcción y quisiera asesoría en {ciudad}." href="${waHref(ciudadDefecto.whatsapp, 'Hola, tengo un proyecto de construcción y quisiera asesoría en Cochabamba.')}" rel="noopener">Consultar por WhatsApp</a></div>
</div></section>`
}));
for (const pr of proyectosData.proyectos) {
  const slugs = new Set();
  pr.materiales.forEach((m) => { if (m.producto) Object.values(m.producto).forEach((s) => slugs.add(s)); });
  if (pr.eleccion) pr.eleccion.opciones.forEach((s) => slugs.add(s));
  const catalogos = {};
  for (const c of Object.keys(CIUDAD_CATALOGO)) {
    catalogos[c] = {};
    slugs.forEach((slug) => { const p = porSlug(c, slug); if (p && rendM2(p)) catalogos[c][slug] = { nombre: p.nombre, codigo: p.codigo || '', rend: rendM2(p) }; });
  }
  const datos = { proyecto: pr, catalogos, ciudades: sitio.ciudades.map((c) => ({ slug: c.slug, nombre: c.nombre, whatsapp: c.whatsapp })) };
  const ld = { '@context': 'https://schema.org', '@type': 'HowTo', name: pr.titulo, description: pr.resumen, tool: pr.herramientas.map((h) => ({ '@type': 'HowToTool', name: h })), step: pr.pasos.map((x, i) => ({ '@type': 'HowToStep', position: i + 1, name: x.titulo, text: x.texto })) };
  write(`proyectos/${pr.slug}.html`, layout({
    file: `proyectos/${pr.slug}.html`, base: '../', pagina: 'proyecto', title: `${pr.titulo}: materiales, costos y pasos | INCERPAZ`, desc: `${pr.resumen} Calcula la lista de materiales y sigue los pasos.`,
    og: pr.imagen, jsonld: `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
    body: `<div class="wrap"><nav class="crumbs" aria-label="Ruta"><a href="../index.html">Inicio</a> › <a href="../proyectos.html">Proyectos</a> › ${esc(pr.titulo)}</nav></div>
<section class="section" style="padding-top:12px"><div class="wrap">
  <span class="eyebrow">Proyecto</span><h1 style="font-size:clamp(36px,5vw,60px);margin-block:12px 12px">${esc(pr.titulo)}</h1>
  <p class="lead">${esc(pr.resumen)}</p>
  <p style="margin-top:14px"><span class="chip ${NIVEL_CLASE[pr.nivel] || 'ok'}">Nivel ${pr.nivel.toLowerCase()}</span> <span class="chip ok">${esc(pr.dias)}</span> <span class="chip ok">${esc(pr.personas)}</span></p>
</div></section>
<section class="section section--grey"><div class="wrap">
  <div class="section-head"><h2>1. Ajusta las medidas</h2></div>
  <div class="proy">
    <div class="calc" style="display:block"><div class="fields" id="proy-campos"></div></div>
    <figure class="plano" id="proy-plano" aria-label="Esquema del proyecto"></figure>
  </div>
</div></section>
<section class="section"><div class="wrap">
  <div class="section-head"><h2>2. Lista de materiales</h2><p class="lead" id="proy-estado"></p></div>
  <div id="proy-lista"><p class="muted">Cargando…</p></div>
  <noscript><p class="price-note">Para calcular los materiales se necesita JavaScript. Escríbenos por WhatsApp y te ayudamos.</p></noscript>
  <div class="btn-row" style="margin-top:20px" id="proy-acciones" hidden></div>
</div></section>
<section class="section section--grey"><div class="wrap split">
  <div><div class="section-head"><h2>3. Pasos</h2></div><ol class="pasos">${pr.pasos.map((x) => `<li><b>${esc(x.titulo)}</b><span>${esc(x.texto)}</span></li>`).join('')}</ol></div>
  <div><div class="section-head"><h2>Herramientas</h2></div><ul class="lista">${pr.herramientas.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>
    <div class="section-head" style="margin-top:32px"><h2>Consejos</h2></div><ul class="lista">${pr.consejos.map((h) => `<li>${esc(h)}</li>`).join('')}</ul></div>
</div></section>
<section class="section"><div class="wrap"><p class="price-note">${esc(proyectosData.aviso)}</p></div></section>
<script type="application/json" id="datos-proyecto">${JSON.stringify(datos).replace(/</g, '\\u003c')}</script>`
  }));
}

/* ============================ GUÍAS (contenido para atraer y orientar) ============================ */
const guiasData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/guias.json'), 'utf8')).guias;
const fechaLarga = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' });
write('guias.html', layout({
  file: 'guias.html', pagina: 'guias', title: 'Guías para construir con cerámica | INCERPAZ',
  desc: 'Guías prácticas: cuántos ladrillos necesitas por m², cómo elegir, cómo colocar enchape, qué pedir en un pavimento cerámico y cómo cuidar el ladrillo visto.',
  body: `<section class="section"><div class="wrap">
  <div class="section-head"><span class="eyebrow">Aprende antes de comprar</span><h1 style="font-size:clamp(36px,5vw,60px)">Guías para construir con cerámica</h1><p class="lead">Respuestas claras a las preguntas más comunes de quien construye, remodela o proyecta.</p></div>
  <div class="proys">${guiasData.map((g) => `<a class="cat" href="guias/${g.slug}.html" style="grid-column:auto"><img src="${g.imagen}" alt="" loading="lazy" width="600" height="400"><div><h3>${esc(g.titulo)}</h3><span>${esc(g.resumen)}</span><span style="display:block;margin-top:8px">${g.minutos} min de lectura</span></div></a>`).join('')}</div>
</div></section>`
}));
for (const g of guiasData) {
  const b = '../', fix = (h) => (/^https?:/.test(h) ? h : b + h);
  const cuerpo = g.cuerpo.map((x) => x.t === 'h2' ? `<h2 style="margin:32px 0 10px;font-size:28px">${esc(x.x)}</h2>` : x.t === 'p' ? `<p style="margin-bottom:14px;max-width:68ch">${esc(x.x)}</p>` : x.t === 'ul' ? `<ul class="lista" style="margin-bottom:14px;max-width:68ch">${x.x.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : `<p style="margin:28px 0"><a class="btn btn--red" href="${fix(x.href)}">${esc(x.x)}</a></p>`).join('');
  const ld = { '@context': 'https://schema.org', '@type': 'Article', headline: g.titulo, description: g.resumen, datePublished: g.fecha, image: `${sitio.dominio}/${g.imagen}`, author: { '@type': 'Organization', name: 'INCERPAZ' }, publisher: { '@type': 'Organization', name: 'INCERPAZ', logo: { '@type': 'ImageObject', url: `${sitio.dominio}/assets/img/logo-header.png` } } };
  write(`guias/${g.slug}.html`, layout({
    file: `guias/${g.slug}.html`, base: b, pagina: 'guia', title: `${g.titulo} | INCERPAZ`, desc: g.resumen, og: g.imagen,
    jsonld: `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
    body: `<div class="wrap"><nav class="crumbs" aria-label="Ruta"><a href="../index.html">Inicio</a> › <a href="../guias.html">Guías</a> › ${esc(g.titulo)}</nav></div>
<article class="section" style="padding-top:12px"><div class="wrap">
  <span class="eyebrow">Guía · ${g.minutos} min de lectura</span><h1 style="font-size:clamp(34px,5vw,56px);margin-block:12px 12px">${esc(g.titulo)}</h1>
  <p class="lead">${esc(g.resumen)}</p><p class="muted" style="margin:10px 0 24px">Equipo INCERPAZ · ${fechaLarga(g.fecha)}</p>
  ${cuerpo}
  ${g.relacionados.length ? `<h2 style="margin:32px 0 10px;font-size:24px">Sigue leyendo</h2><ul class="lista">${g.relacionados.map((r) => `<li><a href="${fix(r[0])}">${esc(r[1])}</a></li>`).join('')}</ul>` : ''}
</div></article>
<section class="section section--grey"><div class="wrap split">
  <div><span class="eyebrow">¿Tienes dudas?</span><h2 style="margin-block:12px 18px">Habla con un ejecutivo de tu ciudad</h2><p class="lead">Cuéntanos qué vas a construir y te ayudamos a elegir la pieza y calcular el material.</p></div>
  <div>${leadForm({ asunto: `Consulta desde guía: ${g.titulo}`, boton: 'Enviar consulta', campos: field('Nombre', 'nombre', 'required autocomplete="name"') + field('Celular', 'celular', 'type="tel" required autocomplete="tel"') + selectCities('ciudad') + '<label class="full">¿Qué necesitas?<textarea name="consulta" rows="3" maxlength="500"></textarea></label>' })}</div>
</div></section>`
  }));
}

/* ============================ EXPORTACIONES (español e inglés) ============================ */
write('exportaciones.html', layout({
  file: 'exportaciones.html', pagina: 'exportaciones', title: 'Exportaciones | Cerámica boliviana INCERPAZ',
  desc: 'INCERPAZ exporta cerámica fabricada en Bolivia. Consulta de exportación para importadores y distribuidores. Export inquiries for importers and distributors.',
  body: `<section class="section"><div class="wrap split">
  <div><span class="eyebrow">Exportaciones</span><h1 style="font-size:clamp(36px,5vw,60px);margin-block:12px 18px">Cerámica boliviana para el mundo</h1>
    <p class="lead">${esc(sitio.somos)}</p>
    <p style="margin-top:16px;max-width:60ch">Si eres importador, distribuidor o constructor fuera de Bolivia, cuéntanos qué producto buscas y el volumen aproximado. El equipo de exportaciones te responde con disponibilidad, condiciones y plazos.</p>
    <p class="muted" style="margin-top:14px">Fábricas en Cochabamba, Santa Cruz y Oruro.</p>
    <div lang="en" style="margin-top:32px;padding-top:24px;border-top:2px solid var(--line)"><h2 style="font-size:28px;margin-bottom:10px">Made in Bolivia, shipped worldwide</h2>
      <p style="max-width:60ch">INCERPAZ manufactures ceramic bricks, facing bricks, roof tiles and PAVIC ceramic pavers in Bolivia. Importers and distributors: tell us the product, destination and approximate volume, and our export team will reply with availability, terms and lead times.</p></div>
    <p style="margin-top:24px"><a class="btn btn--sm" href="${sitio.enlaces_externos.exportaciones}" rel="noopener">Sitio de exportaciones actual</a></p>
  </div>
  <div>${leadForm({ asunto: 'Consulta de exportación', boton: 'Enviar consulta / Send inquiry', campos:
    field('Nombre / Name', 'nombre', 'required autocomplete="name"') + field('Empresa / Company', 'empresa', 'required autocomplete="organization"') + field('Correo / Email', 'correo', 'type="email" required autocomplete="email"') + field('Teléfono o WhatsApp / Phone', 'celular', 'type="tel" autocomplete="tel"') +
    field('País de destino / Destination country', 'pais', 'required') + field('Volumen aproximado / Approx. volume', 'volumen', 'placeholder="m², piezas o contenedores / m², pieces or containers"') +
    `<label class="full">Producto de interés / Product<select name="producto"><option>Ladrillos y bloques / Bricks and blocks</option><option>Ladrillo visto y enchape / Facing bricks</option><option>Tejas / Roof tiles</option><option>PAVIC (pavimento) / PAVIC pavers</option><option>Refractarios / Refractory</option><option>Otro / Other</option></select></label>` +
    '<label class="full">Mensaje / Message<textarea name="mensaje" rows="3" maxlength="500"></textarea></label>' })}</div>
</div></section>`
}));

/* ============================ 404, sitemap, robots ============================ */
write('404.html', layout({
  file: '404.html', title: 'Página no encontrada | INCERPAZ', desc: 'La página que buscas no existe.',
  body: `<section class="section"><div class="wrap"><h1>No encontramos esa página</h1><p class="lead" style="margin-block:16px 28px">Puede que el enlace haya cambiado. Prueba desde el inicio o el catálogo.</p><div class="btn-row"><a class="btn btn--red" href="${sitio.dominio}/">Ir al inicio</a><a class="btn" href="${sitio.dominio}/catalogo.html">Ver productos</a></div></div></section>`
}));
const urls = ['', 'catalogo.html', 'guias.html', 'exportaciones.html', ...guiasData.map((g) => `guias/${g.slug}.html`), 'pavic-recursos.html', 'proyectos.html', ...proyectosData.proyectos.map((x) => `proyectos/${x.slug}.html`), 'pavic.html', 'donde-estamos.html', 'empresa.html', ...productos.map((p) => `productos/${p.ciudad}/${p.slug}.html`)];
if (config.interno) {
  fs.rmSync(path.join(OUT, 'sitemap.xml'), { force: true });
  fs.writeFileSync(path.join(OUT, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
} else {
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${sitio.dominio}/${u}</loc></url>`).join('\n')}\n</urlset>\n`);
  fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${sitio.dominio}/sitemap.xml\n`);
}
console.log(`Sitio generado: ${urls.length} páginas en ${path.relative(ROOT, OUT)}/ (${config.interno ? 'interno, sin indexar' : 'público, indexable'})`);
