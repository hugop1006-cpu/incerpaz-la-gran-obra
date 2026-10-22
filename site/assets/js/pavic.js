/* INCERPAZ — recursos técnicos PAVIC: ficha, cantidades, sección típica, texto para pliegos y DXF de la pieza. */
(function () {
  'use strict';
  var raw = document.getElementById('datos-pavic'); if (!raw) return;
  var D = JSON.parse(raw.textContent);
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmt = function (n, d) { return Number(n).toLocaleString('es-BO', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); };
  var NOMBRE = { cochabamba: 'Cochabamba', 'santa-cruz': 'Santa Cruz' };
  var BASE = document.body.getAttribute('data-base') || '';
  function ciudadSitio() { try { var s = localStorage.getItem('incerpaz_ciudad'); return D.ciudades.filter(function (c) { return c.slug === s; })[0] || D.ciudades[0]; } catch (e) { return D.ciudades[0]; } }
  var catalogoDe = function (c) { return c.slug === 'santa-cruz' ? 'santa-cruz' : 'cochabamba'; };
  var selCiudad = $('#pv-ciudad'), selPieza = $('#pv-pieza'), selVar = $('#pv-var');
  var st = { pieza: null, calc: null };

  function piezas() { return D.piezas.filter(function (p) { return p.ciudad === selCiudad.value && p.m2 && p.alto && p.largo && p.ancho; }); }
  function llenarPiezas() {
    var l = piezas();
    selPieza.innerHTML = l.map(function (p) { return '<option value="' + p.slug + '">' + esc(p.nombre) + '</option>'; }).join('');
  }
  function actual() { return piezas().filter(function (p) { return p.slug === selPieza.value; })[0]; }
  function llenarVariantes(p) {
    selVar.innerHTML = p.variantes.map(function (v, i) { return '<option value="' + i + '">' + fmt(v.rend, 2) + ' piezas por m²' + (v.etiqueta ? ' · ' + esc(v.etiqueta.toLowerCase()) : '') + '</option>'; }).join('');
  }

  /* ---------- ficha ---------- */
  function ficha(p) {
    var v = p.variantes[0], kgm2 = p.peso ? v.rend * p.peso : null;
    var filas = [['Código', p.codigo || '—'], ['Línea', p.linea], ['Color', p.color || '—'], ['Medidas (alto × largo × ancho)', fmt(p.alto, 1) + ' × ' + fmt(p.largo, 1) + ' × ' + fmt(p.ancho, 1) + ' cm'], ['Peso por pieza', p.peso ? fmt(p.peso, 2) + ' kg' : '—'],
      ['Rendimiento', p.variantes.map(function (x) { return fmt(x.rend, 2) + ' piezas/m²' + (x.etiqueta ? ' (' + esc(x.etiqueta.toLowerCase()) + ')' : ''); }).join('<br>')], ['Peso por m²', kgm2 ? fmt(kgm2, 1) + ' kg/m²' : '—']];
    $('#pv-ficha').innerHTML = '<div class="scroll"><table class="tabla"><tbody>' + filas.map(function (f) { return '<tr><th style="width:42%;text-transform:none;letter-spacing:0;font-size:16px">' + f[0] + '</th><td>' + f[1] + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      (p.descripcion ? '<p class="muted" style="margin-top:12px">' + esc(p.descripcion) + '</p>' : '') + '<p style="margin-top:12px"><a class="btn btn--sm" href="' + BASE + 'productos/' + p.ciudad + '/' + p.slug + '.html">Ver la ficha completa</a></p>';
  }

  /* ---------- cantidades ---------- */
  function num(id) { var n = parseFloat(String($(id).value).replace(',', '.')); return isFinite(n) && n >= 0 ? n : 0; }
  function calcular() {
    var p = actual(); if (!p) return;
    var v = p.variantes[+selVar.value] || p.variantes[0], area = num('#pv-area'), merma = parseFloat($('#pv-merma').value), eb = num('#pv-base'), ec = num('#pv-cama');
    var pzas = Math.ceil(area * v.rend * (1 + merma) - 1e-9), kg = p.peso ? pzas * p.peso : null;
    var c = { pieza: p, v: v, area: area, merma: merma, pzas: pzas, kg: kg, base: area * eb / 100, arena: area * ec / 100, eb: eb, ec: ec };
    st.calc = c;
    $('#pv-resultado').innerHTML = '<div class="scroll"><table class="tabla"><thead><tr><th>Concepto</th><th class="num">Cantidad</th><th>Unidad</th></tr></thead><tbody>' +
      '<tr><td>Piezas ' + esc(p.nombre) + ' (con ' + fmt(merma * 100) + ' % de merma)</td><td class="num"><b>' + fmt(pzas) + '</b></td><td>piezas</td></tr>' +
      (kg ? '<tr><td>Peso de la cerámica</td><td class="num"><b>' + fmt(kg / 1000, 1) + '</b></td><td>toneladas</td></tr>' : '') +
      '<tr><td>Base granular (espesor ' + fmt(eb, 1) + ' cm)</td><td class="num"><b>' + fmt(c.base, 1) + '</b></td><td>m³ compactos</td></tr>' +
      '<tr><td>Cama de arena (espesor ' + fmt(ec, 1) + ' cm)</td><td class="num"><b>' + fmt(c.arena, 1) + '</b></td><td>m³</td></tr></tbody></table></div>' +
      '<p class="price-note">Los volúmenes de base y arena son geométricos: no incluyen esponjamiento, compactación ni arena de sello. El diseño del paquete estructural lo define el proyectista según el tráfico y el suelo.</p>';
    seccion(p, eb, ec); acciones(c);
  }
  function acciones(c) {
    var w = ciudadSitio(), msg = 'Hola, quiero cotizar un proyecto con PAVIC en ' + w.nombre + ': ' + fmt(c.area) + ' m² de ' + c.pieza.nombre + ' (' + fmt(c.pzas) + ' piezas con ' + fmt(c.merma * 100) + ' % de merma).';
    var h = '<a class="btn btn--wa" target="_blank" rel="noopener" href="https://wa.me/591' + w.whatsapp + '?text=' + encodeURIComponent(msg) + '">Cotizar por WhatsApp</a>';
    if (window.IncerpazPresupuesto) h += '<button class="btn btn--red" type="button" id="pv-add">Añadir al presupuesto</button>';
    h += '<button class="btn" type="button" id="pv-csv">Descargar cuadro (CSV)</button><button class="btn" type="button" id="pv-print">Imprimir</button>';
    $('#pv-acciones').innerHTML = h;
    var add = $('#pv-add'); if (add) add.addEventListener('click', function () {
      window.IncerpazPresupuesto.añadir({ ciudad: c.pieza.ciudad, slug: c.pieza.slug, nombre: c.pieza.nombre, codigo: c.pieza.codigo }, c.pzas);
      window.IncerpazPresupuesto.aviso('Agregamos ' + fmt(c.pzas) + ' piezas al presupuesto');
      var n = document.querySelector('[data-bcount]'); if (n) { try { n.textContent = JSON.parse(localStorage.getItem('incerpaz_presupuesto')).items.length; } catch (e) { /* sin contador */ } }
    });
    $('#pv-csv').addEventListener('click', function () {
      var l = [['Concepto', 'Cantidad', 'Unidad'], ['Piezas ' + c.pieza.nombre, c.pzas, 'piezas'], ['Superficie', c.area, 'm2'], ['Merma', c.merma * 100, '%']];
      if (c.kg) l.push(['Peso de la ceramica', Math.round(c.kg / 10) / 100, 't']);
      l.push(['Base granular (' + c.eb + ' cm)', Math.round(c.base * 10) / 10, 'm3'], ['Cama de arena (' + c.ec + ' cm)', Math.round(c.arena * 10) / 10, 'm3']);
      bajar('cuadro-pavic.csv', '﻿' + l.map(function (r) { return r.map(function (x) { return '"' + String(x).replace(/"/g, '""') + '"'; }).join(';'); }).join('\r\n'), 'text/csv;charset=utf-8');
    });
    $('#pv-print').addEventListener('click', function () { window.print(); });
  }
  function bajar(nombre, contenido, tipo) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([contenido], { type: tipo })); a.download = nombre; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ---------- sección típica ---------- */
  var INK = '#1a1716';
  function seccion(p, eb, ec) {
    var cap = [{ n: 'Subrasante compactada', e: 12, c: '#d9d2c7' }, { n: 'Base granular ' + fmt(eb, 1) + ' cm', e: Math.max(eb, 0.1), c: '#b9b2a8' }, { n: 'Cama de arena ' + fmt(ec, 1) + ' cm', e: Math.max(ec, 0.1), c: '#ead9a8' }, { n: p.nombre + ' (alto ' + fmt(p.alto, 1) + ' cm)', e: p.alto, c: '#c9633a' }];
    var total = cap.reduce(function (a, c) { return a + c.e; }, 0), H = 250, esc_ = (H - 50) / total, x0 = 40, w = 330, y = H - 14, s = '';
    cap.forEach(function (c) {
      var h = c.e * esc_; y -= h;
      s += '<rect x="' + x0 + '" y="' + y.toFixed(1) + '" width="' + w + '" height="' + h.toFixed(1) + '" fill="' + c.c + '" stroke="' + INK + '" stroke-width="1.2"/>';
      s += '<text x="' + (x0 + w + 12) + '" y="' + (y + h / 2 + 4).toFixed(1) + '" font-size="13" font-family="Barlow,sans-serif" fill="' + INK + '">' + esc(c.n) + '</text>';
    });
    var pw = 20 * (w / 130); /* juntas simbólicas en la capa de piezas */
    for (var k = x0 + pw; k < x0 + w - 2; k += pw) s += '<line x1="' + k.toFixed(1) + '" y1="' + (y).toFixed(1) + '" x2="' + k.toFixed(1) + '" y2="' + (y + p.alto * esc_).toFixed(1) + '" stroke="#fff" stroke-width="1.5"/>';
    $('#pv-seccion').innerHTML = '<svg viewBox="0 0 640 ' + H + '" role="img" aria-label="Sección típica del pavimento" xmlns="http://www.w3.org/2000/svg">' + s + '</svg><figcaption>Sección típica referencial, en proporción a los espesores que ingresaste. Falta el confinamiento lateral (bordillo), que define el proyecto.</figcaption>';
  }

  /* ---------- pieza: SVG, pliego y DXF ---------- */
  function piezaSvg(p) {
    var e = Math.min(260 / p.largo, 120 / p.ancho), s = '', x = 30, y = 24;
    s += '<text x="' + x + '" y="14" font-size="13" font-family="Barlow,sans-serif">Planta</text><rect x="' + x + '" y="' + y + '" width="' + (p.largo * e) + '" height="' + (p.ancho * e) + '" fill="#e0a487" stroke="' + INK + '" stroke-width="1.5"/>';
    var y2 = y + p.ancho * e + 46, e2 = e;
    s += '<text x="' + x + '" y="' + (y2 - 10) + '" font-size="13" font-family="Barlow,sans-serif">Elevación</text><rect x="' + x + '" y="' + y2 + '" width="' + (p.largo * e2) + '" height="' + (p.alto * e2) + '" fill="#c9633a" stroke="' + INK + '" stroke-width="1.5"/>';
    s += '<text x="' + (x + p.largo * e / 2) + '" y="' + (y + p.ancho * e + 18) + '" font-size="13" text-anchor="middle" font-family="Barlow,sans-serif">' + fmt(p.largo, 1) + ' cm</text>';
    s += '<text x="' + (x + p.largo * e + 8) + '" y="' + (y + p.ancho * e / 2 + 4) + '" font-size="13" font-family="Barlow,sans-serif">' + fmt(p.ancho, 1) + ' cm</text>';
    s += '<text x="' + (x + p.largo * e2 + 8) + '" y="' + (y2 + p.alto * e2 / 2 + 4) + '" font-size="13" font-family="Barlow,sans-serif">' + fmt(p.alto, 1) + ' cm</text>';
    var H = y2 + p.alto * e2 + 20;
    $('#pv-pieza-svg').innerHTML = '<svg viewBox="0 0 ' + (30 + p.largo * e + 70) + ' ' + H + '" role="img" aria-label="Planta y elevación de la pieza" xmlns="http://www.w3.org/2000/svg">' + s + '</svg>';
  }
  function pliego(p) {
    var v = p.variantes[0];
    var t = 'PAVIMENTO CERÁMICO PAVIC — ' + p.nombre.toUpperCase() + (p.codigo ? ' (código ' + p.codigo + ')' : '') + '\n\n' +
      'Descripción: ' + (p.descripcion || 'Pieza cerámica para pavimentos.') + '\n' +
      'Fabricante: INCERPAZ, marca PAVIC (fábrica de ' + NOMBRE[p.ciudad] + ').\n' +
      'Dimensiones nominales (alto × largo × ancho): ' + fmt(p.alto, 1) + ' × ' + fmt(p.largo, 1) + ' × ' + fmt(p.ancho, 1) + ' cm.\n' +
      (p.peso ? 'Peso nominal por pieza: ' + fmt(p.peso, 2) + ' kg.\n' : '') +
      (p.color ? 'Color: ' + p.color + '.\n' : '') +
      'Rendimiento: ' + p.variantes.map(function (x) { return fmt(x.rend, 2) + ' piezas por m²' + (x.etiqueta ? ' (' + x.etiqueta.toLowerCase() + ')' : ''); }).join('; ') + '.\n' +
      (p.peso ? 'Peso aproximado del pavimento colocado (sin base ni arena): ' + fmt(v.rend * p.peso, 1) + ' kg/m².\n' : '') +
      'Características de desempeño (resistencia mecánica, absorción y otras): según los certificados y ensayos de laboratorio entregados por el fabricante, que forman parte de esta especificación.\n' +
      'Colocación: sobre base y cama de arena definidas en el proyecto, con confinamiento lateral y juntas selladas con arena.';
    $('#pv-pliego').value = t; return t;
  }
  function dxf(p) {
    var ent = []; var linea = function (capa, x1, y1, x2, y2) { ent.push('0\nLINE\n8\n' + capa + '\n10\n' + x1 + '\n20\n' + y1 + '\n30\n0\n11\n' + x2 + '\n21\n' + y2 + '\n31\n0'); };
    var rect = function (capa, x, y, w, h) { linea(capa, x, y, x + w, y); linea(capa, x + w, y, x + w, y + h); linea(capa, x + w, y + h, x, y + h); linea(capa, x, y + h, x, y); };
    var texto = function (capa, x, y, t) { ent.push('0\nTEXT\n8\n' + capa + '\n10\n' + x + '\n20\n' + y + '\n30\n0\n40\n1.5\n1\n' + t); };
    rect('PLANTA', 0, 0, p.largo, p.ancho); texto('TEXTO', 0, p.ancho + 3, 'PAVIC ' + p.nombre + ' - planta (cm)');
    var oy = -(p.alto + 10); rect('ELEVACION', 0, oy, p.largo, p.alto); texto('TEXTO', 0, oy - 4, 'Elevacion - alto ' + p.alto + ' cm');
    return '0\nSECTION\n2\nENTITIES\n' + ent.join('\n') + '\n0\nENDSEC\n0\nEOF\n';
  }
  function pieza() {
    var p = actual(); if (!p) return; st.pieza = p;
    ficha(p); llenarVariantes(p); piezaSvg(p); pliego(p); calcular();
  }

  /* ---------- arranque ---------- */
  var c0 = catalogoDe(ciudadSitio()); selCiudad.value = c0;
  llenarPiezas(); pieza();
  selCiudad.addEventListener('change', function () { llenarPiezas(); pieza(); });
  selPieza.addEventListener('change', pieza);
  ['#pv-area', '#pv-base', '#pv-cama'].forEach(function (id) { $(id).addEventListener('input', calcular); });
  ['#pv-var', '#pv-merma'].forEach(function (id) { $(id).addEventListener('change', calcular); });
  document.addEventListener('incerpaz:city', function (e) { selCiudad.value = e.detail === 'santa-cruz' ? 'santa-cruz' : 'cochabamba'; llenarPiezas(); pieza(); });
  $('#pv-copiar').addEventListener('click', function () {
    var t = $('#pv-pliego'); t.select();
    (navigator.clipboard ? navigator.clipboard.writeText(t.value) : Promise.reject()).then(function () { aviso('Texto copiado'); }, function () { try { document.execCommand('copy'); aviso('Texto copiado'); } catch (e) { aviso('Selecciona el texto y copia con Ctrl+C'); } });
  });
  $('#pv-txt').addEventListener('click', function () { bajar('especificacion-pavic.txt', $('#pv-pliego').value, 'text/plain;charset=utf-8'); });
  $('#pv-dxf').addEventListener('click', function () { var p = actual(); if (p) bajar('pavic-' + p.slug + '.dxf', dxf(p), 'application/dxf'); });
  function aviso(t) { var el = $('#toast'); if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); } el.textContent = t; el.classList.add('on'); clearTimeout(aviso.t); aviso.t = setTimeout(function () { el.classList.remove('on'); }, 3000); }
  Array.prototype.forEach.call(document.querySelectorAll('[data-doc]'), function (b) {
    b.addEventListener('click', function () { var s = $('#pv-docsel'); if (s) { s.value = b.getAttribute('data-doc'); } var f = $('#solicitar'); if (f) f.scrollIntoView({ behavior: 'smooth' }); });
  });
})();
