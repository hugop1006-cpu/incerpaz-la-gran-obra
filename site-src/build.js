#!/usr/bin/env node
/* Genera el sitio estático de INCERPAZ en /site a partir de /site-src/data.
   Uso: node site-src/build.js
   Los textos y datos viven en site-src/data (sitio.json y productos.json). Las páginas se
   generan completas en HTML para que carguen rápido en celular y las lea bien Google. */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'site');
const sitio = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/sitio.json'), 'utf8'));
let productos = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/productos.json'), 'utf8'));
const config = fs.existsSync(path.join(__dirname, 'config.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')) : { leadEndpoint: '' };

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (n) => Number(n).toLocaleString('es-BO', { maximumFractionDigits: 2 });
const waHref = (numero, msg) => `https://wa.me/591${numero}?text=${encodeURIComponent(msg)}`;
const telDisplay = (t) => t.replace(/^(\d)-(\d+)$/, '($1) $2');
const telHref = (t) => 'tel:+591' + t.replace(/\D/g, '');

/* ---- normalización de los datos del catálogo actual ---- */
const CAT_NOMBRE = Object.fromEntries(sitio.categorias.map((c) => [c.slug, c.nombre]));
const sentence = (s) => s.toLowerCase().replace(/^./, (c) => c.toUpperCase());
function bonito(nombre) {
  let s = sentence(nombre.replace(/\s+–\s+/g, ' ').trim());
  s = s.replace(/\bpavic\b/gi, 'PAVIC').replace(/\bxv\b/gi, 'XV').replace(/\bestandar\b/gi, 'estándar').replace(/\bceloc?ia\b/gi, 'celosía')
    .replace(/\beconomico\b/gi, 'económico').replace(/\brustico\b/gi, 'rústico').replace(/\bcaida\b/gi, 'caída').replace(/\bceramico\b/gi, 'cerámico')
    .replace(/(\d+)h\b/gi, '$1H');
  return s;
}
const OVERRIDES = {
  '3-huecos-economico-rayado': { ancho: 7 } /* el sitio actual dice 0,7 cm: se asume 7 cm (ver CONTENIDO-PENDIENTE.md) */
};
productos = productos.map((p) => {
  const o = OVERRIDES[p.slug] || {};
  const full = p.rendimiento ? `${p.rendimiento} ${p.rendimiento_unidad || ''}` : '';
  const variantes = [];
  full.replace(/([\d.,]+)\s*pzas\/(m2|ml)\s*(?:\(([^)]*)\))?/gi, (_, n, u, etq) => {
    variantes.push({ rend: parseFloat(n.replace(',', '.')), unidad: u.toLowerCase(), etiqueta: etq ? sentence(etq.trim()) : '' });
    return '';
  });
  const linea = p.linea ? sentence(p.linea.replace('VARIADADES', 'VARIEDADES').replace('VARIEDAD ', 'VARIEDADES ').replace(/VARIEDAD$/, 'VARIEDADES')) : '';
  return Object.assign({}, p, o, { nombre: bonito(p.nombre), linea, variantes, cat: p.categorias[0], todas: p.categorias });
});
const bySlug = Object.fromEntries(productos.map((p) => [p.slug, p]));
const pavic = productos.filter((p) => /pavic/i.test(p.linea) || p.slug.startsWith('pavic'));

