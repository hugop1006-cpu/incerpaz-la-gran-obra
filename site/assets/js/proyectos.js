/* INCERPAZ — proyectos: calcula la lista de materiales, el costo (con cuenta verificada) y dibuja un esquema referencial. */
(function () {
  'use strict';
  var raw = document.getElementById('datos-proyecto'); if (!raw) return;
  var D = JSON.parse(raw.textContent), P = D.proyecto;
  var BASE = document.body.getAttribute('data-base') || '';
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmt = function (n, d) { return Number(n).toLocaleString('es-BO', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); };
  var m2 = function (n) { return fmt(n, 2) + ' m²'; };
  function ciudad() { try { var s = localStorage.getItem('incerpaz_ciudad'); return D.ciudades.filter(function (c) { return c.slug === s; })[0] || D.ciudades[0]; } catch (e) { return D.ciudades[0]; } }
  var catalogoDe = function (c) { return c.slug === 'santa-cruz' ? 'santa-cruz' : 'cochabamba'; };
  var NOMBRE_CAT = { cochabamba: 'Cochabamba', 'santa-cruz': 'Santa Cruz' };
  var V = {}; P.parametros.forEach(function (p) { V[p.id] = p.valor; });
  var eleccion = P.eleccion ? P.eleccion.opciones[0] : null;
  var filas = [];

  /* superficies de cada proyecto: de aquí salen las cantidades */
  var AREAS = {
    churrasquero: function (v) {
      var a = v.ancho, f = v.fondo, hb = v.alto_base, hc = v.alto_chimenea;
      return { muros: (2 * f + a) * hb + 1.8 * hc, hogar: (2 * (f - 0.2) + (a - 0.2)) * 0.4 + (a - 0.2) * (f - 0.2), losa: (a + 0.2) * (f + 0.2) };
    },
    'meson-con-enchape': function (v) {
      return { base: (v.largo + 2 * v.fondo) * v.alto, enchape: (v.largo + v.extremos * v.fondo) * v.alto, tapa: v.largo * (v.fondo + 0.03), pilares: Math.ceil(v.largo / 2) + 1 };
    },
    'pared-con-enchape': function (v) { return { pared: Math.max(0, v.ancho * v.alto - v.vanos), arranque: v.ancho }; }
  };

  /* ---------- esquemas referenciales ---------- */
  var INK = '#1a1716', LAD = '#c9633a', LAD2 = '#e0a487', FONDO = '#f3efe9';
  var rect = function (x, y, w, h, fill, stroke, extra) { return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + Math.max(0, w).toFixed(1) + '" height="' + Math.max(0, h).toFixed(1) + '" fill="' + (fill || 'none') + '" stroke="' + (stroke || INK) + '" stroke-width="1.5" ' + (extra || '') + '/>'; };
  var line = function (x1, y1, x2, y2, c, w, d) { return '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="' + (c || INK) + '" stroke-width="' + (w || 1) + '"' + (d ? ' stroke-dasharray="' + d + '"' : '') + '/>'; };
  var txt = function (x, y, t, anchor, rot) { return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" font-size="13" font-family="Barlow,sans-serif" fill="' + INK + '" text-anchor="' + (anchor || 'middle') + '"' + (rot ? ' transform="rotate(' + rot + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')"' : '') + '>' + t + '</text>'; };
  function cotaH(x, y, w, t) { return line(x, y, x + w, y, INK, 1) + line(x, y - 4, x, y + 4) + line(x + w, y - 4, x + w, y + 4) + txt(x + w / 2, y + 16, t); }
  function cotaV(x, y, h, t) { return line(x, y, x, y + h, INK, 1) + line(x - 4, y, x + 4, y) + line(x - 4, y + h, x + 4, y + h) + txt(x - 8, y + h / 2, t, 'middle', -90); }
  var cm = function (m) { return fmt(m * 100) + ' cm'; };
  function svg(w, h, cuerpo, titulo) { return '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(titulo) + '" xmlns="http://www.w3.org/2000/svg">' + cuerpo + '</svg>'; }
  function ladrillos(x, y, w, h, esc_, hil, lar) { /* pared con hiladas trabadas */
    var s = rect(x, y, w, h, LAD2), nH = Math.min(70, Math.max(1, Math.round(h / (hil * esc_))));
    var alto = h / nH, largo = lar * esc_;
    for (var i = 1; i < nH; i++) s += line(x, y + i * alto, x + w, y + i * alto, '#fff', 1);
    for (var j = 0; j < nH; j++) for (var k = (j % 2 ? largo / 2 : largo); k < w; k += largo) s += line(x + k, y + j * alto, x + k, y + (j + 1) * alto, '#fff', 1);
    return s + rect(x, y, w, h, 'none');
  }
  var DIBUJOS = {
    churrasquero: function (v) {
      var a = v.ancho, f = v.fondo, hb = v.alto_base, hc = v.alto_chimenea, W = 640, H = 360;
      var e = Math.min(280 / a, 270 / (hb + hc)), x0 = 50, yb = 320 - hb * e, s = '';
      var camp = Math.min(0.35, hc * 0.4), cw = 0.45, cx = x0 + (a - cw) * e / 2, top = yb - hc * e;
      s += rect(x0, yb, a * e, hb * e, LAD);
      s += rect(x0 + 0.1 * e, yb + (hb - 0.5) * e, (a - 0.2) * e, 0.4 * e, '#3b2a22');
      s += line(x0 + 0.1 * e, yb + (hb - 0.25) * e, x0 + (a - 0.1) * e, yb + (hb - 0.25) * e, '#cfc9c2', 2);
      s += '<polygon points="' + x0 + ',' + yb + ' ' + (x0 + a * e) + ',' + yb + ' ' + (cx + cw * e) + ',' + (yb - camp * e) + ' ' + cx + ',' + (yb - camp * e) + '" fill="' + LAD + '" stroke="' + INK + '" stroke-width="1.5"/>';
      s += rect(cx, top, cw * e, (hc - camp) * e, LAD);
      s += cotaH(x0, 338, a * e, cm(a)) + cotaV(x0 - 14, yb, hb * e, cm(hb)) + cotaV(x0 + a * e + 24, top, (hb + hc) * e, cm(hb + hc));
      s += txt(x0 + (a * e) / 2, 24, 'Vista frontal', 'middle');
      var pl = Math.min(240 / a, 220 / f), px = 380, py = 70;
      s += txt(px + (a * pl) / 2, 24, 'Planta', 'middle');
      s += rect(px, py, a * pl, f * pl, LAD) + rect(px + 0.1 * pl, py + 0.1 * pl, (a - 0.2) * pl, (f - 0.2) * pl, '#3b2a22');
      s += rect(px + 0.1 * pl, py + 0.1 * pl, (a - 0.2) * pl, (f - 0.2) * pl, 'none', '#cfc9c2', 'stroke-dasharray="4 3"');
      s += cotaH(px, py + f * pl + 22, a * pl, cm(a)) + cotaV(px - 14, py, f * pl, cm(f));
      return svg(W, H, s, 'Esquema del churrasquero');
    },
    'meson-con-enchape': function (v) {
      var l = v.largo, f = v.fondo, h = v.alto, W = 640, H = 330;
      var e = Math.min(330 / l, 200 / h), x0 = 40, yb = 280 - h * e, s = '';
      s += ladrillos(x0, yb, l * e, (h - 0.04) * e, e, 0.075, 0.2) + rect(x0 - 0.03 * e, yb - 0.04 * e, (l + 0.06) * e, 0.04 * e, '#5b4a40');
      s += cotaH(x0, 300, l * e, cm(l)) + cotaV(x0 - 16, yb - 0.04 * e, h * e, cm(h));
      s += txt(x0 + (l * e) / 2, 24, 'Vista frontal', 'middle');
      var pl = Math.min(220 / l, 160 / f), px = 420, py = 90;
      s += txt(px + (l * pl) / 2, 24, 'Planta', 'middle') + rect(px, py, l * pl, f * pl, LAD2) + rect(px - 0.03 * pl, py - 0.03 * pl, (l + 0.06) * pl, (f + 0.06) * pl, 'none', '#5b4a40', 'stroke-dasharray="5 3"');
      s += cotaH(px, py + f * pl + 22, l * pl, cm(l)) + cotaV(px - 14, py, f * pl, cm(f));
      s += txt(px + (l * pl) / 2, py + (f * pl) / 2 + 5, 'tapa', 'middle');
      return svg(W, H, s, 'Esquema del mesón');
    },
    'pared-con-enchape': function (v) {
      var a = v.ancho, h = v.alto, W = 640, H = 330, e = Math.min(520 / a, 240 / h), x0 = 60, y0 = 36, s = '';
      s += ladrillos(x0, y0, a * e, h * e, e, 0.075, 0.2);
      if (v.vanos > 0) { var vh = Math.min(h * 0.9, Math.sqrt(v.vanos * 1.4)), vw = Math.min(a * 0.9, v.vanos / vh); s += rect(x0 + (a - vw) / 2 * e, y0 + (h - vh) * e, vw * e, vh * e, FONDO, INK, 'stroke-dasharray="5 3"') + txt(x0 + a * e / 2, y0 + (h - vh / 2) * e + 5, 'vanos ' + m2(v.vanos)); }
      s += cotaH(x0, y0 + h * e + 18, a * e, cm(a)) + cotaV(x0 - 14, y0, h * e, cm(h));
      return svg(W, H, s, 'Esquema de la pared');
    }
  };

  /* ---------- formulario ---------- */
  function campos() {
    var cat = catalogoDe(ciudad());
    var html = P.parametros.map(function (p) {
      if (p.opciones) return '<label>' + esc(p.etiqueta) + '<select data-par="' + p.id + '">' + p.opciones.map(function (o) { return '<option value="' + o[0] + '"' + (String(o[0]) === String(V[p.id]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>';
      return '<label>' + esc(p.etiqueta) + (p.unidad ? ' (' + p.unidad + ')' : '') + '<input type="number" inputmode="decimal" data-par="' + p.id + '" min="' + p.min + '" max="' + p.max + '" step="' + p.paso + '" value="' + V[p.id] + '"></label>';
    }).join('');
    if (P.eleccion) {
      var disp = P.eleccion.opciones.filter(function (s) { return D.catalogos[cat][s]; });
      if (disp.length && disp.indexOf(eleccion) < 0) eleccion = disp[0];
      html += '<label class="full">' + esc(P.eleccion.etiqueta) + '<select data-eleccion>' + (disp.length ? disp.map(function (s) { return '<option value="' + s + '"' + (s === eleccion ? ' selected' : '') + '>' + esc(D.catalogos[cat][s].nombre) + '</option>'; }).join('') : '<option>No disponible en este catálogo</option>') + '</select></label>';
    }
    $('#proy-campos').innerHTML = html;
    Array.prototype.forEach.call(document.querySelectorAll('[data-par]'), function (i) { i.addEventListener('input', function () { var n = parseFloat(String(i.value).replace(',', '.')); if (!isNaN(n)) { V[i.getAttribute('data-par')] = n; calcular(); } }); });
    var s = document.querySelector('[data-eleccion]'); if (s) s.addEventListener('change', function () { eleccion = s.value; calcular(); });
  }

  /* ---------- cálculo y tabla ---------- */
  var precios = null, verificado = false;
  function acotar() { /* mantiene los valores dentro del rango sin pisar lo que el usuario escribe */
    var v = {}; P.parametros.forEach(function (p) { var n = Number(V[p.id]); v[p.id] = p.opciones ? n : Math.min(p.max, Math.max(p.min, isFinite(n) ? n : p.valor)); }); return v;
  }
  function calcular() {
    var c = ciudad(), cat = catalogoDe(c), v = acotar(), A = AREAS[P.slug](v);
    $('#proy-plano').innerHTML = DIBUJOS[P.slug](v) + '<figcaption>Esquema referencial en proporción a tus medidas. No es un plano constructivo.</figcaption>';
    filas = P.materiales.map(function (m) {
      var fila = { grupo: m.grupo, nombre: m.nombre, unidad: m.unidad || 'piezas', merma: m.merma };
      if (m.fijo) { fila.cantidad = m.fijo; return fila; }
      var area = A[m.area] || 0;
      if (m.producto || m.eleccion) {
        var slug = m.eleccion ? eleccion : (m.producto[cat] || null), info = slug && D.catalogos[cat][slug];
        if (!info) { fila.noDisponible = true; return fila; }
        fila.slug = slug; fila.info = info; fila.cantidad = Math.ceil(area * info.rend * (1 + m.merma) - 1e-9);
        return fila;
      }
      var q = area * m.por_m2 * (1 + (m.merma || 0)); fila.cantidad = m.decimales ? Math.round(q * Math.pow(10, m.decimales)) / Math.pow(10, m.decimales) : Math.ceil(q - 1e-9);
      fila.dec = m.decimales || 0; return fila;
    });
    $('#proy-estado').textContent = 'Cantidades para ' + NOMBRE_CAT[cat] + ' con el rendimiento de las fichas técnicas. Superficie principal: ' + m2(A.muros || A.base || A.pared || 0) + '.';
    tabla(cat); acciones(c, cat);
  }
  function tabla(cat) {
    var conPrecio = verificado && precios;
    var total = 0, falta = false, grupo = '', h = '<div class="scroll"><table class="tabla"><thead><tr><th>Material</th><th class="num">Cantidad</th><th>Unidad</th>' + (conPrecio ? '<th class="num">Precio</th><th class="num">Subtotal</th>' : '') + '</tr></thead><tbody>';
    filas.forEach(function (f) {
      if (f.grupo !== grupo) { grupo = f.grupo; h += '<tr class="grupo"><th colspan="' + (conPrecio ? 5 : 3) + '">' + esc(grupo) + '</th></tr>'; }
      var nombre = esc(f.nombre) + (f.info ? '<br><a class="muted" href="' + BASE + 'productos/' + cat + '/' + f.slug + '.html">' + esc(f.info.nombre) + '</a>' : '');
      if (f.noDisponible) { h += '<tr class="fuera"><td>' + nombre + '</td><td colspan="' + (conPrecio ? 4 : 2) + '">No está en el catálogo de ' + NOMBRE_CAT[cat] + '. Consulta con tu agencia.</td></tr>'; return; }
      h += '<tr><td>' + nombre + '</td><td class="num"><b>' + fmt(f.cantidad, f.dec || 0) + '</b></td><td>' + esc(f.unidad) + '</td>';
      if (conPrecio) {
        var pr = f.slug && precios.precios ? precios.precios[f.slug] : null;
        if (f.info && typeof pr === 'number') { var sub = pr * f.cantidad; total += sub; h += '<td class="num">' + window.IncerpazPresupuesto.fmtBs(pr) + '</td><td class="num">' + window.IncerpazPresupuesto.fmtBs(sub) + '</td>'; }
        else { if (f.info) falta = true; h += '<td class="num muted" colspan="2">' + (f.info ? 'Por cotizar' : 'Fuera de INCERPAZ') + '</td>'; }
      }
      h += '</tr>';
    });
    h += '</tbody>' + (conPrecio ? '<tfoot><tr><th colspan="4">Total de la cerámica INCERPAZ' + (falta ? ' (parcial)' : '') + '</th><th class="num">' + window.IncerpazPresupuesto.fmtBs(total) + '</th></tr></tfoot>' : '') + '</table></div>';
    h += conPrecio ? '<p class="price-note">' + (precios.nota ? esc(precios.nota) + ' ' : '') + 'Los demás materiales los compras aparte: aquí solo se muestra la cantidad estimada.</p>'
      : '<p class="price-note">' + (window.IncerpazPresupuesto ? '<a href="' + BASE + 'ingresar.html?volver=' + encodeURIComponent('proyectos/' + P.slug + '.html') + '">Ingresa</a> o <a href="' + BASE + 'registro.html">crea una cuenta</a> para ver el costo de la cerámica. ' : '') + 'También puedes pedir la cotización por WhatsApp.</p>';
    $('#proy-lista').innerHTML = h;
  }
  function acciones(c, cat) {
    var box = $('#proy-acciones'), items = filas.filter(function (f) { return f.info; });
    var msg = 'Hola, quiero cotizar en ' + c.nombre + ' los materiales de "' + P.titulo + '":\n' + items.map(function (f) { return '- ' + fmt(f.cantidad) + ' piezas de ' + f.info.nombre; }).join('\n');
    var h = '<a class="btn btn--wa" target="_blank" rel="noopener" href="https://wa.me/591' + c.whatsapp + '?text=' + encodeURIComponent(msg) + '">Cotizar por WhatsApp</a>';
    if (window.IncerpazPresupuesto && items.length) h += '<button class="btn btn--red" type="button" id="proy-add">Añadir al presupuesto</button>';
    h += '<button class="btn" type="button" id="proy-print">Imprimir la lista</button>';
    box.innerHTML = h; box.hidden = false;
    var add = $('#proy-add'); if (add) add.addEventListener('click', function () {
      items.forEach(function (f) { window.IncerpazPresupuesto.añadir({ ciudad: cat, slug: f.slug, nombre: f.info.nombre, codigo: f.info.codigo }, f.cantidad); });
      window.IncerpazPresupuesto.aviso('Agregamos ' + items.length + ' productos al presupuesto');
      var n = document.querySelector('[data-bcount]'); if (n) { try { n.textContent = JSON.parse(localStorage.getItem('incerpaz_presupuesto')).items.length; } catch (e) { /* sin contador */ } }
    });
    $('#proy-print').addEventListener('click', function () { window.print(); });
  }

  /* ---------- arranque ---------- */
  campos(); calcular();
  document.addEventListener('incerpaz:city', function () { campos(); calcular(); recargarPrecios(); });
  function recargarPrecios() {
    var api = window.IncerpazPresupuesto; if (!api) return;
    api.sesion.then(function (s) {
      verificado = api.verificado(s.usuario); precios = null;
      if (!verificado) return calcular();
      api.precios(catalogoDe(ciudad())).then(function (r) { precios = r; calcular(); });
    });
  }
  /* comercio.js se carga después de este script: espera a que exponga la API */
  var intentos = 0, espera = setInterval(function () { if (window.IncerpazPresupuesto || ++intentos > 40) { clearInterval(espera); recargarPrecios(); } }, 100);
})();
