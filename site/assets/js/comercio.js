/* INCERPAZ — comercio: cuenta, precios con sesión, presupuesto y pedidos.
   Habla con la API de server/ (mismo dominio). Si la API no responde, el sitio sigue funcionando sin precios. */
(function () {
  'use strict';
  var CFG = window.INCERPAZ || { ciudades: [] };
  var BASE = document.body.getAttribute('data-base') || '';
  var PAGINA = document.body.getAttribute('data-pagina') || '';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var CATALOGO = { cochabamba: 'Cochabamba', 'santa-cruz': 'Santa Cruz' };
  var NOMBRE_CIUDAD = { cochabamba: 'Cochabamba', 'santa-cruz': 'Santa Cruz', oruro: 'Oruro', sucre: 'Sucre' };
  var ESTADOS = { recibido: 'Recibido', confirmado: 'Confirmado', en_despacho: 'En despacho', entregado: 'Entregado', anulado: 'Anulado' };
  var TIPOS = { constructor: 'Constructor independiente', empresa: 'Empresa constructora', ferreteria: 'Ferretería o distribuidor', entidad: 'Entidad pública', proyectista: 'Proyectista o calculista', dueno: 'Dueño de casa' };
  var CLAVE = 'incerpaz_presupuesto';
  var fmtBs = function (n) { return 'Bs ' + Number(n).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var fmtN = function (n) { return Number(n).toLocaleString('es-BO', { maximumFractionDigits: 2 }); };
  var waUrl = function (num, msg) { return 'https://wa.me/591' + num + '?text=' + encodeURIComponent(msg); };
  var cityBySlug = function (s) { return CFG.ciudades.filter(function (c) { return c.slug === s; })[0]; };
  var ciudadActual = function () { try { return cityBySlug(localStorage.getItem('incerpaz_ciudad')) || CFG.ciudades[0]; } catch (e) { return CFG.ciudades[0]; } };

  /* ---------- API ---------- */
  function api(metodo, ruta, cuerpo) {
    return fetch(ruta, { method: metodo, credentials: 'same-origin', headers: Object.assign({ 'X-Requested-With': 'incerpaz' }, cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}), body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined })
      .then(function (r) {
        var tipo = r.headers.get('content-type') || '';
        if (tipo.indexOf('json') < 0) throw new Error('sin-api');
        return r.json().then(function (j) { if (!r.ok) { var e = new Error(j.error || 'Error'); e.status = r.status; throw e; } return j; });
      });
  }
  var apiCaida = false;
  var sesion = api('GET', '/api/yo').then(function (r) { return { usuario: r.usuario, ejemplo: !!r.erp_ejemplo }; }).catch(function () { apiCaida = true; return { usuario: null, ejemplo: false }; });
  var verificado = function (u) { return !!u && (u.estado === 'verificado' || u.rol !== 'cliente'); };

  /* ---------- presupuesto local ---------- */
  function leerCart() { try { var c = JSON.parse(localStorage.getItem(CLAVE) || 'null'); if (c && Array.isArray(c.items)) return c; } catch (e) { /* vacío */ } return { items: [], obra: '', notas: '', id: null }; }
  function guardarCart(c) { try { localStorage.setItem(CLAVE, JSON.stringify(c)); } catch (e) { /* sin almacenamiento */ } contador(); }
  function contador() { var n = leerCart().items.length; $$('[data-bcount]').forEach(function (e) { e.textContent = n; }); }
  function añadir(it, cantidad) {
    var c = leerCart(), ya = c.items.filter(function (x) { return x.ciudad === it.ciudad && x.slug === it.slug; })[0];
    if (ya) ya.cantidad += cantidad; else c.items.push({ ciudad: it.ciudad, slug: it.slug, nombre: it.nombre, codigo: it.codigo || '', cantidad: cantidad });
    c.id = null; guardarCart(c);
  }
  function aviso(texto) {
    var t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = texto; t.classList.add('on'); clearTimeout(aviso.t); aviso.t = setTimeout(function () { t.classList.remove('on'); }, 3200);
  }

  /* ---------- precios ---------- */
  var cachePrecios = {};
  function precios(ciudad) {
    if (!cachePrecios[ciudad]) cachePrecios[ciudad] = api('GET', '/api/precios?ciudad=' + encodeURIComponent(ciudad)).catch(function () { return null; });
    return cachePrecios[ciudad];
  }
  function pintarPrecios(s) {
    var nodos = $$('[data-precio]'); if (!nodos.length) return;
    var u = s.usuario, volver = encodeURIComponent((location.pathname.split('/').pop() || 'index.html') + location.search);
    if (!verificado(u)) {
      nodos.forEach(function (n) { n.innerHTML = !u ? '<a href="' + BASE + 'ingresar.html?volver=' + volver + '">Precio con sesión</a>' : 'Precio al verificar tu cuenta'; });
      return;
    }
    var ciudades = {}; nodos.forEach(function (n) { ciudades[n.getAttribute('data-ciudad')] = 1; });
    Object.keys(ciudades).forEach(function (c) {
      precios(c).then(function (r) {
        nodos.filter(function (n) { return n.getAttribute('data-ciudad') === c; }).forEach(function (n) {
          var v = r && r.precios ? r.precios[n.getAttribute('data-slug')] : null;
          n.innerHTML = typeof v === 'number' ? '<strong>' + fmtBs(v) + '</strong> <span class="muted">por pieza' + (r.ejemplo ? ' · precio de ejemplo' : '') + (r.nota ? ' · ' + esc(r.nota.replace(/^Precio por pieza,?\s*/i, '')) : '') + '</span>' : 'Precio por cotizar con tu ejecutivo';
        });
      });
    });
  }

  /* ---------- cabecera: cuenta y presupuesto ---------- */
  function pintarCabecera(s) {
    var box = $('[data-acct]'); if (!box) return;
    var u = s.usuario, nombre = u ? esc(u.nombre.split(' ')[0]) : '';
    var cuenta = apiCaida ? '' : (u
      ? '<a href="' + BASE + (u.rol === 'cliente' ? 'mi-cuenta.html' : 'equipo.html') + '">' + (u.rol === 'cliente' ? 'Mi cuenta' : 'Panel') + ' (' + nombre + ')</a> · <a href="#" data-salir>Salir</a>'
      : '<a href="' + BASE + 'ingresar.html">Ingresar</a> · <a href="' + BASE + 'registro.html">Crear cuenta</a>');
    box.innerHTML = '<a href="' + BASE + 'presupuesto.html">Presupuesto (<span data-bcount>0</span>)</a>' + (cuenta ? ' · ' + cuenta : '');
    contador();
    var salir = $('[data-salir]', box);
    if (salir) salir.addEventListener('click', function (e) { e.preventDefault(); api('POST', '/api/logout', {}).finally(function () { location.href = BASE + 'index.html'; }); });
  }

  /* ---------- botones de añadir ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-add]') : null; if (!b) return;
    e.preventDefault();
    var cant = 100, cual = b.getAttribute('data-qty-from');
    if (cual) { var inp = $(cual); cant = Math.max(1, Math.round(parseFloat(inp && inp.value) || 1)); }
    añadir({ ciudad: b.getAttribute('data-ciudad'), slug: b.getAttribute('data-slug'), nombre: b.getAttribute('data-nombre'), codigo: b.getAttribute('data-codigo') }, cant);
    aviso('Añadido al presupuesto: ' + b.getAttribute('data-nombre') + ' (' + fmtN(cant) + ')');
  });
  /* botón "añadir" de la calculadora de la ficha: usa las piezas calculadas */
  $$('[data-calc-add]').forEach(function (b) {
    b.addEventListener('click', function () {
      var box = b.closest('[data-calc]'), pz = parseInt(($('[data-out="pzas"]', box).textContent || '0').replace(/\D/g, ''), 10) || 0;
      if (!pz) { aviso('Primero indica la superficie'); return; }
      añadir({ ciudad: b.getAttribute('data-ciudad'), slug: b.getAttribute('data-slug'), nombre: b.getAttribute('data-nombre'), codigo: b.getAttribute('data-codigo') }, pz);
      aviso('Añadido: ' + fmtN(pz) + ' piezas de ' + b.getAttribute('data-nombre'));
    });
  });

  /* ---------- páginas ---------- */
  function volverA() { var m = /[?&]volver=([^&]+)/.exec(location.search); var v = m ? decodeURIComponent(m[1]) : ''; return /^([a-z0-9\-]+\/){0,2}[a-z0-9\-]+\.html(\?[a-z0-9=&%\-]*)?$/i.test(v) ? v : ''; }
  function mensaje(box, texto, tipo) { box.className = 'form-msg' + (tipo === 'error' ? ' error' : ''); box.textContent = texto; box.hidden = false; }
  var SIN_API = '<div class="empty"><b>El servicio de cuentas no está disponible ahora.</b><p class="muted" style="margin-top:6px">Puedes seguir viendo el catálogo y cotizar por WhatsApp.</p></div>';

  function paginaIngresar(s) {
    var f = $('#form-ingreso'), msg = $('#msg'); if (apiCaida) { f.outerHTML = SIN_API; return; }
    if (s.usuario) { location.href = BASE + (volverA() || (s.usuario.rol === 'cliente' ? 'mi-cuenta.html' : 'equipo.html')); return; }
    f.addEventListener('submit', function (e) {
      e.preventDefault(); msg.hidden = true;
      api('POST', '/api/login', { correo: f.correo.value, password: f.password.value }).then(function (r) {
        location.href = BASE + (volverA() || (r.usuario.rol === 'cliente' ? 'mi-cuenta.html' : 'equipo.html'));
      }).catch(function (er) { mensaje(msg, er.message, 'error'); });
    });
  }

  function paginaRegistro(s) {
    var f = $('#form-registro'), msg = $('#msg'); if (apiCaida) { f.outerHTML = SIN_API; return; }
    if (s.usuario) { location.href = BASE + 'mi-cuenta.html'; return; }
    var emp = function () { var t = f.tipo.value; $$('[data-emp]').forEach(function (e) { e.querySelector('input').required = ['empresa', 'entidad', 'ferreteria'].indexOf(t) >= 0; }); };
    f.tipo.addEventListener('change', emp); emp();
    f.addEventListener('submit', function (e) {
      e.preventDefault(); msg.hidden = true;
      if (f.password.value !== f.password2.value) { mensaje(msg, 'Las contraseñas no coinciden', 'error'); return; }
      var d = {}; ['tipo', 'nombre', 'razon_social', 'nit', 'ciudad', 'celular', 'correo', 'password'].forEach(function (k) { d[k] = f[k].value; });
      api('POST', '/api/registro', d).then(function (r) {
        f.hidden = true; mensaje(msg, r.mensaje, 'ok');
        $('#despues').hidden = false;
      }).catch(function (er) { mensaje(msg, er.message, 'error'); });
    });
  }

  function lineaTexto(i) { return '- ' + fmtN(i.cantidad) + ' × ' + i.nombre + (i.codigo ? ' (' + i.codigo + ')' : '') + ' · catálogo ' + CATALOGO[i.ciudad]; }

  function paginaPresupuesto(s) {
    var app = $('#app'), u = s.usuario, ver = verificado(u);
    var AG = JSON.parse($('#datos-agencias').textContent);
    var est = { paso: 1, entrega: 'retiro', ciudad: (u && NOMBRE_CIUDAD[u.ciudad] && u.ciudad) || ciudadActual().slug, catalogo: null, pago: 'transferencia', msgFinal: null };
    var cart = leerCart(), preciosMapa = {};

    function catalogos() { var o = {}; cart.items.forEach(function (i) { o[i.ciudad] = 1; }); return Object.keys(o); }
    function itemsDelCatalogo() { return est.catalogo ? cart.items.filter(function (i) { return i.ciudad === est.catalogo; }) : cart.items; }
    function cargarPrecios() {
      if (!ver) return Promise.resolve();
      return Promise.all(catalogos().map(function (c) { return precios(c).then(function (r) { preciosMapa[c] = r; }); }));
    }
    function precioDe(i) { var r = preciosMapa[i.ciudad]; var v = r && r.precios ? r.precios[i.slug] : null; return typeof v === 'number' ? v : null; }
    function totalDe(lista) { var t = 0; for (var k = 0; k < lista.length; k++) { var p = precioDe(lista[k]); if (p == null) return null; t += p * lista[k].cantidad; } return t; }
    function agencias(ciudad) { return (AG[ciudad] || []).filter(function (a) { return a.tipo === 'agencia'; }).map(function (a) { return a.nombre; }); }

    function pasos() {
      var n = ['1. Mi presupuesto', '2. Entrega', '3. Datos', '4. Resumen'];
      return '<div class="seg" role="group" aria-label="Pasos">' + n.map(function (t, i) { return '<button type="button" data-paso="' + (i + 1) + '" aria-pressed="' + (est.paso === i + 1) + '">' + t + '</button>'; }).join('') + '</div>';
    }
    function aviso1() {
      if (!u) return '<p class="price-note"><a href="' + BASE + 'ingresar.html?volver=presupuesto.html">Ingresa</a> o <a href="' + BASE + 'registro.html">crea una cuenta</a> para ver precios y hacer pedidos. Sin cuenta puedes pedir una cotización por WhatsApp.</p>';
      if (!ver) return '<p class="price-note">Tu cuenta está en revisión. Mientras tanto puedes armar tu presupuesto y pedir una cotización por WhatsApp.</p>';
      return preciosMapa[Object.keys(preciosMapa)[0]] && preciosMapa[Object.keys(preciosMapa)[0]].ejemplo ? '<p class="price-note">Los precios mostrados son de ejemplo hasta conectar las tarifas reales.</p>' : '';
    }
    function vistaPaso1() {
      if (!cart.items.length) return '<div class="empty"><b>Tu presupuesto está vacío.</b><p class="muted" style="margin-top:6px">Añade productos desde el catálogo.</p><div class="btn-row" style="margin-top:14px"><a class="btn btn--red" href="' + BASE + 'catalogo.html">Ver productos</a></div></div>';
      var multi = catalogos().length > 1;
      var lista = itemsDelCatalogo(), tot = totalDe(lista);
      return (multi && ver ? '<div class="price-note">Tienes productos de dos catálogos. Un pedido usa un solo catálogo: elige cuál enviar ahora. <label style="margin-top:8px;max-width:280px">Catálogo del pedido<select id="sel-cat">' + catalogos().map(function (c) { return '<option value="' + c + '"' + (est.catalogo === c ? ' selected' : '') + '>' + CATALOGO[c] + '</option>'; }).join('') + '</select></label></div>' : '') +
        '<div class="scroll"><table class="tabla"><thead><tr><th>Producto</th><th>Catálogo</th><th class="num">Precio</th><th class="num">Cantidad</th><th class="num">Subtotal</th><th></th></tr></thead><tbody>' +
        cart.items.map(function (i, k) {
          var p = precioDe(i), fuera = est.catalogo && i.ciudad !== est.catalogo;
          return '<tr' + (fuera ? ' class="fuera"' : '') + '><td><b>' + esc(i.nombre) + '</b><br><span class="muted">' + esc(i.codigo) + '</span></td><td>' + CATALOGO[i.ciudad] + '</td><td class="num">' + (ver ? (p == null ? 'Por cotizar' : fmtBs(p)) : '<span class="muted">Con sesión</span>') + '</td><td class="num"><input class="qty" type="number" min="1" step="1" value="' + i.cantidad + '" data-q="' + k + '" aria-label="Cantidad de ' + esc(i.nombre) + '"></td><td class="num">' + (ver && p != null ? fmtBs(p * i.cantidad) : '—') + '</td><td><button class="btn btn--sm" type="button" data-quitar="' + k + '" aria-label="Quitar ' + esc(i.nombre) + '">Quitar</button></td></tr>';
        }).join('') + '</tbody>' + (ver ? '<tfoot><tr><th colspan="4" style="text-align:right">Total estimado</th><th class="num">' + (tot == null ? 'Hay productos por cotizar' : fmtBs(tot)) + '</th><th></th></tr></tfoot>' : '') + '</table></div>' +
        '<div class="form-grid" style="margin-top:16px"><label>Obra (opcional)<input id="obra" value="' + esc(cart.obra) + '" maxlength="120" placeholder="Ej. Edificio Av. Ejemplo"></label><label>Notas para el ejecutivo<input id="notas" value="' + esc(cart.notas) + '" maxlength="1000" placeholder="Plazos, medidas, dudas"></label></div>' +
        '<div class="btn-row" style="margin-top:18px"><button class="btn btn--red" type="button" data-ir="2">Seguir</button>' + (u ? '<button class="btn" type="button" id="guardar">Guardar presupuesto</button>' : '') + '<button class="btn btn--ghost" type="button" id="vaciar">Vaciar</button></div><p class="form-msg" id="msg1" role="status" hidden style="margin-top:14px"></p>';
    }
    function vistaPaso2() {
      var ags = agencias(est.ciudad);
      return '<div class="seg" role="group" aria-label="Modalidad" style="margin-bottom:16px"><button type="button" data-ent="retiro" aria-pressed="' + (est.entrega === 'retiro') + '">Retiro en agencia</button><button type="button" data-ent="envio" aria-pressed="' + (est.entrega === 'envio') + '">Envío a obra</button></div>' +
        '<div class="form-grid"><label>Ciudad<select id="e-ciudad">' + Object.keys(NOMBRE_CIUDAD).map(function (c) { return '<option value="' + c + '"' + (est.ciudad === c ? ' selected' : '') + '>' + NOMBRE_CIUDAD[c] + '</option>'; }).join('') + '</select></label>' +
        (est.entrega === 'retiro' ? '<label>Agencia de retiro<select id="e-agencia">' + ags.map(function (a) { return '<option' + (est.agencia === a ? ' selected' : '') + '>' + esc(a) + '</option>'; }).join('') + '</select></label>' : '<label class="full">Dirección de la obra<input id="e-dir" value="' + esc(est.direccion || '') + '" maxlength="240" placeholder="Avenida, zona, referencia"></label>') +
        '<label>Fecha deseada<input id="e-fecha" value="' + esc(est.fecha || '') + '" maxlength="40" placeholder="Día y mes"></label></div>' +
        '<p class="muted" style="margin-top:14px">' + (est.entrega === 'retiro' ? 'Cada agencia confirma cuándo está listo tu pedido.' : 'Los montos y las condiciones del envío son los de la política de ' + NOMBRE_CIUDAD[est.ciudad] + '; tu ejecutivo los confirma.') + '</p>' +
        '<div class="btn-row" style="margin-top:18px"><button class="btn" type="button" data-ir="1">Atrás</button><button class="btn btn--red" type="button" data-ir="3">Seguir</button></div>';
    }
    function vistaPaso3() {
      var cuenta = u ? '<table class="specs"><tbody><tr><th>Nombre</th><td>' + esc(u.nombre) + '</td></tr><tr><th>' + (u.razon_social ? 'Razón social' : 'Cuenta') + '</th><td>' + esc(u.razon_social || TIPOS[u.tipo]) + '</td></tr>' + (u.nit ? '<tr><th>NIT o CI</th><td>' + esc(u.nit) + '</td></tr>' : '') + '<tr><th>Celular</th><td>' + esc(u.celular) + '</td></tr></tbody></table>' : '<div class="form-grid"><label>Nombre<input id="d-nombre" value="' + esc(est.nombre || '') + '" maxlength="120" autocomplete="name"></label><label>Celular<input id="d-cel" value="' + esc(est.celular || '') + '" maxlength="20" inputmode="tel" autocomplete="tel"></label></div>';
      var pago = ver ? '<div style="margin-top:16px"><span class="mono-label">Forma de pago</span><div class="seg" role="group" aria-label="Forma de pago">' + [['transferencia', 'Transferencia'], ['qr', 'QR'], ['agencia', 'En agencia']].map(function (p) { return '<button type="button" data-pago="' + p[0] + '" aria-pressed="' + (est.pago === p[0]) + '">' + p[1] + '</button>'; }).join('') + '</div><p class="muted" style="margin-top:8px">Se paga al contado. No hay línea de crédito.</p></div>' : '';
      return cuenta + pago + '<div class="btn-row" style="margin-top:18px"><button class="btn" type="button" data-ir="2">Atrás</button><button class="btn btn--red" type="button" data-ir="4">Seguir</button></div><p class="form-msg error" id="msg3" role="alert" hidden style="margin-top:14px"></p>';
    }
    function resumenTexto() {
      var lista = itemsDelCatalogo();
      var ent = est.entrega === 'retiro' ? 'Retiro en agencia ' + (est.agencia || agencias(est.ciudad)[0] || '') + ', ' + NOMBRE_CIUDAD[est.ciudad] : 'Envío a obra en ' + NOMBRE_CIUDAD[est.ciudad] + ': ' + (est.direccion || '');
      return { lista: lista, ent: ent };
    }
    function vistaPaso4() {
      var r = resumenTexto(), tot = totalDe(r.lista);
      if (est.msgFinal) return est.msgFinal;
      return '<table class="specs"><tbody><tr><th>Productos</th><td>' + r.lista.length + ' (' + fmtN(r.lista.reduce(function (t, i) { return t + i.cantidad; }, 0)) + ' piezas)</td></tr><tr><th>Entrega</th><td>' + esc(r.ent) + (est.fecha ? '<br>Fecha deseada: ' + esc(est.fecha) : '') + '</td></tr>' +
        (ver ? '<tr><th>Total estimado</th><td>' + (tot == null ? 'Hay productos por cotizar: tu ejecutivo los confirma' : fmtBs(tot)) + '</td></tr><tr><th>Pago</th><td>' + { transferencia: 'Transferencia', qr: 'QR', agencia: 'En agencia' }[est.pago] + '</td></tr>' : '') + '</tbody></table>' +
        '<div class="btn-row" style="margin-top:18px"><button class="btn" type="button" data-ir="3">Atrás</button>' + (ver ? '<button class="btn btn--red" type="button" id="enviar-pedido">Enviar pedido</button>' : '') + '<button class="btn ' + (ver ? '' : 'btn--wa') + '" type="button" id="pedir-wa">Cotizar por WhatsApp</button></div><p class="form-msg error" id="msg4" role="alert" hidden style="margin-top:14px"></p>';
    }
    function pintar() {
      var cuerpo = est.paso === 1 ? vistaPaso1() : est.paso === 2 ? vistaPaso2() : est.paso === 3 ? vistaPaso3() : vistaPaso4();
      app.innerHTML = pasos() + aviso1() + '<div class="form-box" style="margin-top:16px">' + cuerpo + '</div>';
      enlazar();
    }
    function sync() { cart.obra = ($('#obra') || { value: cart.obra }).value; cart.notas = ($('#notas') || { value: cart.notas }).value; guardarCart(cart); }
    function ir(n) {
      sync(); leerPaso();
      if (n > 1 && !itemsDelCatalogo().length) { n = 1; }
      if (n === 4 && !u && !(est.nombre && est.celular)) { n = 3; est.paso = 3; pintar(); var m = $('#msg3'); m.textContent = 'Escribe tu nombre y tu celular para que te contactemos.'; m.hidden = false; return; }
      if (n === 4 && est.entrega === 'envio' && !est.direccion) { est.paso = 2; pintar(); return; }
      est.paso = n; pintar();
    }
    function leerPaso() {
      if (est.paso === 2) { est.ciudad = ($('#e-ciudad') || { value: est.ciudad }).value; if ($('#e-agencia')) est.agencia = $('#e-agencia').value; if ($('#e-dir')) est.direccion = $('#e-dir').value.trim(); est.fecha = ($('#e-fecha') || { value: est.fecha || '' }).value.trim(); }
      if (est.paso === 3 && !u) { est.nombre = ($('#d-nombre') || { value: '' }).value.trim(); est.celular = ($('#d-cel') || { value: '' }).value.trim(); }
    }
    function mensajeWa() {
      var r = resumenTexto(), c = cityBySlug(est.ciudad) || ciudadActual();
      var lineas = ['*Solicitud de cotización*'].concat(r.lista.map(lineaTexto));
      if (cart.obra) lineas.push('Obra: ' + cart.obra); if (cart.notas) lineas.push('Notas: ' + cart.notas);
      lineas.push('Entrega: ' + r.ent + (est.fecha ? ' (fecha deseada: ' + est.fecha + ')' : ''));
      lineas.push('Cliente: ' + (u ? u.nombre + (u.nit ? ', NIT ' + u.nit : '') + ', ' + u.celular : est.nombre + ', ' + est.celular));
      return waUrl(c.whatsapp, lineas.join('\n'));
    }
    function enlazar() {
      $$('[data-paso]').forEach(function (b) { b.addEventListener('click', function () { ir(parseInt(b.getAttribute('data-paso'), 10)); }); });
      $$('[data-ir]').forEach(function (b) { b.addEventListener('click', function () { ir(parseInt(b.getAttribute('data-ir'), 10)); }); });
      $$('[data-q]').forEach(function (i) { i.addEventListener('change', function () { var k = +i.getAttribute('data-q'); cart.items[k].cantidad = Math.max(1, Math.round(parseFloat(i.value) || 1)); cart.id = null; sync(); pintar(); }); });
      $$('[data-quitar]').forEach(function (b) { b.addEventListener('click', function () { cart.items.splice(+b.getAttribute('data-quitar'), 1); cart.id = null; sync(); if (est.catalogo && catalogos().indexOf(est.catalogo) < 0) est.catalogo = catalogos().length > 1 ? catalogos()[0] : null; pintar(); }); });
      var vac = $('#vaciar'); if (vac) vac.addEventListener('click', function () { cart = { items: [], obra: '', notas: '', id: null }; guardarCart(cart); pintar(); });
      var sc = $('#sel-cat'); if (sc) sc.addEventListener('change', function () { est.catalogo = sc.value; pintar(); });
      var gu = $('#guardar'); if (gu) gu.addEventListener('click', function () {
        sync(); var m = $('#msg1');
        api('POST', '/api/presupuestos', { id: cart.id, obra: cart.obra, notas: cart.notas, items: cart.items.map(function (i) { return { ciudad: i.ciudad, slug: i.slug, cantidad: i.cantidad }; }) })
          .then(function (r) { cart.id = r.id; guardarCart(cart); mensaje(m, 'Presupuesto guardado. Lo encuentras en Mi cuenta.', 'ok'); }).catch(function (e) { mensaje(m, e.message, 'error'); });
      });
      $$('[data-ent]').forEach(function (b) { b.addEventListener('click', function () { leerPaso(); est.entrega = b.getAttribute('data-ent'); pintar(); }); });
      var ec = $('#e-ciudad'); if (ec) ec.addEventListener('change', function () { est.ciudad = ec.value; est.agencia = null; leerPaso(); pintar(); });
      $$('[data-pago]').forEach(function (b) { b.addEventListener('click', function () { est.pago = b.getAttribute('data-pago'); pintar(); }); });
      var wa = $('#pedir-wa'); if (wa) wa.addEventListener('click', function () { window.open(mensajeWa(), '_blank', 'noopener'); });
      var env = $('#enviar-pedido'); if (env) env.addEventListener('click', function () {
        var m = $('#msg4'); m.hidden = true; env.disabled = true;
        var lista = itemsDelCatalogo();
        api('POST', '/api/pedidos', { items: lista.map(function (i) { return { ciudad: i.ciudad, slug: i.slug, cantidad: i.cantidad }; }), entrega: { tipo: est.entrega, agencia: est.entrega === 'retiro' ? (est.agencia || agencias(est.ciudad)[0]) : '', direccion: est.direccion || '', fecha: est.fecha || '' }, pago: est.pago, notas: [cart.obra ? 'Obra: ' + cart.obra : '', cart.notas].filter(Boolean).join('. ') })
          .then(function (r) {
            cart.items = cart.items.filter(function (i) { return lista.indexOf(i) < 0; }); cart.id = null; guardarCart(cart);
            est.msgFinal = '<div class="done"><b>Pedido ' + esc(r.pedido.numero) + ' recibido</b><span>Tu ejecutivo lo confirmará y podrás seguir su estado en Mi cuenta.</span><div class="btn-row" style="margin-top:12px"><a class="btn btn--red" href="' + BASE + 'mi-cuenta.html">Ver mis pedidos</a><a class="btn" href="' + BASE + 'catalogo.html">Seguir comprando</a></div></div>';
            pintar();
          }).catch(function (e) { env.disabled = false; mensaje(m, e.message, 'error'); m.classList.add('error'); });
      });
    }
    var cats = catalogos(); est.catalogo = cats.length > 1 ? cats[0] : null;
    cargarPrecios().then(pintar);
  }

  function paginaCuenta(s) {
    var app = $('#app'), u = s.usuario; if (apiCaida) { app.innerHTML = SIN_API; return; }
    if (!u) { location.href = BASE + 'ingresar.html?volver=mi-cuenta.html'; return; }
    if (u.rol !== 'cliente') { location.href = BASE + 'equipo.html'; return; }
    var ciu = cityBySlug(u.ciudad) || ciudadActual();
    Promise.all([api('GET', '/api/presupuestos'), api('GET', '/api/pedidos')]).then(function (r) {
      var pres = r[0].presupuestos, peds = r[1].pedidos;
      var estado = u.estado === 'verificado' ? '<span class="chip ok">Cliente verificado</span>' : u.estado === 'pendiente' ? '<span class="chip warn">Cuenta en revisión</span>' : '<span class="chip">Cuenta rechazada</span>';
      app.innerHTML = '<div class="acct-head"><div>' + estado + '<h2 style="margin-top:10px">' + esc(u.razon_social || u.nombre) + '</h2><p class="muted">' + esc(TIPOS[u.tipo]) + ' · ' + esc(NOMBRE_CIUDAD[u.ciudad]) + (u.nit ? ' · NIT ' + esc(u.nit) : '') + '</p></div>' +
        '<div class="btn-row"><a class="btn btn--wa" target="_blank" rel="noopener" href="' + waUrl(ciu.whatsapp, 'Hola, soy ' + u.nombre + (u.nit ? ' (NIT ' + u.nit + ')' : '') + '. Quisiera hablar con mi ejecutivo.') + '">Hablar con mi ejecutivo</a><a class="btn btn--red" href="' + BASE + 'catalogo.html">Ver productos</a></div></div>' +
        (u.estado === 'pendiente' ? '<p class="price-note">Un ejecutivo de ' + esc(NOMBRE_CIUDAD[u.ciudad]) + ' está verificando tu cuenta. Cuando termine verás los precios de tu ciudad y podrás enviar pedidos. Mientras, puedes armar presupuestos.</p>' : '') +
        '<section style="margin-top:40px"><h3>Presupuestos guardados</h3>' + (pres.length ? '<div class="scroll"><table class="tabla"><thead><tr><th>N°</th><th>Obra</th><th>Estado</th><th class="num">Productos</th><th class="num">Total</th><th>Actualizado</th><th></th></tr></thead><tbody>' + pres.map(function (p) { return '<tr><td>P-' + String(p.id).padStart(4, '0') + '</td><td>' + esc(p.obra || '—') + '</td><td><span class="chip">' + esc({ borrador: 'Borrador', enviado: 'Enviado', convertido: 'Convertido en pedido' }[p.estado]) + '</span></td><td class="num">' + p.productos + '</td><td class="num">' + (p.total_estimado != null ? fmtBs(p.total_estimado) : '—') + '</td><td>' + esc(p.actualizado_en.slice(0, 10)) + '</td><td class="btn-row">' + (p.estado !== 'convertido' ? '<button class="btn btn--sm" data-abrir="' + p.id + '">Abrir</button><button class="btn btn--sm btn--ghost" data-borrar="' + p.id + '">Eliminar</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="muted" style="margin-top:8px">Aún no guardaste ningún presupuesto.</p>') + '</section>' +
        '<section style="margin-top:40px"><h3>Pedidos</h3>' + (peds.length ? '<div class="scroll"><table class="tabla"><thead><tr><th>N°</th><th>Fecha</th><th>Estado</th><th>Entrega</th><th class="num">Total</th><th></th></tr></thead><tbody>' + peds.map(function (p) { return '<tr><td><b>' + esc(p.numero) + '</b></td><td>' + esc(p.creado_en.slice(0, 10)) + '</td><td><span class="chip ' + (p.estado === 'entregado' ? 'ok' : '') + '">' + ESTADOS[p.estado] + '</span></td><td>' + (p.entrega_tipo === 'retiro' ? 'Retiro' : 'Envío') + ' · ' + esc(NOMBRE_CIUDAD[p.ciudad] || p.ciudad) + '</td><td class="num">' + (p.total_estimado != null ? fmtBs(p.total_estimado) : '—') + '</td><td class="btn-row"><button class="btn btn--sm" data-detalle="' + p.id + '">Ver</button><button class="btn btn--sm" data-repetir="' + p.id + '">Repetir</button></td></tr><tr class="detalle" id="det-' + p.id + '" hidden><td colspan="6"></td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="muted" style="margin-top:8px">Todavía no hiciste pedidos.</p>') + '</section>';
      $$('[data-abrir]').forEach(function (b) { b.addEventListener('click', function () {
        api('GET', '/api/presupuestos/' + b.getAttribute('data-abrir')).then(function (r2) { var p = r2.presupuesto; guardarCart({ id: p.id, obra: p.obra || '', notas: p.notas || '', items: p.items.map(function (i) { return { ciudad: i.ciudad, slug: i.slug, nombre: i.nombre, codigo: i.codigo || '', cantidad: i.cantidad }; }) }); location.href = BASE + 'presupuesto.html'; }).catch(function (e) { aviso(e.message); });
      }); });
      $$('[data-borrar]').forEach(function (b) { b.addEventListener('click', function () { api('DELETE', '/api/presupuestos/' + b.getAttribute('data-borrar')).then(function () { location.reload(); }).catch(function (e) { aviso(e.message); }); }); });
      $$('[data-repetir]').forEach(function (b) { b.addEventListener('click', function () {
        api('POST', '/api/pedidos/' + b.getAttribute('data-repetir') + '/repetir', {}).then(function (r2) { guardarCart({ id: null, obra: '', notas: '', items: r2.items }); location.href = BASE + 'presupuesto.html'; }).catch(function (e) { aviso(e.message); });
      }); });
      $$('[data-detalle]').forEach(function (b) { b.addEventListener('click', function () {
        var fila = $('#det-' + b.getAttribute('data-detalle')); if (!fila.hidden) { fila.hidden = true; return; }
        api('GET', '/api/pedidos/' + b.getAttribute('data-detalle')).then(function (r2) {
          var p = r2.pedido; var pasos = ['recibido', 'confirmado', 'en_despacho', 'entregado'], idx = pasos.indexOf(p.estado);
          fila.firstChild.innerHTML = '<div class="timeline">' + pasos.map(function (e, k) { return '<span class="paso' + (k <= idx ? ' on' : '') + '">' + ESTADOS[e] + '</span>'; }).join('') + (p.estado === 'anulado' ? '<span class="paso anulado">Anulado</span>' : '') + '</div>' +
            '<table class="specs"><tbody>' + p.items.map(function (i) { return '<tr><th>' + esc(i.nombre) + '</th><td>' + fmtN(i.cantidad) + ' × ' + (i.precio_unitario != null ? fmtBs(i.precio_unitario) : '—') + ' = ' + (i.subtotal != null ? fmtBs(i.subtotal) : '—') + '</td></tr>'; }).join('') + '</tbody></table>' +
            '<p class="muted">Entrega: ' + (p.entrega_tipo === 'retiro' ? 'retiro en ' + esc(p.entrega_agencia) : 'envío a ' + esc(p.entrega_direccion)) + ' · Pago: ' + esc(p.pago) + (p.notas ? ' · ' + esc(p.notas) : '') + '</p>';
          fila.hidden = false;
        }).catch(function (e) { aviso(e.message); });
      }); });
    }).catch(function (e) { app.innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; });
  }

  function paginaEquipo(s) {
    var app = $('#app'), u = s.usuario; if (apiCaida) { app.innerHTML = SIN_API; return; }
    if (!u) { location.href = BASE + 'ingresar.html?volver=equipo.html'; return; }
    if (u.rol === 'cliente') { app.innerHTML = '<div class="empty"><b>Esta sección es para el equipo de INCERPAZ.</b></div>'; return; }
    var LISTAS = JSON.parse($('#datos-listas').textContent);
    var tab = 'cuentas';
    function cuentas() {
      return api('GET', '/api/admin/cuentas?estado=pendiente').then(function (r) {
        if (!r.cuentas.length) return '<p class="muted">No hay cuentas por verificar.</p>';
        return '<div class="scroll"><table class="tabla"><thead><tr><th>Cliente</th><th>Tipo</th><th>Ciudad</th><th>NIT</th><th>Contacto</th><th>Lista de precios</th><th></th></tr></thead><tbody>' + r.cuentas.map(function (c) {
          var wa = waUrl(c.celular, 'Hola ' + c.nombre + ', somos INCERPAZ. Estamos verificando tu cuenta en el sitio.');
          return '<tr><td><b>' + esc(c.razon_social || c.nombre) + '</b><br><span class="muted">' + esc(c.nombre) + '</span></td><td>' + esc(TIPOS[c.tipo]) + '</td><td>' + esc(NOMBRE_CIUDAD[c.ciudad]) + '</td><td>' + esc(c.nit || '—') + (c.erp_id ? '<br><span class="muted">ERP ' + esc(c.erp_id) + '</span>' : '') + '</td><td><a href="' + wa + '" target="_blank" rel="noopener">' + esc(c.celular) + '</a><br><span class="muted">' + esc(c.correo) + '</span></td><td><select class="sel" data-lista="' + c.id + '">' + LISTAS.map(function (l) { return '<option' + (l === c.lista_precios ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select></td><td class="btn-row"><button class="btn btn--sm btn--wa" data-ver="' + c.id + '">Verificar</button><button class="btn btn--sm btn--ghost" data-rech="' + c.id + '">Rechazar</button></td></tr>';
        }).join('') + '</tbody></table></div>';
      });
    }
    function pedidos() {
      return api('GET', '/api/admin/pedidos').then(function (r) {
        if (!r.pedidos.length) return '<p class="muted">Todavía no hay pedidos.</p>';
        return '<div class="scroll"><table class="tabla"><thead><tr><th>N°</th><th>Cliente</th><th>Ciudad</th><th>Entrega</th><th class="num">Total</th><th>ERP</th><th>Estado</th></tr></thead><tbody>' + r.pedidos.map(function (p) {
          return '<tr><td><b>' + esc(p.numero) + '</b><br><span class="muted">' + esc(p.creado_en.slice(0, 16)) + '</span></td><td>' + esc(p.cliente) + '<br><a href="' + waUrl(p.celular, 'Hola, sobre tu pedido ' + p.numero + ' en INCERPAZ.') + '" target="_blank" rel="noopener">' + esc(p.celular) + '</a></td><td>' + esc(NOMBRE_CIUDAD[p.ciudad] || p.ciudad) + '</td><td>' + (p.entrega_tipo === 'retiro' ? 'Retiro ' + esc(p.entrega_agencia || '') : 'Envío ' + esc(p.entrega_direccion || '')) + '<br><span class="muted">' + esc(p.pago) + '</span></td><td class="num">' + (p.total_estimado != null ? fmtBs(p.total_estimado) : '—') + '</td><td>' + (p.erp_ref ? esc(p.erp_ref) : p.erp_error ? '<span class="chip warn" title="' + esc(p.erp_error) + '">No llegó al ERP</span>' : '—') + '</td><td><select class="sel" data-estado="' + p.id + '">' + Object.keys(ESTADOS).map(function (e) { return '<option value="' + e + '"' + (e === p.estado ? ' selected' : '') + '>' + ESTADOS[e] + '</option>'; }).join('') + '</select></td></tr>';
        }).join('') + '</tbody></table></div>';
      });
    }
    function pintar() {
      app.innerHTML = '<div class="seg" role="group" aria-label="Sección"><button type="button" data-tab="cuentas" aria-pressed="' + (tab === 'cuentas') + '">Cuentas por verificar</button><button type="button" data-tab="pedidos" aria-pressed="' + (tab === 'pedidos') + '">Pedidos</button></div><p class="muted" style="margin-top:12px">' + esc(u.nombre) + ' · ' + (u.rol === 'admin' ? 'todas las ciudades · <a href="' + BASE + 'admin.html"><b>Administrar el sitio</b></a>' : esc(NOMBRE_CIUDAD[u.ciudad])) + '</p><div id="panel" style="margin-top:18px">Cargando…</div>';
      $$('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { tab = b.getAttribute('data-tab'); pintar(); }); });
      (tab === 'cuentas' ? cuentas() : pedidos()).then(function (html) {
        $('#panel').innerHTML = html;
        $$('[data-ver]').forEach(function (b) { b.addEventListener('click', function () { var id = b.getAttribute('data-ver'); api('POST', '/api/admin/cuentas/' + id, { accion: 'verificar', lista_precios: $('[data-lista="' + id + '"]').value }).then(function () { aviso('Cuenta verificada'); pintar(); }).catch(function (e) { aviso(e.message); }); }); });
        $$('[data-rech]').forEach(function (b) { b.addEventListener('click', function () { api('POST', '/api/admin/cuentas/' + b.getAttribute('data-rech'), { accion: 'rechazar' }).then(function () { aviso('Cuenta rechazada'); pintar(); }).catch(function (e) { aviso(e.message); }); }); });
        $$('[data-estado]').forEach(function (sl) { sl.addEventListener('change', function () { api('POST', '/api/admin/pedidos/' + sl.getAttribute('data-estado') + '/estado', { estado: sl.value }).then(function () { aviso('Estado actualizado'); }).catch(function (e) { aviso(e.message); }); }); });
      }).catch(function (e) { $('#panel').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; });
    }
    pintar();
  }

  /* ---------- arranque ---------- */
  contador();
  /* lo usan las herramientas del sitio (proyectos) para sumar al presupuesto y leer precios */
  window.IncerpazPresupuesto = { añadir: function (it, n) { añadir(it, n); }, precios: precios, sesion: sesion, aviso: aviso, fmtBs: fmtBs, verificado: verificado };
  sesion.then(function (s) {
    pintarCabecera(s); pintarPrecios(s);
    if (PAGINA === 'ingresar') paginaIngresar(s);
    else if (PAGINA === 'registro') paginaRegistro(s);
    else if (PAGINA === 'presupuesto') paginaPresupuesto(s);
    else if (PAGINA === 'cuenta') paginaCuenta(s);
    else if (PAGINA === 'equipo') paginaEquipo(s);
  });
})();