/* ---- plantilla ---- */
const NAV = [
  ['catalogo.html', 'Productos'],
  ['pavic.html', 'PAVIC'],
  ['donde-estamos.html', 'Dónde estamos'],
  ['empresa.html', 'Empresa']
];
const ciudadDefecto = sitio.ciudades[0];
function layout({ file, base = '', title, desc, body, og = 'assets/img/productos/pavic-tabaco-2.jpg', jsonld = '' }) {
  const url = `${sitio.dominio}/${file === 'index.html' ? '' : file}`;
  const nav = NAV.map(([href, label]) => `<a href="${base}${href}"${file === href ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  const cfg = JSON.stringify({ ciudades: sitio.ciudades.map((c) => ({ slug: c.slug, nombre: c.nombre, whatsapp: c.whatsapp })), leadEndpoint: config.leadEndpoint || '' });
  return `<!doctype html>
<html lang="es-BO">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
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
<body>
<a class="skip" href="#contenido">Saltar al contenido</a>
<div class="topbar"><div class="wrap">
  <span>Servicio al cliente <a href="tel:${sitio.servicio_cliente.tel}"><strong>${sitio.servicio_cliente.texto}</strong></a></span>
  <span><a href="${sitio.enlaces_externos.exportaciones}" rel="noopener">Exportaciones</a> · <a href="${sitio.enlaces_externos.promotores}" rel="noopener">Promotores</a></span>
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
</body>
</html>`;
}

const orgLd = `<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org', '@type': 'Organization', name: 'INCERPAZ', url: sitio.dominio,
  logo: `${sitio.dominio}/assets/img/logo-header.png`, sameAs: Object.values(sitio.redes),
  contactPoint: [{ '@type': 'ContactPoint', telephone: '+591-800-10-8810', contactType: 'customer service', areaServed: 'BO', availableLanguage: 'es' }]
})}</script>`;

/* ---- piezas reutilizables ---- */
const img = (p, i = 0) => p.imagenes[i] || null;
function productCard(p, base = '') {
  const im = img(p, 0);
  const dims = [p.largo && `${num(p.largo)}`, p.ancho && `${num(p.ancho)}`, p.alto && `${num(p.alto)}`].filter(Boolean);
  const meta = dims.length === 3 ? `${dims.join(' × ')} cm` : (p.codigo ? `Código ${p.codigo}` : '');
  return `<a class="pcard" href="${base}productos/${p.slug}.html" data-cats="${p.todas.join(' ')}" data-name="${esc(p.nombre + ' ' + (p.codigo || ''))}">
  <div class="img">${im ? `<img src="${base}${im}" alt="${esc(p.nombre)}" loading="lazy" width="400" height="400">` : `<img src="${base}assets/img/logo-icono.png" alt="" style="width:40%;opacity:.25">`}</div>
  <div class="body"><span class="tag">${esc(CAT_NOMBRE[p.cat] || '')}</span><h3>${esc(p.nombre)}</h3><span class="meta">${esc(meta)}</span></div></a>`;
}
function calcOptions(list) {
  return list.map((p) => {
    const v = p.variantes[0];
    return v ? `<option data-rend="${v.rend}" data-peso="${p.peso || 0}" data-unidad="${v.unidad}" data-nombre="${esc(p.nombre)}">${esc(p.nombre)}</option>` : '';
  }).join('');
}
function calcBox({ options, idp = 'c', waText, light = false, noteExtra = '' }) {
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
  </div>
</div>`;
}
function leadForm({ asunto, campos, boton, ok = '', waNum = '' }) {
  return `<div class="form-box"><form data-lead="${esc(asunto)}" ${waNum ? `data-wa-num="${waNum}"` : ''}>
  <div class="form-grid">${campos}</div>
  <div class="hp" aria-hidden="true"><label>No llenar<input type="text" name="web" tabindex="-1" autocomplete="off"></label></div>
  <div class="btn-row" style="margin-top:18px"><button class="btn btn--red" type="submit">${esc(boton)}</button></div>
</form><p class="form-msg" role="status" hidden style="margin-top:16px"></p></div>`;
}
const field = (label, name, extra = '', cls = '') => `<label class="${cls}">${label}<input name="${name}" ${extra}></label>`;
const selectCities = (name = 'ciudad', extra = '') => `<label>Ciudad<select name="${name}" ${extra}>${sitio.ciudades.map((c) => `<option>${c.nombre}</option>`).join('')}<option>Otra ciudad</option></select></label>`;

function write(file, html) {
  const p = path.join(OUT, file);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, html);
}

/* ============================ HOME ============================ */
const mosaico = ['18-h', 'brick-enchape-corto', '9-huecos-economico-rayado', 'brick-estandar', 'pavic-peatonal', 'biscocho']
  .map((s) => `assets/img/productos/${s}-2.jpg`);
