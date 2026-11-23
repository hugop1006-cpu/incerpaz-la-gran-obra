/* INCERPAZ — calculadora de tejas por pendiente.
   Superficie real = área en planta × √(1 + pendiente²). Tejas = superficie real × tejas por m² × (1 + merma).
   Los datos (tejas por m² y peso) salen de las fichas de producto; la pendiente mínima de cada modelo está por confirmar. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var datos = $('#datos-tejas'); if (!datos) return;
  var D = JSON.parse(datos.textContent);
  var fmt = function (n, d) { return Number(n).toLocaleString('es-BO', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); };
  var num = function (id) { var n = parseFloat(String($(id).value).replace(',', '.')); return isFinite(n) && n >= 0 ? n : 0; };
  function ciudad() { try { var s = localStorage.getItem('incerpaz_ciudad'); return D.ciudades.filter(function (c) { return c.slug === s; })[0] || D.ciudades[0]; } catch (e) { return D.ciudades[0]; } }
  function modelo() { var v = $('#tj-modelo').value; return D.tejas.filter(function (t) { return t.slug === v; })[0]; }
  var st = null, tocoRend = false;

  function calcular() {
    var t = modelo(); if (!t) return;
    var area = num('#tj-area'), pend = num('#tj-pend'), rend = num('#tj-rend'), merma = parseFloat($('#tj-merma').value);
    var real = area * Math.sqrt(1 + Math.pow(pend / 100, 2));
    var pzas = Math.ceil(real * rend * (1 + merma) - 1e-9), kg = t.peso ? pzas * t.peso : 0;
    st = { t: t, area: area, pend: pend, real: real, pzas: pzas };
    $('#tj-real').textContent = fmt(real, 1);
    $('#tj-pzas').textContent = fmt(pzas);
    $('#tj-ton').textContent = kg ? fmt(kg / 1000, 1) : '—';
    var c = ciudad(), aviso = $('#tj-aviso');
    var partes = [];
    if (pend > 0) partes.push('Pendiente de ' + fmt(pend) + ' % (' + fmt(Math.atan(pend / 100) * 180 / Math.PI, 1) + '°).');
    if (c.slug !== 'santa-cruz') partes.push('Las tejas están en el catálogo de Santa Cruz: confirma disponibilidad y entrega con tu agencia de ' + c.nombre + '.');
    aviso.textContent = partes.join(' '); aviso.hidden = !partes.length;
    var msg = 'Hola, quiero cotizar tejas en ' + c.nombre + ': ' + t.nombre + ', techo de ' + fmt(area, 1) + ' m² en planta con ' + fmt(pend) + ' % de pendiente (' + fmt(real, 1) + ' m² reales, ' + fmt(pzas) + ' tejas con ' + fmt(merma * 100) + ' % de merma).';
    var wa = $('#tj-wa'); wa.setAttribute('data-wa', msg); wa.href = 'https://wa.me/591' + c.whatsapp + '?text=' + encodeURIComponent(msg);
  }
  function elegir() {
    var t = modelo(); if (!t) return;
    if (!tocoRend) $('#tj-rend').value = t.rend;
    calcular();
  }
  $('#tj-modelo').addEventListener('change', function () { tocoRend = false; elegir(); });
  $('#tj-rend').addEventListener('input', function () { tocoRend = true; calcular(); });
  ['#tj-area', '#tj-pend'].forEach(function (id) { $(id).addEventListener('input', calcular); });
  $('#tj-merma').addEventListener('change', calcular);
  document.addEventListener('incerpaz:city', calcular);
  var add = $('#tj-add');
  if (add) add.addEventListener('click', function () {
    if (!st || !window.IncerpazPresupuesto) return;
    window.IncerpazPresupuesto.añadir({ ciudad: st.t.ciudad, slug: st.t.slug, nombre: st.t.nombre, codigo: st.t.codigo }, st.pzas);
    window.IncerpazPresupuesto.aviso('Agregamos ' + fmt(st.pzas) + ' tejas al presupuesto');
  });
  elegir();
})();
