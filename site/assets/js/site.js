/* INCERPAZ — comportamiento del sitio. Sin dependencias.
   Los formularios no necesitan servidor: sin LEAD_ENDPOINT abren WhatsApp con el mensaje armado.
   Para enviarlos a un CRM, define window.INCERPAZ.leadEndpoint en config.js del sitio. */
(function () {
  'use strict';
  var CFG = window.INCERPAZ || { ciudades: [], leadEndpoint: '' };
  var KEY = 'incerpaz_ciudad';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function cityBySlug(s) { return CFG.ciudades.filter(function (c) { return c.slug === s; })[0]; }
  function currentCity() { return cityBySlug(store(KEY)) || CFG.ciudades[0]; }
  function waUrl(num, msg) { return 'https://wa.me/591' + num + '?text=' + encodeURIComponent(msg); }
  function fmt(n) { return Math.round(n).toLocaleString('es-BO'); }
  function hoyLocal() { var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }

  /* páginas de ciudad (/cochabamba, /santa-cruz…): quien entra por ahí ya eligió su ciudad */
  var ciudadFija = document.body.getAttribute('data-ciudad-fija');
  if (ciudadFija && cityBySlug(ciudadFija)) store(KEY, ciudadFija);

  /* ---- ciudad y enlaces de WhatsApp ---- */
  function updateWa() {
    var c = currentCity();
    $$('[data-wa]').forEach(function (a) {
      var msg = a.getAttribute('data-wa').replace('{ciudad}', c.nombre);
      a.href = waUrl(a.getAttribute('data-wa-num') || c.whatsapp, msg);
      a.target = '_blank'; a.rel = 'noopener';
    });
    $$('[data-city-name]').forEach(function (e) { e.textContent = c.nombre; });
    $$('[data-tu-ciudad]').forEach(function (a) { a.href = (document.body.getAttribute('data-base') || '') + c.slug + '.html'; });
  }
  /* en el celular, el botón fijo de WhatsApp se aparta mientras la persona escribe en un formulario */
  function esCampo(el) { return !!(el && el.matches && el.matches('input, textarea, select')); }
  document.addEventListener('focusin', function (e) { if (esCampo(e.target)) document.body.classList.add('escribiendo'); });
  document.addEventListener('focusout', function () { setTimeout(function () { document.body.classList.toggle('escribiendo', esCampo(document.activeElement)); }, 0); });
  /* los formularios proponen la ciudad elegida mientras la persona no cambie ese campo */
  function syncFormCity() {
    var c = currentCity();
    $$('form[data-lead] select[name="ciudad"]').forEach(function (s) {
      if (s.getAttribute('data-tocado')) return;
      for (var i = 0; i < s.options.length; i++) if (s.options[i].text === c.nombre) { s.selectedIndex = i; break; }
    });
  }
  $$('form[data-lead] select[name="ciudad"]').forEach(function (s) { s.addEventListener('change', function () { s.setAttribute('data-tocado', '1'); }); });
  function setCity(slug) {
    if (!cityBySlug(slug)) return;
    store(KEY, slug);
    if (sel) sel.value = slug;
    updateWa(); syncFormCity(); syncTabs(slug);
    document.dispatchEvent(new CustomEvent('incerpaz:city', { detail: slug }));
  }
  var sel = $('#citySel');
  if (sel) {
    sel.innerHTML = CFG.ciudades.map(function (c) { return '<option value="' + c.slug + '">' + c.nombre + '</option>'; }).join('');
    sel.value = currentCity().slug;
    sel.addEventListener('change', function () { setCity(sel.value); });
  }
  updateWa(); syncFormCity();

  /* ---- primera visita: preguntar la ciudad una sola vez ----
     No se abre si ya hay ciudad guardada, si la persona la cerró en esta visita
     o si la dirección ya trae la ciudad (?ciudad=). Sin JavaScript no aparece. */
  var dlg = $('#cityDlg');
  if (dlg && typeof dlg.showModal === 'function') {
    var PREG = 'incerpaz_ciudad_preguntada';
    var yaPreguntada = function () { try { return sessionStorage.getItem(PREG); } catch (e) { return '1'; } };
    var marcar = function () { try { sessionStorage.setItem(PREG, '1'); } catch (e) { /* sin almacenamiento */ } };
    $$('[data-elegir-ciudad]', dlg).forEach(function (b) {
      b.addEventListener('click', function () { setCity(b.getAttribute('data-elegir-ciudad')); marcar(); dlg.close(); });
    });
    dlg.addEventListener('close', marcar);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    if (!cityBySlug(store(KEY)) && !yaPreguntada() && !/[?&]ciudad=/.test(location.search)) {
      try { dlg.showModal(); var pri = $('[data-elegir-ciudad]', dlg); if (pri) pri.focus(); } catch (e) { /* navegador sin soporte */ }
    }
  }

  /* ---- productos nuevos: la etiqueta vence sola, aunque el sitio no se regenere ese día ---- */
  (function () {
    var hoy = hoyLocal();
    $$('[data-nuevo-hasta]').forEach(function (el) {
      if (el.getAttribute('data-nuevo-hasta') >= hoy) return;
      if (el.classList.contains('tag')) { el.hidden = true; return; }
      el.removeAttribute('data-nuevo-hasta');
      if (el.hasAttribute('data-cats')) el.setAttribute('data-cats', el.getAttribute('data-cats').split(' ').filter(function (c) { return c !== 'nuevos'; }).join(' '));
    });
    var sec = $('#nuevos-home'); if (!sec) return;
    function pintarNuevos() {
      var cat = currentCity().slug === 'santa-cruz' ? 'santa-cruz' : 'cochabamba', n = 0;
      $$('.pcard', sec).forEach(function (c) { var ok = c.getAttribute('data-ciudad') === cat && c.hasAttribute('data-nuevo-hasta'); c.hidden = !ok; if (ok) n++; });
      sec.hidden = !n;
      var ver = $('[data-nuevos-ver]', sec); if (ver) ver.href = 'catalogo.html?ciudad=' + cat + '&cat=nuevos';
    }
    pintarNuevos();
    document.addEventListener('incerpaz:city', pintarNuevos);
  })();

  /* ---- proyectos: filtro por dificultad ---- */
  var chipsNivel = $$('[data-nivel-filtro]');
  if (chipsNivel.length) {
    var filtrarNivel = function (nivel) {
      var n = 0;
      $$('.proys [data-nivel]').forEach(function (c) { var ok = !nivel || c.getAttribute('data-nivel') === nivel; c.hidden = !ok; if (ok) n++; });
      chipsNivel.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-nivel-filtro') === nivel)); });
      var cuenta = $('[data-nivel-cuenta]'); if (cuenta) cuenta.textContent = n + (n === 1 ? ' proyecto' : ' proyectos');
    };
    chipsNivel.forEach(function (b) { b.addEventListener('click', function () { filtrarNivel(b.getAttribute('data-nivel-filtro')); }); });
    filtrarNivel('');
  }

  /* ---- menú móvil ---- */
  var tg = $('.nav-toggle'), nav = $('#nav');
  if (tg && nav) tg.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    tg.setAttribute('aria-expanded', String(open));
    /* en el celular la ciudad vive dentro del menú abierto */
    var hdr = $('.site-header'); if (hdr) hdr.classList.toggle('menu-abierto', open);
  });

  /* ---- buscador general ---- */
  function normTxt(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  var bAbrir = $('[data-buscar-abrir]'), bPanel = $('#buscador');
  if (bAbrir && bPanel) {
    var cerrarBuscador = function (volver) { bPanel.hidden = true; bAbrir.setAttribute('aria-expanded', 'false'); if (volver) bAbrir.focus(); };
    bAbrir.addEventListener('click', function (e) {
      e.preventDefault();
      var abrir = bPanel.hidden;
      bPanel.hidden = !abrir; bAbrir.setAttribute('aria-expanded', String(abrir));
      if (abrir) $('input', bPanel).focus();
    });
    bPanel.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrarBuscador(true); });
  }
  var bApp = $('#buscarApp'), bIn = $('#bq');
  if (bApp && bIn && $('#datos-buscar')) {
    var IDX = JSON.parse($('#datos-buscar').textContent);
    var GRUPOS = ['Productos', 'Proyectos', 'Guías', 'Promociones', 'Páginas'];
    var qIni = /[?&]q=([^&#]*)/.exec(location.search);
    if (qIni) bIn.value = decodeURIComponent(qIni[1].replace(/\+/g, ' '));
    var buscar = function () {
      var q = bIn.value.trim(), palabras = normTxt(q).split(/\s+/).filter(Boolean);
      if (window.history && history.replaceState) history.replaceState(null, '', location.pathname + (q ? '?q=' + encodeURIComponent(q) : ''));
      if (!palabras.length) { bApp.innerHTML = '<p class="muted">Escribe el nombre de un producto, un código, un proyecto o un tema.</p>'; return; }
      var cat = currentCity().slug === 'santa-cruz' ? 'santa-cruz' : 'cochabamba', hoy = hoyLocal(), ciu = currentCity().slug, otros = 0;
      var res = IDX.map(function (x) {
        var nom = normTxt(x.n), todo = nom + ' ' + normTxt(x.d) + ' ' + normTxt(x.k);
        if (!palabras.every(function (w) { return todo.indexOf(w) >= 0; })) return null;
        if (x.fin && !(x.ini <= hoy && hoy <= x.fin && (!x.ciu.length || x.ciu.indexOf(ciu) >= 0))) return null;
        if (x.c && x.c !== cat) { otros++; return null; }
        var puntos = palabras.reduce(function (s, w) { return s + (nom.indexOf(w) === 0 ? 3 : nom.indexOf(w) >= 0 ? 2 : 0); }, 0);
        return { x: x, p: puntos };
      }).filter(Boolean);
      if (!res.length) {
        bApp.innerHTML = '<div class="empty"><b>No encontramos «' + escH(q) + '».</b><p class="muted" style="margin-top:6px">Prueba otra palabra o escríbenos por WhatsApp con el nombre o una foto del producto y te ayudamos.</p>' +
          (otros ? '<p style="margin-top:8px">Hay ' + otros + ' resultado' + (otros === 1 ? '' : 's') + ' en el catálogo de ' + (cat === 'santa-cruz' ? 'Cochabamba' : 'Santa Cruz') + '. Cambia de ciudad arriba para verlos.</p>' : '') +
          '<div class="btn-row" style="margin-top:14px"><a class="btn btn--wa" data-wa="' + escH('Hola, busco «' + q + '» en {ciudad}. ¿Me ayudan?') + '" href="#">Preguntar por WhatsApp</a><a class="btn" href="catalogo.html">Ver el catálogo</a></div></div>';
        updateWa(); return;
      }
      var html = '<p class="muted" style="margin-bottom:18px">' + res.length + ' resultado' + (res.length === 1 ? '' : 's') + ' para «' + escH(q) + '» · productos del catálogo de ' + (cat === 'santa-cruz' ? 'Santa Cruz' : 'Cochabamba') + '</p>';
      GRUPOS.forEach(function (g) {
        var r = res.filter(function (y) { return y.x.t === g; }).sort(function (a, b) { return b.p - a.p; });
        if (!r.length) return;
        html += '<section class="bres"><h2>' + g + ' <span class="muted">(' + r.length + ')</span></h2><ul>' + r.map(function (y) {
          return '<li><a href="' + escH(y.x.u) + '"><b>' + escH(y.x.n) + '</b>' + (y.x.d ? '<span>' + escH(y.x.d) + '</span>' : '') + '</a></li>';
        }).join('') + '</ul></section>';
      });
      bApp.innerHTML = html;
    };
    var bT; bIn.addEventListener('input', function () { clearTimeout(bT); bT = setTimeout(buscar, 150); });
    $('.buscar-pag').addEventListener('submit', function (e) { e.preventDefault(); buscar(); });
    document.addEventListener('incerpaz:city', buscar);
    buscar();
  }

  /* ---- calculadoras ---- */
  $$('[data-calc]').forEach(function (box) {
    var area = $('[data-calc-area]', box), merma = $('[data-calc-merma]', box), prod = $('[data-calc-prod]', box), unit = $('[data-calc-unit]', box);
    var wa = $('[data-calc-wa]', box);
    function run() {
      var o = prod.options[prod.selectedIndex];
      var rend = parseFloat(o.getAttribute('data-rend')), peso = parseFloat(o.getAttribute('data-peso')) || 0, u = o.getAttribute('data-unidad') || 'm2';
      var a = Math.max(0, parseFloat(String(area.value).replace(',', '.')) || 0);
      var pzas = Math.ceil(a * rend * (1 + parseFloat(merma.value)));
      if (unit) unit.textContent = u === 'ml' ? 'Metros lineales' : 'Superficie (m²)';
      $('[data-out="pzas"]', box).textContent = fmt(pzas);
      var kg = pzas * peso;
      var k = $('[data-out="kg"]', box), t = $('[data-out="ton"]', box);
      if (k) k.textContent = peso ? fmt(kg) : '—';
      if (t) t.textContent = peso ? (kg / 1000).toLocaleString('es-BO', { maximumFractionDigits: 1 }) : '—';
      if (wa) {
        wa.setAttribute('data-wa', 'Hola, calculé ' + fmt(pzas) + ' piezas de ' + o.getAttribute('data-nombre') + ' para ' + (a.toLocaleString('es-BO')) + (u === 'ml' ? ' metros lineales' : ' m²') + ' y quiero cotizar en {ciudad}.');
        updateWa();
      }
    }
    [area, merma, prod].forEach(function (e) { e.addEventListener('input', run); e.addEventListener('change', run); });
    run();
  });

  /* ---- catálogo: ciudad, filtros y búsqueda ---- */
  var grid = $('#grid');
  if (grid) {
    var chips = $$('[data-cat]'), cityChips = $$('[data-catalogo]'), q = $('#q'), cards = $$('.pcard', grid), count = $('#count'), empty = $('#empty'), nota = $('#catNota');
    var cat = 'todas';
    var m = /[?&]cat=([^&]+)/.exec(location.search); if (m) cat = decodeURIComponent(m[1]);
    var mc = /[?&]ciudad=([^&]+)/.exec(location.search);
    var enCatalogo = function (slug) { return slug === 'santa-cruz' ? 'santa-cruz' : 'cochabamba'; };
    var catCity = mc ? decodeURIComponent(mc[1]) : enCatalogo(currentCity().slug);
    function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
    /* ordenar: «Orden del catálogo» (el original), por nombre o por categoría; los combos van siempre primero */
    var ordenSel = $('#orden'), original = cards.slice();
    function ordenar() {
      var modo = ordenSel ? ordenSel.value : '';
      var lista = original.slice();
      if (modo) {
        var porNombre = function (a, b) { return (a.getAttribute('data-nombre') || '').localeCompare(b.getAttribute('data-nombre') || '', 'es', { sensitivity: 'base', numeric: true }); };
        lista.sort(function (a, b) {
          var ca = a.hasAttribute('data-fin') ? 0 : 1, cb = b.hasAttribute('data-fin') ? 0 : 1;
          if (ca !== cb) return ca - cb;
          if (modo === 'categoria') { var d = (+a.getAttribute('data-orden-cat') || 0) - (+b.getAttribute('data-orden-cat') || 0); if (d) return d; }
          return porNombre(a, b);
        });
      }
      lista.forEach(function (c) { grid.appendChild(c); });
    }
    if (ordenSel) ordenSel.addEventListener('change', function () { ordenar(); });
    function apply() {
      var term = norm(q.value.trim()), n = 0, hoy = hoyLocal(), ciudadSel = currentCity().slug;
      cards.forEach(function (c) {
        var ok = c.getAttribute('data-ciudad') === catCity && (cat === 'todas' || c.getAttribute('data-cats').split(' ').indexOf(cat) >= 0) && norm(c.getAttribute('data-name')).indexOf(term) >= 0;
        /* los combos solo se ven dentro de su vigencia y en las ciudades donde se ofrecen */
        if (ok && c.hasAttribute('data-fin')) {
          var ciu = (c.getAttribute('data-ciudades') || '').split(' ').filter(Boolean);
          ok = c.getAttribute('data-inicio') <= hoy && hoy <= c.getAttribute('data-fin') && (!ciu.length || ciu.indexOf(ciudadSel) >= 0);
        }
        c.hidden = !ok; if (ok) n++;
      });
      chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.getAttribute('data-cat') === cat)); });
      cityChips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.getAttribute('data-catalogo') === catCity)); });
      count.textContent = n + (n === 1 ? ' producto' : ' productos');
      empty.hidden = n !== 0;
      var sel = currentCity().slug;
      if (sel === 'oruro' || sel === 'sucre') { nota.hidden = false; nota.textContent = 'En ' + currentCity().nombre + ' atendemos con el catálogo de la fábrica más cercana. Confirma la disponibilidad con tu agencia.'; } else { nota.hidden = true; }
    }
    chips.forEach(function (c) { c.addEventListener('click', function () { cat = c.getAttribute('data-cat'); apply(); }); });
    cityChips.forEach(function (c) { c.addEventListener('click', function () { catCity = c.getAttribute('data-catalogo'); apply(); }); });
    q.addEventListener('input', apply);
    document.addEventListener('incerpaz:city', function (e) { catCity = enCatalogo(e.detail); apply(); });
    apply();
  }

  /* ---- comparador de productos ----
     Hasta 4 productos del mismo catálogo, guardados en el navegador como [{id: "ciudad:slug", nombre}].
     La página comparar.html arma la tabla con los datos que trae embebidos (sin precios: esos los pinta comercio.js). */
  var CMP = 'incerpaz_comparar', CMP_MAX = 4;
  function escH(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function leerCmp() {
    try { var v = JSON.parse(store(CMP) || '[]'); return Array.isArray(v) ? v.filter(function (x) { return x && typeof x.id === 'string' && x.nombre; }).slice(0, CMP_MAX) : []; } catch (e) { return []; }
  }
  function guardarCmp(l) { store(CMP, JSON.stringify(l)); }
  function catalogoDe(id) { return id.split(':')[0]; }
  var tray = $('#cmpTray');
  function pintarCmp(msg) {
    var l = leerCmp();
    $$('[data-comparar]').forEach(function (b) {
      var on = l.some(function (x) { return x.id === b.getAttribute('data-comparar'); });
      b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '✓ Comparando' : 'Comparar';
    });
    if (!tray) return;
    tray.hidden = !l.length && !msg;
    var txt = $('[data-cmp-txt]', tray), ir = $('[data-cmp-ir]', tray);
    txt.textContent = msg || (l.length === 1 ? '1 producto elegido. Elige otro para comparar.' : l.length + ' productos para comparar');
    ir.hidden = l.length < 2;
    ir.textContent = 'Comparar (' + l.length + ')';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-comparar]') : null;
    if (b) {
      e.preventDefault();
      var id = b.getAttribute('data-comparar'), l = leerCmp(), i = -1;
      l.forEach(function (x, k) { if (x.id === id) i = k; });
      if (i >= 0) { l.splice(i, 1); guardarCmp(l); pintarCmp(); return; }
      if (l.length && catalogoDe(l[0].id) !== catalogoDe(id)) {
        if (!window.confirm('Solo se comparan productos del mismo catálogo. ¿Empezar una nueva comparación con este producto?')) return;
        l = [];
      }
      if (l.length >= CMP_MAX) { pintarCmp('Puedes comparar hasta ' + CMP_MAX + ' productos. Quita uno para agregar otro.'); return; }
      l.push({ id: id, nombre: b.getAttribute('data-nombre') || id }); guardarCmp(l); pintarCmp();
      return;
    }
    if (e.target.closest && e.target.closest('[data-cmp-vaciar]')) { guardarCmp([]); pintarCmp(); renderCmp(); }
  });

  var cmpApp = $('#cmpApp'), cmpDatos = null, soloDif = false;
  /* «Volver» genérico: si se llegó desde otra página del sitio se regresa a ella (con sus filtros y su posición); si no, vale el enlace */
  $$('a[data-volver]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var ref = document.referrer || '';
      var sinParams = function (u) { return u.split('#')[0].split('?')[0]; };
      if (ref.indexOf(location.origin) === 0 && sinParams(ref) !== sinParams(location.href) && window.history.length > 1) { e.preventDefault(); window.history.back(); }
    });
  });
  /* «Volver al catálogo»: si se llegó desde el catálogo se regresa a él tal cual (con sus filtros); si no, se abre el catálogo de los productos elegidos */
  var volverCmp = $('[data-cmp-volver]');
  if (volverCmp) volverCmp.addEventListener('click', function (e) {
    var ref = document.referrer || '';
    if (ref.indexOf(location.origin) === 0 && /catalogo\.html/.test(ref) && window.history.length > 1) { e.preventDefault(); window.history.back(); }
  });
  if (cmpApp && $('#datos-comparar')) {
    cmpDatos = JSON.parse($('#datos-comparar').textContent);
    var porId = {}; cmpDatos.productos.forEach(function (p) { porId[p.id] = p; });
    var qp = /[?&]p=([^&#]+)/.exec(location.search);
    if (qp) {
      var ids = decodeURIComponent(qp[1]).split(',').filter(function (id) { return porId[id]; });
      ids = ids.filter(function (id, k) { return ids.indexOf(id) === k && catalogoDe(id) === catalogoDe(ids[0]); }).slice(0, CMP_MAX);
      if (ids.length) guardarCmp(ids.map(function (id) { return { id: id, nombre: porId[id].nombre }; }));
    }
    cmpApp.addEventListener('click', function (e) {
      var q = e.target.closest('[data-cmp-quitar]');
      if (q) { guardarCmp(leerCmp().filter(function (x) { return x.id !== q.getAttribute('data-cmp-quitar'); })); renderCmp(); pintarCmp(); }
    });
    cmpApp.addEventListener('change', function (e) {
      if (e.target.id === 'cmpSoloDif') { soloDif = e.target.checked; var t = $('.cmp-tabla', cmpApp); if (t) t.classList.toggle('solo-dif', soloDif); }
    });
  }
  function renderCmp() {
    if (!cmpApp || !cmpDatos) return;
    var l = leerCmp().map(function (x) { return porId[x.id]; }).filter(Boolean);
    if (window.history && history.replaceState) history.replaceState(null, '', location.pathname + (l.length ? '?p=' + l.map(function (p) { return p.id; }).join(',') : ''));
    var volver = $('[data-cmp-volver]'); if (volver && l.length) volver.setAttribute('href', 'catalogo.html?ciudad=' + l[0].catalogo);
    if (!l.length) {
      cmpApp.innerHTML = '<div class="empty"><b>Todavía no elegiste productos.</b><p class="muted" style="margin-top:6px">En el catálogo, marca «Comparar» en hasta ' + CMP_MAX + ' productos del mismo catálogo.</p><div class="btn-row" style="margin-top:14px"><a class="btn btn--red" href="catalogo.html">Ir al catálogo</a></div></div>';
      return;
    }
    var filas = [
      ['Categoría', function (p) { return p.cat; }],
      ['Línea', function (p) { return p.linea; }],
      ['Código', function (p) { return p.codigo; }],
      ['Medidas (largo × ancho × alto)', function (p) { return p.medidas; }],
      ['Peso por pieza', function (p) { return p.peso; }],
      ['Rendimiento (piezas)', function (p) { return p.rend; }],
      ['Peso por m² aprox.', function (p) { return p.pesoM2; }],
      ['Acabado', function (p) { return p.acabado; }],
      ['Color', function (p) { return p.color; }],
      ['Disponibilidad', function (p) { return p.pedido; }]
    ];
    var cab = '<tr><th scope="col" class="cmp-esq">Producto</th>' + l.map(function (p) {
      return '<th scope="col"><div class="cmp-prod"><img src="' + escH(p.img || 'assets/img/logo-icono.png') + '" alt="" width="160" height="160" loading="lazy">' +
        '<a href="' + escH(p.url) + '">' + escH(p.nombre) + '</a><button type="button" class="cmp-quitar" data-cmp-quitar="' + escH(p.id) + '" aria-label="Quitar ' + escH(p.nombre) + ' de la comparación">Quitar</button></div></th>';
    }).join('') + '</tr>';
    var cuerpo = filas.map(function (f) {
      var vals = l.map(function (p) { return f[1](p) || ''; });
      if (!vals.some(Boolean)) return '';
      var dif = l.length > 1 && vals.some(function (v) { return v !== vals[0]; });
      return '<tr' + (dif ? ' class="difiere"' : '') + '><th scope="row">' + f[0] + '</th>' + vals.map(function (v) { return '<td>' + (v ? escH(v) : '<span class="muted">Sin dato</span>') + '</td>'; }).join('') + '</tr>';
    }).join('');
    if (cmpDatos.comercio) cuerpo += '<tr class="cmp-precio"><th scope="row">Precio</th>' + l.map(function (p) { return '<td><span class="precio" data-precio data-ciudad="' + escH(p.catalogo) + '" data-slug="' + escH(p.slug) + '"><a href="ingresar.html">Ingresa para ver precios</a></span></td>'; }).join('') + '</tr>';
    var nombres = l.map(function (p) { return p.nombre; });
    var lista = nombres.length > 1 ? nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1] : nombres[0];
    cmpApp.innerHTML =
      (l.length === 1 ? '<p class="price-note">Elegiste un solo producto. <a href="catalogo.html?ciudad=' + escH(l[0].catalogo) + '">Agrega otro del catálogo de ' + escH(l[0].ciudad) + '</a> para compararlos.</p>' : '') +
      '<div class="cmp-barra"><label class="check"><input type="checkbox" id="cmpSoloDif"' + (soloDif ? ' checked' : '') + '><span>Mostrar solo lo que cambia</span></label>' +
      '<div class="btn-row"><a class="btn btn--wa" data-wa="' + escH('Hola, estoy comparando ' + lista + ' y quiero cotizar en {ciudad}.') + '" href="#">Cotizar por WhatsApp</a><a class="btn" href="catalogo.html?ciudad=' + escH(l[0].catalogo) + '">Agregar productos</a><button class="btn" type="button" data-cmp-vaciar>Vaciar</button></div></div>' +
      '<div class="cmp-scroll" tabindex="0" role="region" aria-label="Tabla de comparación"><table class="cmp-tabla' + (soloDif ? ' solo-dif' : '') + '"><thead>' + cab + '</thead><tbody>' + cuerpo + '</tbody></table></div>' +
      '<p class="muted" style="font-size:15px;margin-top:14px">Rendimiento y peso por m² son referencias de las fichas técnicas; la cantidad final depende de la obra y de la junta.</p>';
    updateWa();
    document.dispatchEvent(new CustomEvent('incerpaz:precios'));
  }
  renderCmp();
  pintarCmp();

  /* ---- galería de producto ---- */
  $$('[data-thumb]').forEach(function (b) {
    b.addEventListener('click', function () {
      var main = $('#mainImg'); main.src = b.getAttribute('data-thumb');
      $$('[data-thumb]').forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
    });
  });

  /* ---- pestañas de ciudad (Dónde estamos) ---- */
  function syncTabs(slug) {
    var tabs = $$('[data-city-tab]'); if (!tabs.length) return;
    var has = tabs.some(function (t) { return t.getAttribute('data-city-tab') === slug; });
    if (!has) return;
    tabs.forEach(function (t) { t.setAttribute('aria-pressed', String(t.getAttribute('data-city-tab') === slug)); });
    $$('.panel[data-city-panel]').forEach(function (p) { p.hidden = p.getAttribute('data-city-panel') !== slug; });
  }
  $$('[data-city-tab]').forEach(function (t) {
    t.addEventListener('click', function () {
      var s = t.getAttribute('data-city-tab');
      if (cityBySlug(s)) { store(KEY, s); if (sel) sel.value = s; updateWa(); syncFormCity(); }
      syncTabs(s);
    });
  });
  if ($$('[data-city-tab]').length) {
    var h = location.hash.replace('#', '');
    syncTabs(h && $('[data-city-tab="' + h + '"]') ? h : currentCity().slug);
  }

  /* ---- formularios de contacto ---- */
  $$('form[data-lead]').forEach(function (f) {
    var msgBox = $('.form-msg', f.parentNode) || $('.form-msg', f);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (f.querySelector('.hp input') && f.querySelector('.hp input').value) return;
      if (!f.reportValidity()) return;
      var asunto = f.getAttribute('data-lead'), lines = ['*' + asunto + '*'];
      var city = currentCity(), citySel = f.querySelector('[name="ciudad"]');
      if (citySel) city = CFG.ciudades.filter(function (c) { return c.nombre === citySel.value; })[0] || city;
      var data = { asunto: asunto, ciudad: citySel ? citySel.value : (asunto.indexOf('Lista de espera') === 0 ? 'Otra ciudad' : city.nombre), pagina: location.pathname };
      $$('input, select, textarea', f).forEach(function (el) {
        if (!el.name || el.closest('.hp') || el.type === 'submit') return;
        if (el.type === 'checkbox') { data[el.name] = el.checked ? 'sí' : 'no'; return; }
        var label = el.closest('label') ? el.closest('label').firstChild.textContent.trim() : el.name;
        data[el.name] = el.value;
        if (el.value) lines.push(label + ': ' + el.value);
      });
      if (CFG.demo) { var dm = $('.form-msg', f.parentNode) || $('.form-msg', f); if (dm) { dm.textContent = 'Esto es una demostración: en el sitio real tu solicitud llegaría a un ejecutivo de ' + city.nombre + '.'; dm.hidden = false; } return; }
      var done = function (texto) {
        if (msgBox) { msgBox.textContent = texto; msgBox.hidden = false; }
        f.reset();
        $$('select[name="ciudad"]', f).forEach(function (s) { s.setAttribute('data-tocado', ''); });
        syncFormCity();
      };
      if (CFG.leadEndpoint) {
        fetch(CFG.leadEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'incerpaz' }, body: JSON.stringify(data) })
          .then(function (r) { if (!r.ok) throw new Error(r.status); done(asunto.indexOf('Lista de espera') === 0 ? 'Listo, te avisaremos cuando lleguemos a tu ciudad.' : 'Recibimos tu solicitud. Un ejecutivo de ' + city.nombre + ' te contactará.'); })
          .catch(function () { window.open(waUrl(city.whatsapp, lines.join('\n')), '_blank', 'noopener'); done('No pudimos enviar el formulario. Abrimos WhatsApp para que nos escribas directamente.'); });
      } else {
        window.open(waUrl(f.getAttribute('data-wa-num') || city.whatsapp, lines.join('\n')), '_blank', 'noopener');
        done(asunto.indexOf('Lista de espera') === 0 ? 'Abrimos WhatsApp con tu mensaje listo. Envíalo y te avisaremos.' : 'Abrimos WhatsApp con tu mensaje listo. Envíalo y un ejecutivo de ' + city.nombre + ' te atenderá.');
      }
    });
  });
})();