const catCount = (slug) => productos.filter((p) => p.todas.includes(slug)).length;
write('index.html', layout({
  file: 'index.html',
  title: 'INCERPAZ | Cerámica para construir tu hogar',
  desc: 'Ladrillos, pisos, revestimientos y pavimentos cerámicos fabricados en Bolivia. Calcula tus piezas, encuentra tu agencia y cotiza por WhatsApp en Cochabamba, Santa Cruz, Oruro y Sucre.',
  jsonld: orgLd,
  body: `
<section class="hero"><div class="wrap">
  <div>
    <span class="eyebrow">Cerámica industrial boliviana</span>
    <h1>Cerámica para construir <em>tu hogar</em></h1>
    <p class="lead">Ladrillos, revestimientos y pavimentos fabricados en Bolivia. Calcula cuántas piezas necesitas y cotiza con una agencia de tu ciudad.</p>
    <div class="btn-row"><a class="btn btn--red" href="catalogo.html">Ver productos</a><a class="btn btn--wa" data-wa="Hola, quisiera cotizar en {ciudad}." href="${waHref(ciudadDefecto.whatsapp, 'Hola, quisiera cotizar en Cochabamba.')}" rel="noopener">Cotizar por WhatsApp</a></div>
  </div>
  <div class="mosaic" aria-hidden="true">${mosaico.map((m) => `<img src="${m}" alt="" loading="eager" width="400" height="400">`).join('')}</div>
</div></section>

<section class="wrap" style="padding-bottom:8px"><div class="quick">
  <a href="#calculadora"><b>Calcula tus piezas</b><span>Cuántas necesitas por m²</span></a>
  <a href="catalogo.html"><b>Catálogo</b><span>${productos.length} productos con ficha</span></a>
  <a href="donde-estamos.html"><b>Dónde comprar</b><span>Agencias y WhatsApp por ciudad</span></a>
  <a href="pavic.html"><b>PAVIC</b><span>Pavimentos para proyectos</span></a>
</div></section>

<section class="section"><div class="wrap">
  <div class="section-head"><span class="eyebrow">Productos</span><h2>Todo para levantar y terminar tu obra</h2></div>
  <div class="cats">${sitio.categorias.map((c) => `<a class="cat" href="catalogo.html?cat=${c.slug}"><img src="${c.imagen}" alt="" loading="lazy" width="600" height="400"><div><h3>${esc(c.nombre)}</h3><span>${esc(c.descripcion)} · ${catCount(c.slug)} productos</span></div></a>`).join('')}</div>
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
  desc: `Catálogo de ladrillos, revestimientos, pisos y piezas especiales de INCERPAZ: ${productos.length} productos con dimensiones, peso y rendimiento por m².`,
  body: `
<section class="section" style="padding-bottom:24px"><div class="wrap">
  <span class="eyebrow">Catálogo</span><h1 style="font-size:clamp(40px,6vw,72px);margin-block:12px 14px">Productos</h1>
  <p class="lead">Cada producto tiene sus dimensiones, peso y rendimiento. Los precios los confirma la agencia de tu ciudad por WhatsApp.</p>
</div></section>
<section class="wrap" style="padding-bottom:72px">
  <div class="filters">
    <div class="chips" role="group" aria-label="Categorías"><button class="chip" data-cat="todas" type="button" aria-pressed="true">Todas</button>${sitio.categorias.map((c) => `<button class="chip" data-cat="${c.slug}" type="button" aria-pressed="false">${esc(c.nombre)} (${catCount(c.slug)})</button>`).join('')}</div>
    <label class="search">Buscar<input id="q" type="search" placeholder="Ej. 6 huecos, enchape, botaguas" autocomplete="off"></label>
    <span id="count" class="muted" aria-live="polite"></span>
  </div>
  <div class="grid-products" id="grid">${productos.map((p) => productCard(p)).join('')}</div>
  <div class="empty" id="empty" hidden><b>No encontramos ese producto.</b><p class="muted" style="margin-top:6px">Prueba otra palabra o escríbenos por WhatsApp y te ayudamos.</p><div class="btn-row" style="margin-top:14px"><a class="btn btn--wa" data-wa="Hola, busco un producto que no encuentro en el catálogo. Estoy en {ciudad}." href="${waHref(ciudadDefecto.whatsapp, 'Hola, busco un producto que no encuentro en el catálogo.')}" rel="noopener">Escribir por WhatsApp</a></div></div>
</section>`
}));

/* ============================ PRODUCTOS ============================ */
for (const p of productos) {
  const rel = productos.filter((q) => q.cat === p.cat && q.slug !== p.slug).slice(0, 4);
  const rows = [
    p.codigo && ['Código', p.codigo], p.linea && ['Línea', p.linea], p.color && ['Color', p.color], p.acabado && ['Acabado', p.acabado],
    p.alto && ['Alto', `${num(p.alto)} cm`], p.largo && ['Largo', `${num(p.largo)} cm`], p.ancho && ['Ancho', `${num(p.ancho)} cm`], p.peso && ['Peso', `${num(p.peso)} kg`],
    p.variantes.length && ['Rendimiento', p.variantes.map((v) => `${num(v.rend)} piezas por ${v.unidad === 'ml' ? 'metro lineal' : 'm²'}${v.etiqueta ? ` (${v.etiqueta.toLowerCase()})` : ''}`).join('<br>')]
  ].filter(Boolean);
  const imgs = p.imagenes;
  const opts = p.variantes.map((v) => `<option data-rend="${v.rend}" data-peso="${p.peso || 0}" data-unidad="${v.unidad}" data-nombre="${esc(p.nombre)}">${num(v.rend)} piezas por ${v.unidad === 'ml' ? 'ml' : 'm²'}${v.etiqueta ? ` · ${esc(v.etiqueta.toLowerCase())}` : ''}</option>`).join('');
  const ld = `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name: p.nombre, description: p.descripcion || p.nombre, sku: p.codigo || undefined, brand: { '@type': 'Brand', name: /pavic/i.test(p.linea) ? 'PAVIC' : 'INCERPAZ' }, image: imgs.map((i) => `${sitio.dominio}/${i}`) })}</script>`;
  const waText = `Hola, quiero cotizar ${p.nombre}${p.codigo ? ` (código ${p.codigo})` : ''} en {ciudad}.`;
  write(`productos/${p.slug}.html`, layout({
    file: `productos/${p.slug}.html`, base: '../',
    title: `${p.nombre} | INCERPAZ`,
    desc: `${p.nombre}${p.descripcion ? ': ' + p.descripcion : ''} Dimensiones, peso y rendimiento. Cotiza por WhatsApp en tu ciudad.`,
    og: imgs[0] || 'assets/img/logo-header.png', jsonld: ld,
    body: `
