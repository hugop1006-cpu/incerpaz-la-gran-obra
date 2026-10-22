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

  /* ---- ciudad y enlaces de WhatsApp ---- */
  function updateWa() {
    var c = currentCity();
    $$('[data-wa]').forEach(function (a) {
      var msg = a.getAttribute('data-wa').replace('{ciudad}', c.nombre);
      a.href = waUrl(a.getAttribute('data-wa-num') || c.whatsapp, msg);
      a.target = '_blank'; a.rel = 'noopener';
    });
    $$('[data-city-name]').forEach(function (e) { e.textContent = c.nombre; });
  }
  var sel = $('#citySel');
  if (sel) {
    sel.innerHTML = CFG.ciudades.map(function (c) { return '<option value="' + c.slug + '">' + c.nombre + '</option>'; }).join('');
    sel.value = currentCity().slug;
    sel.addEventListener('change', function () { store(KEY, sel.value); updateWa(); syncTabs(sel.value); document.dispatchEvent(new CustomEvent('incerpaz:city', { detail: sel.value })); });
  }
  updateWa();

  /* ---- menú móvil ---- */
  var tg = $('.nav-toggle'), nav = $('#nav');
  if (tg && nav) tg.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    tg.setAttribute('aria-expanded', String(open));
  });

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
    function apply() {
      var term = norm(q.value.trim()), n = 0;
      cards.forEach(function (c) {
        var ok = c.getAttribute('data-ciudad') === catCity && (cat === 'todas' || c.getAttribute('data-cats').split(' ').indexOf(cat) >= 0) && norm(c.getAttribute('data-name')).indexOf(term) >= 0;
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
      if (cityBySlug(s)) { store(KEY, s); if (sel) sel.value = s; updateWa(); }
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
      var data = { asunto: asunto, ciudad: citySel ? citySel.value : city.nombre, pagina: location.pathname };
      $$('input, select, textarea', f).forEach(function (el) {
        if (!el.name || el.closest('.hp') || el.type === 'submit') return;
        var label = el.closest('label') ? el.closest('label').firstChild.textContent.trim() : el.name;
        data[el.name] = el.value;
        if (el.value) lines.push(label + ': ' + el.value);
      });
      var done = function (texto) { if (msgBox) { msgBox.textContent = texto; msgBox.hidden = false; } f.reset(); };
      if (CFG.leadEndpoint) {
        fetch(CFG.leadEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
          .then(function (r) { if (!r.ok) throw new Error(r.status); done('Recibimos tu solicitud. Un ejecutivo de ' + city.nombre + ' te contactará.'); })
          .catch(function () { window.open(waUrl(city.whatsapp, lines.join('\n')), '_blank', 'noopener'); done('No pudimos enviar el formulario. Abrimos WhatsApp para que nos escribas directamente.'); });
      } else {
        window.open(waUrl(f.getAttribute('data-wa-num') || city.whatsapp, lines.join('\n')), '_blank', 'noopener');
        done(asunto.indexOf('Lista de espera') === 0 ? 'Abrimos WhatsApp con tu mensaje listo. Envíalo y te avisaremos.' : 'Abrimos WhatsApp con tu mensaje listo. Envíalo y un ejecutivo de ' + city.nombre + ' te atenderá.');
      }
    });
  });
})();
