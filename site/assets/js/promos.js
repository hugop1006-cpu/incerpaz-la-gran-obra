/* INCERPAZ — promociones: muestra solo lo vigente y de la ciudad elegida (inicio, fin y ciudades se leen en el navegador). */
(function () {
  'use strict';
  var CFG = window.INCERPAZ || { ciudades: [] };
  var BASE = document.body.getAttribute('data-base') || '';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function hoy() { var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  function ciudad() { try { var s = localStorage.getItem('incerpaz_ciudad'); return CFG.ciudades.filter(function (c) { return c.slug === s; })[0] || CFG.ciudades[0]; } catch (e) { return CFG.ciudades[0]; } }
  var enCiudad = function (lista, slug) { return !lista.length || lista.indexOf(slug) >= 0; };
  var lista = function (txt) { return (txt || '').split(' ').filter(Boolean); };
  var fecha = function (iso) { return new Date(iso + 'T12:00:00').toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' }); };
  var TIPOS = { concurso: 'Concurso', sorteo: 'Sorteo', evento: 'Evento', curso: 'Curso', proyecto: 'Proyecto nuevo', noticia: 'Noticia', combo: 'Combo' };
  var grupo = 'todas';

  function vigente(x, slug) { var h = hoy(); return x.inicio <= h && h <= x.fin && enCiudad(x.ciudades, slug); }

  /* inicio: tarjetas de lo vigente en la ciudad elegida (las que vencen primero) */
  function inicio() {
    var box = $('#promos-home'), datos = $('#datos-promos'); if (!box || !datos) return;
    var todos; try { todos = JSON.parse(datos.textContent); } catch (e) { return; }
    var slug = ciudad().slug;
    var v = todos.filter(function (x) { return vigente(x, slug); }).sort(function (a, b) { return a.fin < b.fin ? -1 : 1; }).slice(0, 3);
    $('#promos-home-lista').innerHTML = v.map(function (x) {
      return '<a class="promo-card" href="' + BASE + x.url + '"><div class="img">' + (x.imagen ? '<img src="' + BASE + esc(x.imagen) + '" alt="" loading="lazy" width="600" height="400">' : '<img src="' + BASE + 'assets/img/logo-icono.png" alt="" style="width:30%;opacity:.25">') + '</div><div class="body"><span class="tag' + (x.tipo === 'combo' ? ' tag--combo' : '') + '">' + TIPOS[x.tipo] + '</span><h3>' + esc(x.titulo) + '</h3><p>' + esc(x.resumen) + '</p><span class="meta">Hasta el ' + fecha(x.fin) + '</span></div></a>';
    }).join('');
    box.hidden = !v.length;
  }

  /* listado: filtros por tipo, ciudad y vigencia */
  function listado() {
    var cont = $('#promos-lista'); if (!cont) return;
    var slug = ciudad().slug, n = 0, h = hoy();
    $$('.promo-card', cont).forEach(function (c) {
      var ok = c.getAttribute('data-inicio') <= h && h <= c.getAttribute('data-fin') && enCiudad(lista(c.getAttribute('data-ciudades')), slug) && (grupo === 'todas' || c.getAttribute('data-grupo') === grupo);
      c.hidden = !ok; if (ok) n++;
    });
    $('#promos-vacio').hidden = n !== 0;
    $$('button[data-grupo]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-grupo') === grupo)); });
  }

  /* detalle: estado de la promoción y botón solo si está vigente en la ciudad */
  function detalle() {
    var el = $('#promo-estado'); if (!el) return;
    var c = ciudad(), ini = el.getAttribute('data-inicio'), fin = el.getAttribute('data-fin'), ciu = lista(el.getAttribute('data-ciudades')), h = hoy();
    var texto, ok = true;
    if (h > fin) { texto = 'Esta promoción terminó el ' + fecha(fin) + '.'; ok = false; }
    else if (h < ini) { texto = 'Empieza el ' + fecha(ini) + '.'; ok = false; }
    else if (!enCiudad(ciu, c.slug)) { texto = 'No está disponible en ' + c.nombre + '. Cambia de ciudad arriba para verla en otra agencia.'; ok = false; }
    else texto = 'Vigente hasta el ' + fecha(fin) + (ciu.length ? '' : ' en todas las ciudades') + '.';
    el.textContent = texto; el.style.borderLeft = '6px solid ' + (ok ? '#1e8a4c' : '#b58900');
    $$('[data-promo-cta]').forEach(function (b) { b.hidden = !ok; });
  }

  function todo() { inicio(); listado(); detalle(); }
  $$('button[data-grupo]').forEach(function (b) { b.addEventListener('click', function () { grupo = b.getAttribute('data-grupo'); listado(); }); });
  document.addEventListener('incerpaz:city', todo);
  todo();
})();