<div class="wrap"><nav class="crumbs" aria-label="Ruta"><a href="../index.html">Inicio</a> › <a href="../catalogo.html">Productos</a> › <a href="../catalogo.html?cat=${p.cat}">${esc(CAT_NOMBRE[p.cat] || '')}</a> › ${esc(p.nombre)}</nav></div>
<section class="wrap" style="padding-bottom:64px"><div class="prod">
  <div class="gallery">
    <div class="main">${imgs[0] ? `<img id="mainImg" src="../${imgs[0]}" alt="${esc(p.nombre)}" width="800" height="800">` : `<img id="mainImg" src="../assets/img/logo-icono.png" alt="" style="width:30%;opacity:.25">`}</div>
    ${imgs.length > 1 ? `<div class="thumbs">${imgs.map((im, i) => `<button type="button" data-thumb="../${im}" aria-pressed="${i === 0}" aria-label="Ver imagen ${i + 1}"><img src="../${im}" alt="" width="84" height="84"></button>`).join('')}</div>` : ''}
  </div>
  <div>
    <span class="tag">${esc(CAT_NOMBRE[p.cat] || '')}</span>
    <h1>${esc(p.nombre)}</h1>
    ${p.descripcion ? `<p class="lead">${esc(p.descripcion)}</p>` : ''}
    ${rows.length ? `<table class="specs"><tbody>${rows.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${/<br>/.test(v) ? v : esc(v)}</td></tr>`).join('')}</tbody></table>` : ''}
    <p class="price-note"><strong>Precio:</strong> lo confirma la agencia de tu ciudad según tu obra y la cantidad. Escríbenos y te cotizamos.</p>
    <div class="btn-row"><a class="btn btn--wa" data-wa="${esc(waText)}" href="${waHref(ciudadDefecto.whatsapp, waText.replace('{ciudad}', ciudadDefecto.nombre))}" rel="noopener">Cotizar por WhatsApp</a><a class="btn" href="../donde-estamos.html">Dónde comprar</a></div>
  </div>
</div></section>
${p.variantes.length ? `<section class="section section--grey"><div class="wrap"><div class="section-head"><h2>Calcula cuántas piezas necesitas</h2></div>
${calcBox({ options: opts, idp: 'p', waText: waText })}</div></section>` : ''}
${rel.length ? `<section class="section"><div class="wrap"><div class="section-head"><h2>Productos relacionados</h2></div><div class="grid-products">${rel.map((q) => productCard(q, '../')).join('')}</div></div></section>` : ''}`
  }));
}

/* ============================ PAVIC ============================ */
const pavicOpts = calcOptions(pavic);
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
  <div class="btn-row"><a class="btn btn--red" href="#cotizar">Cotizar mi proyecto</a><a class="btn btn--ghost" style="color:#fff" href="#calidad">Solicitar documentación técnica</a></div></div></section>

<section class="section"><div class="wrap">
  <div class="section-head"><span class="eyebrow">Para quién</span><h2>Hecho para obras que se miden en miles de metros</h2></div>
  <div class="three">
    <div><h3>Constructoras y obras privadas</h3><p class="muted">Urbanizaciones, condominios y proyectos comerciales que necesitan volumen y plazos claros.</p></div>
    <div><h3>Entidades públicas</h3><p class="muted">Plazas, calles peatonales y espacios públicos, con documentación técnica para licitaciones.</p></div>
    <div><h3>Proyectistas y arquitectos</h3><p class="muted">Datos de producto y asesoría para especificar PAVIC en tu diseño.</p></div>
  </div>
</div></section>

<section class="section section--grey"><div class="wrap">
  <div class="section-head"><span class="eyebrow">Productos PAVIC</span><h2>Líneas de pavimento</h2></div>
  <div class="grid-products">${pavic.map((p) => productCard(p)).join('')}</div>
</div></section>

<section class="section" id="calculadora"><div class="wrap">
  <div class="section-head"><span class="eyebrow">Herramienta</span><h2>Calculadora de obra</h2><p class="lead">Estima las piezas y el peso para tu proyecto. Para volumen y plazos, el precio final sale por cotización.</p></div>
  ${calcBox({ options: pavicOpts, idp: 'v', waText: 'Hola, quiero cotizar un proyecto con PAVIC en {ciudad}.', noteExtra: ' Para obras grandes, pide tu cotización con ejecutivo de proyectos.' })}
</div></section>

<section class="section dark" id="calidad"><div class="wrap split">
  <div><span class="eyebrow">Calidad y documentación</span><h2 style="margin-block:12px 18px">Respaldo técnico para tu licitación</h2>
    <p class="lead">PAVIC cuenta con certificados de calidad, ensayos de laboratorio y certificación ISO. Solicita la documentación y un ejecutivo te la envía.</p></div>
  <div class="on-dark">${leadForm({ asunto: 'Solicitud de documentación técnica PAVIC', boton: 'Solicitar documentación', campos:
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
    <div class="three" style="grid-template-columns:1fr 1fr;margin-top:16px"><div style="background:#2a2725;border-color:#3a3633;color:#fff"><h3 style="color:#fff">INCERPAZ</h3><p style="color:#cfc9c2">Ladrillos, revestimientos y piezas especiales.</p><a class="btn btn--sm btn--ghost" style="color:#fff" href="catalogo.html">Ver productos</a></div><div style="background:#2a2725;border-color:#3a3633;color:#fff"><h3 style="color:#fff">PAVIC</h3><p style="color:#cfc9c2">Pavimento cerámico para proyectos.</p><a class="btn btn--sm btn--ghost" style="color:#fff" href="pavic.html">Ir a PAVIC</a></div></div></div>
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

/* ============================ 404, sitemap, robots ============================ */
write('404.html', layout({
  file: '404.html', title: 'Página no encontrada | INCERPAZ', desc: 'La página que buscas no existe.',
  body: `<section class="section"><div class="wrap"><h1>No encontramos esa página</h1><p class="lead" style="margin-block:16px 28px">Puede que el enlace haya cambiado. Prueba desde el inicio o el catálogo.</p><div class="btn-row"><a class="btn btn--red" href="${sitio.dominio}/">Ir al inicio</a><a class="btn" href="${sitio.dominio}/catalogo.html">Ver productos</a></div></div></section>`
}));
const urls = ['', 'catalogo.html', 'pavic.html', 'donde-estamos.html', 'empresa.html', ...productos.map((p) => `productos/${p.slug}.html`)];
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${sitio.dominio}/${u}</loc></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${sitio.dominio}/sitemap.xml\n`);
console.log(`Sitio generado: ${urls.length} páginas en ${path.relative(ROOT, OUT)}/`);
