/* INCERPAZ — panel de administración del contenido (solo administradores).
   Productos, precios, agencias y contacto, equipo e historial. Habla con /api/admin/*. */
(function () {
  'use strict';
  var BASE = document.body.getAttribute('data-base') || '';
  var raiz = document.getElementById('app'); if (!raiz) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var CIUDADES = { cochabamba: 'Cochabamba', 'santa-cruz': 'Santa Cruz', oruro: 'Oruro', sucre: 'Sucre' };
  var CATALOGOS = { cochabamba: 'Cochabamba', 'santa-cruz': 'Santa Cruz' };
  var MEDIDAS = ['Alto', 'Largo', 'Ancho', 'Alto superior', 'Alto inferior', 'Ancho superior', 'Ancho inferior', 'Diámetro', 'Espesor'];
  var est = { tab: 'productos', cat: 'cochabamba', q: '', datos: null, editando: null, precios: null, cambiosPrecios: {} };

  function api(metodo, ruta, cuerpo) {
    return fetch(ruta, { method: metodo, credentials: 'same-origin', headers: Object.assign({ 'X-Requested-With': 'incerpaz' }, cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}), body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || 'Error'); e.status = r.status; throw e; } return j; }); });
  }
  function aviso(t) {
    var el = $('#toast'); if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = t; el.classList.add('on'); clearTimeout(aviso.t); aviso.t = setTimeout(function () { el.classList.remove('on'); }, 3600);
  }
  function guardando(boton, promesa, ok) {
    var t = boton.textContent; boton.disabled = true; boton.textContent = 'Guardando…';
    return promesa.then(function (r) { aviso(ok || 'Guardado'); return r; }, function (e) { aviso(e.message); throw e; }).then(function (r) { boton.disabled = false; boton.textContent = t; return r; }, function (e) { boton.disabled = false; boton.textContent = t; throw e; });
  }
  function recargar() { return api('GET', '/api/admin/contenido').then(function (d) { est.datos = d; }); }

  /* ---------- estructura ---------- */
  var TABS_ADMIN = [['productos', 'Productos'], ['precios', 'Precios'], ['promos', 'Promociones'], ['agencias', 'Agencias y contacto'], ['equipo', 'Equipo'], ['historial', 'Historial']];
  var TABS_EJECUTIVO = [['promos', 'Promociones de tu ciudad']];
  function marco(contenido) {
    var TABS = est.rol === 'admin' ? TABS_ADMIN : TABS_EJECUTIVO;
    raiz.innerHTML = '<div class="seg" role="tablist" style="margin-bottom:24px">' + TABS.map(function (t) { return '<button type="button" data-tab="' + t[0] + '" aria-pressed="' + (est.tab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div><div id="vista">' + contenido + '</div>';
    $$('[data-tab]', raiz).forEach(function (b) { b.addEventListener('click', function () { est.tab = b.getAttribute('data-tab'); est.editando = null; pintar(); }); });
  }
  function pintar() {
    if (est.tab === 'productos') return est.editando ? formProducto() : listaProductos();
    if (est.tab === 'precios') return vistaPrecios();
    if (est.tab === 'promos') return vistaPromos();
    if (est.tab === 'agencias') return vistaAgencias();
    if (est.tab === 'equipo') return vistaEquipo();
    return vistaHistorial();
  }
  var campo = function (etq, nombre, valor, extra) { return '<label>' + etq + '<input name="' + nombre + '" value="' + esc(valor) + '" ' + (extra || '') + '></label>'; };

  /* ---------- productos ---------- */
  function listaProductos() {
    var d = est.datos, q = est.q.toLowerCase();
    var cats = Object.fromEntries(d.categorias.map(function (c) { return [c.slug, c.nombre]; }));
    var filas = d.productos.filter(function (p) { return p.ciudad === est.cat && (p.titulo + ' ' + p.codigo).toLowerCase().indexOf(q) >= 0; });
    marco('<div class="btn-row" style="margin-bottom:16px;align-items:center">' +
      '<div class="seg">' + Object.keys(CATALOGOS).map(function (c) { return '<button type="button" data-cat="' + c + '" aria-pressed="' + (est.cat === c) + '">' + CATALOGOS[c] + '</button>'; }).join('') + '</div>' +
      '<input id="q" type="search" placeholder="Buscar producto o código" value="' + esc(est.q) + '" style="max-width:280px"><button class="btn btn--red btn--sm" id="nuevo" type="button">Nuevo producto</button></div>' +
      '<p class="muted" style="margin-bottom:12px">' + filas.length + ' productos en el catálogo de ' + CATALOGOS[est.cat] + '. Los cambios se publican al guardar.</p>' +
      '<div class="scroll"><table class="tabla"><thead><tr><th></th><th>Producto</th><th>Código</th><th>Categorías</th><th>Imágenes</th><th></th></tr></thead><tbody>' +
      filas.map(function (p) { return '<tr><td><img src="/' + esc(p.imagenes[0] || 'assets/img/logo-icono.png') + '" alt="" width="48" height="48" style="object-fit:cover"></td><td><b>' + esc(p.titulo) + '</b>' + (p.a_pedido ? ' <span class="chip warn">A pedido</span>' : '') + '<br><span class="muted">' + esc(p.linea) + '</span></td><td>' + esc(p.codigo) + '</td><td>' + esc(p.categorias.map(function (c) { return cats[c]; }).join(', ')) + '</td><td class="num">' + p.imagenes.length + '</td><td><button class="btn btn--sm" data-edit="' + esc(p.slug) + '" type="button">Editar</button></td></tr>'; }).join('') +
      '</tbody></table></div>');
    $$('[data-cat]').forEach(function (b) { b.addEventListener('click', function () { est.cat = b.getAttribute('data-cat'); pintar(); }); });
    $('#q').addEventListener('input', function (e) { est.q = e.target.value; var pos = e.target.selectionStart; listaProductos(); var n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); });
    $('#nuevo').addEventListener('click', function () { est.editando = { nuevo: true, p: { ciudad: est.cat, slug: '', titulo: '', codigo: '', linea: '', descripcion: '', color: '', acabado: '', medidas: [['Alto', ''], ['Largo', ''], ['Ancho', '']], peso: '', rendimiento: '', a_pedido: false, categorias: [], imagenes: [] } }; pintar(); });
    $$('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { var p = d.productos.filter(function (x) { return x.ciudad === est.cat && x.slug === b.getAttribute('data-edit'); })[0]; est.editando = { nuevo: false, p: JSON.parse(JSON.stringify(p)) }; pintar(); window.scrollTo(0, 0); }); });
  }
  function formProducto() {
    var e = est.editando, p = e.p, d = est.datos;
    function medidasHtml() { return p.medidas.map(function (m, i) { return '<div class="btn-row" style="gap:8px;margin-bottom:8px"><input list="medidas" data-m="' + i + '" data-k="0" value="' + esc(m[0]) + '" style="max-width:200px" aria-label="Medida"><input data-m="' + i + '" data-k="1" type="number" step="any" min="0" value="' + esc(m[1]) + '" style="max-width:140px" aria-label="Valor en cm"><span class="muted">cm</span><button type="button" class="btn btn--sm btn--ghost" data-delm="' + i + '">Quitar</button></div>'; }).join(''); }
    function imgsHtml() { return p.imagenes.map(function (src, i) { return '<div style="display:inline-block;margin:0 10px 10px 0;text-align:center"><img src="/' + esc(src) + '" alt="" width="96" height="96" style="object-fit:cover;display:block"><button type="button" class="btn btn--sm btn--ghost" data-up="' + i + '"' + (i === 0 ? ' disabled' : '') + ' aria-label="Mover antes">←</button><button type="button" class="btn btn--sm btn--ghost" data-delimg="' + i + '">Quitar</button></div>'; }).join('') || '<p class="muted">Sin imágenes.</p>'; }
    marco('<h2 style="font-size:28px;margin-bottom:16px">' + (e.nuevo ? 'Nuevo producto en ' + CATALOGOS[p.ciudad] : 'Editar: ' + esc(p.titulo)) + '</h2>' +
      '<form id="f" class="form-box"><div class="form-grid">' +
      campo('Nombre', 'titulo', p.titulo, 'required maxlength="120"') + (e.nuevo ? campo('Identificador (para la dirección web)', 'slug', p.slug, 'required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="ej. 8-huecos-nuevo"') : '<label>Identificador<input value="' + esc(p.slug) + '" disabled></label>') +
      campo('Código', 'codigo', p.codigo, 'maxlength="40"') + campo('Línea', 'linea', p.linea, 'maxlength="60" placeholder="BRICK, PAVIC, TEJAS…"') +
      campo('Color', 'color', p.color, 'maxlength="60"') + campo('Acabado', 'acabado', p.acabado, 'maxlength="200"') +
      '<label class="full">Descripción<textarea name="descripcion" rows="3" maxlength="600">' + esc(p.descripcion) + '</textarea></label>' +
      campo('Peso por pieza (kg)', 'peso', p.peso == null ? '' : p.peso, 'type="number" step="any" min="0"') + campo('Rendimiento', 'rendimiento', p.rendimiento, 'maxlength="200" placeholder="45 Pzas/m2"') +
      '<label class="full" style="display:flex;flex-direction:row;align-items:center;gap:10px"><input type="checkbox" name="a_pedido"' + (p.a_pedido ? ' checked' : '') + ' style="width:auto"> Se fabrica solo a pedido</label></div>' +
      '<h3 style="margin:22px 0 8px">Categorías</h3><div class="chips">' + d.categorias.map(function (c) { return '<label class="chip" style="display:inline-flex;flex-direction:row;gap:8px;align-items:center"><input type="checkbox" data-cat="' + c.slug + '"' + (p.categorias.indexOf(c.slug) >= 0 ? ' checked' : '') + ' style="width:auto"> ' + esc(c.nombre) + '</label>'; }).join('') + '</div>' +
      '<h3 style="margin:22px 0 8px">Medidas</h3><datalist id="medidas">' + MEDIDAS.map(function (m) { return '<option value="' + m + '">'; }).join('') + '</datalist><div id="medidas-box">' + medidasHtml() + '</div><button type="button" class="btn btn--sm" id="addm">Agregar medida</button>' +
      '<h3 style="margin:22px 0 8px">Imágenes <span class="muted" style="font-weight:400;font-size:15px">(la primera es la principal)</span></h3><div id="imgs">' + imgsHtml() + '</div><label class="btn btn--sm" style="cursor:pointer;display:inline-block">Subir imagen<input id="subir" type="file" accept="image/jpeg,image/png,image/webp" hidden></label>' +
      '<div class="btn-row" style="margin-top:28px"><button class="btn btn--red" type="submit">' + (e.nuevo ? 'Crear producto' : 'Guardar cambios') + '</button><button class="btn" type="button" id="cancelar">Cancelar</button>' + (e.nuevo ? '' : '<button class="btn btn--ghost" type="button" id="borrar">Eliminar producto</button>') + '</div></form>');
    function leerForm() {
      var f = $('#f'), r = Object.assign({}, p);
      ['titulo', 'slug', 'codigo', 'linea', 'color', 'acabado', 'descripcion', 'peso', 'rendimiento'].forEach(function (k) { if (f.elements[k] && !f.elements[k].disabled) r[k] = f.elements[k].value; });
      r.a_pedido = f.elements.a_pedido.checked;
      r.categorias = $$('[data-cat]', f).filter(function (c) { return c.checked; }).map(function (c) { return c.getAttribute('data-cat'); });
      p = e.p = r; return r;
    }
    function sincMedidas() { $$('[data-m]').forEach(function (i) { p.medidas[+i.getAttribute('data-m')][+i.getAttribute('data-k')] = i.value; }); }
    function redibujar() { leerForm(); sincMedidas(); formProducto(); }
    $('#addm').addEventListener('click', function () { sincMedidas(); p.medidas.push(['', '']); redibujar(); });
    $$('[data-delm]').forEach(function (b) { b.addEventListener('click', function () { sincMedidas(); p.medidas.splice(+b.getAttribute('data-delm'), 1); redibujar(); }); });
    $$('[data-delimg]').forEach(function (b) { b.addEventListener('click', function () { p.imagenes.splice(+b.getAttribute('data-delimg'), 1); redibujar(); }); });
    $$('[data-up]').forEach(function (b) { b.addEventListener('click', function () { var i = +b.getAttribute('data-up'); p.imagenes.splice(i - 1, 0, p.imagenes.splice(i, 1)[0]); redibujar(); }); });
    $('#subir').addEventListener('change', function (ev) {
      var a = ev.target.files[0]; if (!a) return;
      if (a.size > 3_000_000) return aviso('La imagen debe pesar menos de 3 MB');
      var lector = new FileReader();
      lector.onload = function () { api('POST', '/api/admin/imagenes', { datos: String(lector.result).split(',')[1] }).then(function (r) { p.imagenes.push(r.ruta); redibujar(); aviso('Imagen subida'); }).catch(function (x) { aviso(x.message); }); };
      lector.readAsDataURL(a);
    });
    $('#cancelar').addEventListener('click', function () { est.editando = null; pintar(); });
    if ($('#borrar')) $('#borrar').addEventListener('click', function () {
      if (!confirm('¿Eliminar "' + p.titulo + '" del catálogo de ' + CATALOGOS[p.ciudad] + '? También se borran sus precios.')) return;
      guardando($('#borrar'), api('DELETE', '/api/admin/productos/' + p.ciudad + '/' + p.slug), 'Producto eliminado').then(recargar).then(function () { est.editando = null; pintar(); });
    });
    $('#f').addEventListener('submit', function (ev) {
      ev.preventDefault(); sincMedidas(); var r = leerForm();
      r.medidas = r.medidas.filter(function (m) { return m[0] && m[1] !== ''; });
      var envio = e.nuevo ? api('POST', '/api/admin/productos', r) : api('PUT', '/api/admin/productos/' + r.ciudad + '/' + r.slug, r);
      guardando($('#f button[type=submit]'), envio, e.nuevo ? 'Producto creado y publicado' : 'Cambios publicados').then(recargar).then(function () { est.editando = null; pintar(); });
    });
  }

  /* ---------- precios ---------- */
  function vistaPrecios() {
    marco('<p class="muted">Cargando precios…</p>');
    api('GET', '/api/admin/precios?ciudad=' + est.cat).then(function (r) { est.precios = r; dibujarPrecios(); }).catch(function (e) { aviso(e.message); });
  }
  function dibujarPrecios() {
    var r = est.precios; est.cambiosPrecios = {};
    marco('<div class="btn-row" style="margin-bottom:16px;align-items:center"><div class="seg">' + Object.keys(CATALOGOS).map(function (c) { return '<button type="button" data-cat="' + c + '" aria-pressed="' + (est.cat === c) + '">' + CATALOGOS[c] + '</button>'; }).join('') + '</div></div>' +
      '<p class="muted" style="margin-bottom:12px">Precio por pieza en bolivianos. Si "Constructor" queda vacío se usa el precio general. Solo los clientes verificados ven estos precios.</p>' +
      '<label style="display:block;max-width:560px;margin-bottom:16px">Nota que acompaña a los precios de ' + CATALOGOS[est.cat] + '<input id="nota" value="' + esc(r.nota) + '" maxlength="200" placeholder="Ej. Precio puesto en obra dentro del radio urbano"></label>' +
      '<div class="scroll"><table class="tabla"><thead><tr><th>Producto</th><th>Código</th><th class="num">General (Bs)</th><th class="num">Constructor (Bs)</th><th>Actualizado</th></tr></thead><tbody>' +
      r.productos.map(function (p) { var pv = function (l) { return Object.prototype.hasOwnProperty.call(p.precios, l) ? p.precios[l] : ''; }; return '<tr><td>' + esc(p.nombre) + '</td><td>' + esc(p.codigo) + '</td>' + ['general', 'constructor'].map(function (l) { return '<td class="num"><input type="number" step="0.01" min="0" data-slug="' + esc(p.slug) + '" data-lista="' + l + '" data-cod="' + esc(p.codigo) + '" value="' + pv(l) + '" data-orig="' + pv(l) + '" style="width:110px;text-align:right" aria-label="' + esc(p.nombre) + ' ' + l + '"></td>'; }).join('') + '<td class="muted">' + esc(p.actualizado_en || '—') + '</td></tr>'; }).join('') +
      '</tbody></table></div>' +
      '<div class="btn-row" style="margin-top:20px;align-items:center"><button class="btn btn--red" id="guardar" type="button">Guardar precios</button><label class="btn" style="cursor:pointer">Cargar desde CSV<input id="csv" type="file" accept=".csv,text/csv,text/plain" hidden></label><span class="muted">CSV con columnas: código; precio general; precio constructor (opcional)</span></div>');
    $$('[data-cat]').forEach(function (b) { b.addEventListener('click', function () { est.cat = b.getAttribute('data-cat'); vistaPrecios(); }); });
    $$('input[data-slug]').forEach(function (i) { i.addEventListener('input', function () { i.style.background = i.value !== i.getAttribute('data-orig') ? '#fff4cc' : ''; }); });
    $('#csv').addEventListener('change', function (ev) {
      var a = ev.target.files[0]; if (!a) return; var l = new FileReader();
      l.onload = function () {
        var n = 0, sin = [];
        String(l.result).split(/\r?\n/).forEach(function (linea) {
          var c = linea.split(/[;,\t]/).map(function (x) { return x.trim(); }); if (!c[0]) return;
          var gen = $$('input[data-cod]').filter(function (i) { return i.getAttribute('data-cod') === c[0]; });
          if (!gen.length) { if (isNaN(parseFloat(c[1]))) return; sin.push(c[0]); return; }
          [['general', c[1]], ['constructor', c[2]]].forEach(function (par) {
            var v = parseFloat(String(par[1] || '').replace(',', '.')); if (isNaN(v)) return;
            var inp = gen.filter(function (i) { return i.getAttribute('data-lista') === par[0]; })[0]; inp.value = v; inp.dispatchEvent(new Event('input')); n += 1;
          });
        });
        aviso(n + ' precios cargados; revisa y guarda.' + (sin.length ? ' Códigos no encontrados: ' + sin.slice(0, 5).join(', ') : ''));
      };
      l.readAsText(a);
    });
    $('#guardar').addEventListener('click', function () {
      var cambios = $$('input[data-slug]').filter(function (i) { return i.value !== i.getAttribute('data-orig'); }).map(function (i) { return { slug: i.getAttribute('data-slug'), lista: i.getAttribute('data-lista'), precio: i.value === '' ? null : Number(i.value) }; });
      guardando($('#guardar'), api('PUT', '/api/admin/precios', { ciudad: est.cat, cambios: cambios, nota: $('#nota').value }), cambios.length + ' cambios guardados').then(vistaPrecios);
    });
  }

  /* ---------- agencias y contacto ---------- */
  function vistaAgencias() {
    var s = est.datos.sitio;
    marco(Object.keys(CIUDADES).map(function (c) {
      var ci = s.ciudades.filter(function (x) { return x.slug === c; })[0];
      return '<section style="margin-bottom:36px"><h2 style="font-size:28px;margin-bottom:8px">' + CIUDADES[c] + '</h2>' +
        '<label style="display:block;max-width:300px;margin-bottom:16px">WhatsApp de la ciudad (8 dígitos)<input data-wa-ciudad="' + c + '" value="' + esc(ci.whatsapp) + '" inputmode="numeric" maxlength="8"></label>' +
        '<div data-lista="' + c + '">' + (s.agencias[c] || []).map(function (a, i) { return tarjetaAgencia(c, a, i); }).join('') + '</div>' +
        '<button class="btn btn--sm" type="button" data-add="' + c + '">Agregar agencia o fábrica</button></section>';
    }).join('') +
      '<section><h2 style="font-size:28px;margin-bottom:8px">Contacto general y redes</h2><div class="form-grid" style="max-width:760px">' +
      campo('Correo de ventas', 'correo', s.correo) + campo('Servicio al cliente (texto)', 'sc_texto', s.servicio_cliente.texto) + campo('Servicio al cliente (solo números)', 'sc_tel', s.servicio_cliente.tel) +
      campo('Facebook', 'facebook', s.redes.facebook) + campo('Instagram', 'instagram', s.redes.instagram) + campo('YouTube', 'youtube', s.redes.youtube) + '</div></section>' +
      '<div class="btn-row" style="margin-top:28px"><button class="btn btn--red" id="guardar" type="button">Guardar y publicar</button></div>');
    function sincronizar() {
      $$('[data-wa-ciudad]').forEach(function (i) { s.ciudades.filter(function (x) { return x.slug === i.getAttribute('data-wa-ciudad'); })[0].whatsapp = i.value.trim(); });
      Object.keys(CIUDADES).forEach(function (c) {
        s.agencias[c] = $$('[data-ag]', $('[data-lista="' + c + '"]')).map(function (t) {
          var g = function (n) { return $('[name="' + n + '"]', t).value; };
          return { nombre: g('nombre'), tipo: g('tipo'), direccion: g('direccion'), telefonos: g('telefonos').split(/[,\n]/).map(function (x) { return x.trim(); }).filter(Boolean), whatsapp: g('whatsapp').trim() };
        });
      });
      s.correo = $('[name=correo]').value; s.servicio_cliente = { texto: $('[name=sc_texto]').value, tel: $('[name=sc_tel]').value };
      s.redes = { facebook: $('[name=facebook]').value, instagram: $('[name=instagram]').value, youtube: $('[name=youtube]').value };
    }
    $$('[data-add]').forEach(function (b) { b.addEventListener('click', function () { sincronizar(); s.agencias[b.getAttribute('data-add')].push({ nombre: '', tipo: 'agencia', direccion: '', telefonos: [], whatsapp: '' }); vistaAgencias(); }); });
    $$('[data-del]').forEach(function (b) { b.addEventListener('click', function () { var n = b.getAttribute('data-del').split(':'); if (!confirm('¿Quitar esta agencia del sitio?')) return; sincronizar(); s.agencias[n[0]].splice(+n[1], 1); vistaAgencias(); }); });
    $('#guardar').addEventListener('click', function () {
      sincronizar();
      guardando($('#guardar'), api('PUT', '/api/admin/sitio', s), 'Cambios publicados en el sitio').then(recargar).then(vistaAgencias);
    });
  }
  function tarjetaAgencia(c, a, i) {
    return '<div class="form-box" data-ag style="margin-bottom:14px"><div class="form-grid">' + campo('Nombre', 'nombre', a.nombre, 'maxlength="80"') +
      '<label>Tipo<select name="tipo"><option value="agencia"' + (a.tipo === 'agencia' ? ' selected' : '') + '>Agencia</option><option value="fabrica"' + (a.tipo === 'fabrica' ? ' selected' : '') + '>Fábrica</option></select></label>' +
      '<label class="full">Dirección<input name="direccion" value="' + esc(a.direccion) + '" maxlength="200"></label>' +
      campo('Teléfonos (separados por coma)', 'telefonos', a.telefonos.join(', '), 'placeholder="4-4271684, 4-4271685"') + campo('WhatsApp (8 dígitos)', 'whatsapp', a.whatsapp, 'inputmode="numeric" maxlength="8"') +
      '</div><button class="btn btn--sm btn--ghost" type="button" data-del="' + c + ':' + i + '" style="margin-top:12px">Quitar</button></div>';
  }

  /* ---------- equipo ---------- */
  function vistaEquipo() {
    marco('<p class="muted">Cargando…</p>');
    api('GET', '/api/admin/equipo').then(function (r) {
      marco('<div class="scroll"><table class="tabla"><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Ciudad</th><th>Estado</th><th></th></tr></thead><tbody>' + r.equipo.map(function (u) {
        return '<tr><td>' + esc(u.nombre) + '</td><td>' + esc(u.correo) + '</td><td>' + esc(u.rol) + '</td><td>' + esc(CIUDADES[u.ciudad]) + '</td><td>' + (u.estado === 'verificado' ? 'Activa' : 'De baja') + '</td><td>' + (u.estado === 'verificado' ? '<button class="btn btn--sm btn--ghost" data-baja="' + u.id + '" type="button">Dar de baja</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        '<h2 style="font-size:26px;margin:32px 0 12px">Nueva cuenta del equipo</h2><form id="nueva" class="form-box" style="max-width:720px"><div class="form-grid">' +
        campo('Nombre', 'nombre', '', 'required') + campo('Correo', 'correo', '', 'type="email" required') +
        '<label>Rol<select name="rol"><option value="ejecutivo">Ejecutivo (verifica clientes y atiende pedidos de su ciudad)</option><option value="admin">Administrador (todo, incluido este panel)</option></select></label>' +
        '<label>Ciudad<select name="ciudad">' + Object.keys(CIUDADES).map(function (c) { return '<option value="' + c + '">' + CIUDADES[c] + '</option>'; }).join('') + '</select></label>' +
        '<label class="full">Contraseña inicial (10 caracteres o más)<input name="password" type="password" minlength="10" required autocomplete="new-password"></label></div>' +
        '<div class="btn-row" style="margin-top:16px"><button class="btn btn--red" type="submit">Crear cuenta</button></div></form>');
      $$('[data-baja]').forEach(function (b) { b.addEventListener('click', function () { if (!confirm('¿Dar de baja esta cuenta? Ya no podrá ingresar.')) return; guardando(b, api('POST', '/api/admin/equipo/' + b.getAttribute('data-baja') + '/baja'), 'Cuenta dada de baja').then(vistaEquipo); }); });
      $('#nueva').addEventListener('submit', function (ev) {
        ev.preventDefault(); var f = ev.target;
        guardando($('button[type=submit]', f), api('POST', '/api/admin/equipo', { nombre: f.nombre.value, correo: f.correo.value, rol: f.rol.value, ciudad: f.ciudad.value, password: f.password.value }), 'Cuenta creada').then(vistaEquipo);
      });
    }).catch(function (e) { aviso(e.message); });
  }

  /* ---------- historial ---------- */
  function vistaHistorial() {
    marco('<p class="muted">Cargando…</p>');
    api('GET', '/api/admin/historial').then(function (r) {
      marco('<div class="form-box" style="margin-bottom:28px"><h2 style="font-size:24px;margin-bottom:8px">Copia de seguridad</h2><p class="muted" style="margin-bottom:12px">Descarga una copia de la base de datos (cuentas, pedidos, contactos y precios). Guárdala en un lugar seguro: contiene datos personales.</p><a class="btn" href="/api/admin/respaldo">Descargar copia de la base</a></div>' +
        '<h2 style="font-size:26px;margin-bottom:12px">Últimos cambios</h2><div class="scroll"><table class="tabla"><thead><tr><th>Fecha (UTC)</th><th>Quién</th><th>Qué</th></tr></thead><tbody>' +
        (r.cambios.map(function (c) { return '<tr><td>' + esc(c.creado_en) + '</td><td>' + esc(c.autor || '—') + '</td><td>' + esc(c.entidad) + ': ' + esc(c.detalle) + '</td></tr>'; }).join('') || '<tr><td colspan="3" class="muted">Todavía no hay cambios.</td></tr>') + '</tbody></table></div>' +
        '<h2 style="font-size:26px;margin:32px 0 8px">Versiones anteriores del contenido</h2><p class="muted" style="margin-bottom:12px">Cada guardado conserva la versión previa. Restaurar vuelve a publicar esa versión (los precios no se ven afectados).</p><div class="scroll"><table class="tabla"><tbody>' +
        r.versiones.map(function (v) { return '<tr><td>' + esc(v) + '</td><td><button class="btn btn--sm" data-rest="' + esc(v) + '" type="button">Restaurar</button></td></tr>'; }).join('') + '</tbody></table></div>');
      $$('[data-rest]').forEach(function (b) { b.addEventListener('click', function () { if (!confirm('¿Restaurar esta versión? Reemplaza el contenido actual (el actual queda en el historial).')) return; guardando(b, api('POST', '/api/admin/restaurar', { version: b.getAttribute('data-rest') }), 'Versión restaurada y publicada').then(recargar).then(vistaHistorial); }); });
    }).catch(function (e) { aviso(e.message); });
  }

  /* ---------- promociones: combos y novedades ---------- */
  var TIPOS_NOV = [['concurso', 'Concurso'], ['sorteo', 'Sorteo'], ['evento', 'Evento'], ['curso', 'Curso'], ['proyecto', 'Proyecto nuevo'], ['noticia', 'Noticia']];
  var ESTADO_NOMBRE = { borrador: 'Borrador', revision: 'En revisión', publicada: 'Publicada' };
  var ESTADO_CLASE = { borrador: '', revision: ' warn', publicada: ' ok' };
  est.sub = 'combos'; est.promos = null; est.editPromo = null;
  function hoyIso() { var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  function nuevoItem(lista) {
    var ciu = est.rol === 'admin' ? [] : [est.ciudadUsuario];
    if (lista === 'combos') return { id: '', titulo: '', descripcion: '', imagen: '', catalogo: est.ciudadUsuario === 'santa-cruz' ? 'santa-cruz' : 'cochabamba', ciudades: ciu, inicio: hoyIso(), fin: '', estado: 'borrador', componentes: [{ tipo: 'catalogo', slug: '', cantidad: 1, nota: '' }], precios: {} };
    return { id: '', tipo: 'sorteo', titulo: '', resumen: '', texto: '', imagen: '', ciudades: ciu, inicio: hoyIso(), fin: '', estado: 'borrador', cta: { tipo: 'whatsapp', texto: '', url: '' }, bases: '', fecha_evento: '', lugar: '', cupo: 0 };
  }
  function vistaPromos() {
    if (est.editPromo) return formPromo();
    marco('<p class="muted">Cargando…</p>');
    api('GET', '/api/admin/promos').then(function (d) { est.promos = d; listaPromos(); }).catch(function (e) { aviso(e.message); });
  }
  function listaPromos() {
    var d = est.promos, esC = est.sub === 'combos', items = esC ? d.combos : d.novedades, admin = est.rol === 'admin';
    var pend = d.combos.concat(d.novedades).filter(function (x) { return x.estado === 'revision'; }).length;
    marco('<div class="btn-row" style="margin-bottom:16px;align-items:center"><div class="seg"><button type="button" data-sub="combos" aria-pressed="' + esC + '">Combos (' + d.combos.length + ')</button><button type="button" data-sub="novedades" aria-pressed="' + !esC + '">Novedades, concursos y eventos (' + d.novedades.length + ')</button></div><button class="btn btn--red btn--sm" id="nuevo-promo" type="button">' + (esC ? 'Nuevo combo' : 'Nueva novedad') + '</button></div>' +
      '<p class="muted" style="margin-bottom:12px">' + (admin ? (pend ? '<b>' + pend + ' esperan tu revisión.</b> ' : '') + 'Los ejecutivos envían a revisión y un administrador publica.' : 'Creas borradores de tu ciudad y los envías a revisión; un administrador los publica.') + '</p>' +
      (items.length ? '<div class="scroll"><table class="tabla"><thead><tr><th>Título</th><th>' + (esC ? 'Productos' : 'Tipo') + '</th><th>Ciudades</th><th>Vigencia</th><th>Estado</th><th></th></tr></thead><tbody>' + items.map(function (x) {
        var ciu = x.ciudades.length ? x.ciudades.map(function (c) { return CIUDADES[c]; }).join(', ') : 'Todas';
        return '<tr><td><b>' + esc(x.titulo) + '</b>' + (x.ejemplo ? ' <span class="chip warn">Ejemplo</span>' : '') + '</td><td>' + (esC ? x.componentes.length + ' componentes' : esc((TIPOS_NOV.filter(function (t) { return t[0] === x.tipo; })[0] || [0, x.tipo])[1])) + '</td><td>' + esc(ciu) + '</td><td>' + esc(x.inicio) + '<br><span class="muted">a ' + esc(x.fin) + '</span></td><td><span class="chip' + ESTADO_CLASE[x.estado] + '">' + ESTADO_NOMBRE[x.estado] + '</span></td><td><button class="btn btn--sm" type="button" data-edit-promo="' + esc(x.id) + '">' + (admin || x.estado !== 'publicada' ? 'Editar' : 'Ver') + '</button></td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="empty"><b>' + (esC ? 'Todavía no hay combos.' : 'Todavía no hay novedades.') + '</b><p class="muted" style="margin-top:6px">Crea la primera con el botón de arriba.</p></div>'));
    $$('[data-sub]').forEach(function (b) { b.addEventListener('click', function () { est.sub = b.getAttribute('data-sub'); listaPromos(); }); });
    $('#nuevo-promo').addEventListener('click', function () { est.editPromo = { nuevo: true, lista: est.sub, item: nuevoItem(est.sub) }; vistaPromos(); });
    $$('[data-edit-promo]').forEach(function (b) { b.addEventListener('click', function () { var it = items.filter(function (x) { return x.id === b.getAttribute('data-edit-promo'); })[0]; est.editPromo = { nuevo: false, lista: est.sub, item: JSON.parse(JSON.stringify(it)) }; vistaPromos(); window.scrollTo(0, 0); }); });
  }
  function bloqueCiudades(it, lista) {
    var admin = est.rol === 'admin';
    return '<div class="full"><b>' + (lista === 'combos' ? 'Ciudades donde se ofrece' : 'Ciudades') + '</b><div class="chips" style="margin-top:8px">' + Object.keys(CIUDADES).map(function (c) {
      return '<label class="chip" style="display:inline-flex;flex-direction:row;gap:8px;align-items:center"><input type="checkbox" data-ciu="' + c + '"' + (it.ciudades.indexOf(c) >= 0 ? ' checked' : '') + (admin ? '' : ' disabled') + ' style="width:auto"> ' + CIUDADES[c] + '</label>'; }).join('') + '</div>' +
      (lista === 'novedades' && admin ? '<p class="muted" style="font-size:15px;margin-top:6px">Sin ciudades marcadas, aplica a todas.</p>' : '') + (admin ? '' : '<p class="muted" style="font-size:15px;margin-top:6px">Como ejecutivo solo publicas para tu ciudad.</p>') + '</div>';
  }
  function filaComp(x, i, cat) {
    var prods = est.promos.productos.filter(function (p) { return p.ciudad === cat; });
    return '<div class="btn-row" style="gap:10px;margin-bottom:12px;align-items:flex-end" data-comp="' + i + '">' +
      '<label>Tipo<select data-c="tipo"><option value="catalogo"' + (x.tipo === 'catalogo' ? ' selected' : '') + '>Producto del catálogo</option><option value="otro"' + (x.tipo === 'otro' ? ' selected' : '') + '>Otro producto</option></select></label>' +
      (x.tipo === 'catalogo'
        ? '<label style="flex:1;min-width:230px">Producto<select data-c="slug"><option value="">Elige…</option>' + prods.map(function (p) { return '<option value="' + esc(p.slug) + '"' + (p.slug === x.slug ? ' selected' : '') + '>' + esc(p.nombre) + '</option>'; }).join('') + '</select></label>'
        : '<label style="flex:1;min-width:230px">Nombre<input data-c="nombre" value="' + esc(x.nombre || '') + '" maxlength="80" placeholder="Ej. olla de aluminio, juego de cubiertos"></label>') +
      '<label>Cantidad<input data-c="cantidad" type="number" step="any" min="0" value="' + esc(x.cantidad) + '" style="width:110px"></label>' +
      '<label style="flex:1;min-width:150px">Nota (opcional)<input data-c="nota" value="' + esc(x.nota || '') + '" maxlength="120"></label>' +
      '<button type="button" class="btn btn--sm btn--ghost" data-delc="' + i + '">Quitar</button></div>';
  }
  function formPromo() {
    var e = est.editPromo, it = e.item, esC = e.lista === 'combos', admin = est.rol === 'admin';
    var soloVer = !admin && !e.nuevo && it.estado === 'publicada';
    var estados = admin ? [['borrador', 'Borrador'], ['revision', 'En revisión'], ['publicada', 'Publicada en el sitio']] : [['borrador', 'Borrador'], ['revision', 'Enviar a revisión']];
    var img = it.imagen ? '<img src="/' + esc(it.imagen) + '" alt="" width="120" height="120" style="object-fit:cover;display:block;margin-bottom:8px"><button type="button" class="btn btn--sm btn--ghost" id="quitar-img">Quitar imagen</button>' : '<p class="muted" style="margin-bottom:8px">' + (esC ? 'Sin imagen: se usará la foto del primer producto del catálogo.' : 'Sin imagen.') + '</p>';
    var cuerpo = '<div class="form-grid">' + campo('Título', 'titulo', it.titulo, 'required maxlength="' + (esC ? 100 : 120) + '"') +
      (e.nuevo ? campo('Identificador (para la dirección web)', 'id', it.id, 'required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="ej. combo-parrillero-nov"') : '<label>Identificador<input value="' + esc(it.id) + '" disabled></label>') +
      (esC
        ? '<label class="full">Descripción<textarea name="descripcion" rows="3" maxlength="600">' + esc(it.descripcion) + '</textarea></label>' +
          '<label>Catálogo del que salen los productos<select name="catalogo" id="catalogo">' + Object.keys(CATALOGOS).map(function (c) { return '<option value="' + c + '"' + (it.catalogo === c ? ' selected' : '') + '>' + CATALOGOS[c] + '</option>'; }).join('') + '</select></label>'
        : '<label>Tipo<select name="tipo" id="tipo-nov">' + TIPOS_NOV.map(function (t) { return '<option value="' + t[0] + '"' + (it.tipo === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select></label>' +
          '<label class="full">Resumen (una frase)<input name="resumen" value="' + esc(it.resumen) + '" required maxlength="200"></label>' +
          '<label class="full">Texto<textarea name="texto" rows="5" maxlength="3000">' + esc(it.texto) + '</textarea></label>') +
      bloqueCiudades(it, e.lista) +
      '<label>Inicio<input type="date" name="inicio" value="' + esc(it.inicio) + '" required></label><label>Fin<input type="date" name="fin" value="' + esc(it.fin) + '" required></label>' +
      '<div class="full"><b>Imagen</b><div id="imgbox" style="margin-top:8px">' + img + '</div><label class="btn btn--sm" style="cursor:pointer;display:inline-block">Subir imagen<input id="subir" type="file" accept="image/jpeg,image/png,image/webp" hidden></label></div>' + '</div>';
    if (esC) {
      cuerpo += '<h3 style="margin:22px 0 8px">Qué incluye el combo</h3><p class="muted" style="margin-bottom:12px">Mezcla productos del catálogo con cualquier otro producto: ollas, herramientas, cubiertos…</p><div id="comps">' + it.componentes.map(function (x, i) { return filaComp(x, i, it.catalogo); }).join('') + '</div><button type="button" class="btn btn--sm" id="add-comp">Agregar componente</button>' +
        '<h3 style="margin:22px 0 8px">Precio del combo (Bs)</h3><div class="form-grid" style="max-width:560px"><label>Lista general<input name="precio_general" type="number" step="0.01" min="0" value="' + esc(it.precios && it.precios.general != null ? it.precios.general : '') + '"></label><label>Lista constructor (opcional)<input name="precio_constructor" type="number" step="0.01" min="0" value="' + esc(it.precios && Object.prototype.hasOwnProperty.call(it.precios, 'constructor') ? it.precios['constructor'] : '') + '"></label></div><p class="muted" style="font-size:15px;margin-top:6px">Solo lo ven los clientes con cuenta verificada. Vacío = "precio por cotizar".</p>';
    } else {
      cuerpo += '<h3 style="margin:22px 0 8px">Botón de acción</h3><div class="form-grid"><label>Qué hace<select name="cta_tipo" id="cta-tipo"><option value="whatsapp"' + (it.cta.tipo === 'whatsapp' ? ' selected' : '') + '>Abrir WhatsApp de la ciudad</option><option value="inscripcion"' + (it.cta.tipo === 'inscripcion' ? ' selected' : '') + '>Formulario de inscripción</option><option value="enlace"' + (it.cta.tipo === 'enlace' ? ' selected' : '') + '>Enlace externo</option><option value="ninguno"' + (it.cta.tipo === 'ninguno' ? ' selected' : '') + '>Sin botón</option></select></label>' +
        campo('Texto del botón', 'cta_texto', it.cta.texto, 'maxlength="40"') + (it.cta.tipo === 'enlace' ? '<label class="full">Dirección del enlace (https://…)<input name="cta_url" value="' + esc(it.cta.url) + '"></label>' : '<input type="hidden" name="cta_url" value="">') + '</div>' +
        '<h3 style="margin:22px 0 8px">Evento o curso</h3><div class="form-grid">' + campo('Fecha del evento', 'fecha_evento', it.fecha_evento, 'type="date"') + campo('Lugar', 'lugar', it.lugar, 'maxlength="120"') + campo('Cupo (personas)', 'cupo', it.cupo || '', 'type="number" min="0"') + '</div>' +
        '<h3 style="margin:22px 0 8px">Bases y condiciones</h3><label class="full">' + (['concurso', 'sorteo'].indexOf(it.tipo) >= 0 ? 'Obligatorias en concursos y sorteos antes de enviar a revisión. Revísalas con el área legal.' : 'Solo para concursos y sorteos (opcional en los demás).') + '<textarea name="bases" rows="4" maxlength="3000">' + esc(it.bases) + '</textarea></label>';
    }
    cuerpo += '<div class="form-grid" style="margin-top:22px"><label>Estado<select name="estado">' + estados.map(function (s) { return '<option value="' + s[0] + '"' + (it.estado === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select></label>' +
      (admin ? '<label class="full" style="display:flex;flex-direction:row;align-items:center;gap:10px"><input type="checkbox" name="ejemplo"' + (it.ejemplo ? ' checked' : '') + ' style="width:auto"> Contenido de ejemplo (no se publica cuando el sitio sea público)</label>' : '') + '</div>';
    marco('<h2 style="font-size:28px;margin-bottom:16px">' + (e.nuevo ? (esC ? 'Nuevo combo' : 'Nueva novedad') : 'Editar: ' + esc(it.titulo)) + '</h2>' + (soloVer ? '<p class="price-note">Esta publicación ya está en línea: solo un administrador la modifica.</p>' : '') +
      '<form id="f" class="form-box"><fieldset style="border:0;padding:0;margin:0"' + (soloVer ? ' disabled' : '') + '>' + cuerpo + '</fieldset><div class="btn-row" style="margin-top:28px">' + (soloVer ? '' : '<button class="btn btn--red" type="submit">' + (e.nuevo ? 'Crear' : 'Guardar cambios') + '</button>') + '<button class="btn" type="button" id="cancelar-promo">' + (soloVer ? 'Volver' : 'Cancelar') + '</button>' + (e.nuevo || soloVer ? '' : '<button class="btn btn--ghost" type="button" id="duplicar-promo">Duplicar como nuevo</button><button class="btn btn--ghost" type="button" id="borrar-promo">Eliminar</button>') + '</div></form>');

    function leer() {
      var f = $('#f'), g = function (n) { return f.elements[n] ? f.elements[n].value : ''; };
      ['titulo', 'descripcion', 'resumen', 'texto', 'inicio', 'fin', 'bases', 'fecha_evento', 'lugar', 'tipo', 'estado', 'catalogo'].forEach(function (k) { if (f.elements[k] && !f.elements[k].disabled) it[k] = g(k); });
      if (e.nuevo) it.id = g('id').trim();
      it.ciudades = admin ? $$('[data-ciu]', f).filter(function (c) { return c.checked; }).map(function (c) { return c.getAttribute('data-ciu'); }) : [est.ciudadUsuario];
      if (esC) {
        it.componentes = $$('[data-comp]', f).map(function (row) {
          var v = function (k) { var el = $('[data-c="' + k + '"]', row); return el ? el.value : ''; };
          return v('tipo') === 'catalogo' ? { tipo: 'catalogo', slug: v('slug'), cantidad: Number(v('cantidad')), nota: v('nota') } : { tipo: 'otro', nombre: v('nombre'), cantidad: Number(v('cantidad')), nota: v('nota') };
        });
        it.precios = { general: g('precio_general') === '' ? null : Number(g('precio_general')), constructor: g('precio_constructor') === '' ? null : Number(g('precio_constructor')) };
      } else {
        it.cta = { tipo: g('cta_tipo'), texto: g('cta_texto'), url: g('cta_url') }; it.cupo = g('cupo') === '' ? 0 : Number(g('cupo'));
      }
      if (admin && f.elements.ejemplo) it.ejemplo = f.elements.ejemplo.checked;
      return it;
    }
    function redibujar() { leer(); formPromo(); }
    if (esC) {
      $('#add-comp').addEventListener('click', function () { leer(); it.componentes.push({ tipo: 'catalogo', slug: '', cantidad: 1, nota: '' }); formPromo(); });
      $$('[data-delc]').forEach(function (b) { b.addEventListener('click', function () { leer(); it.componentes.splice(+b.getAttribute('data-delc'), 1); formPromo(); }); });
      $$('[data-c="tipo"]').forEach(function (s) { s.addEventListener('change', redibujar); });
      $('#catalogo').addEventListener('change', function () { leer(); it.componentes = it.componentes.map(function (x) { return x.tipo === 'catalogo' ? { tipo: 'catalogo', slug: '', cantidad: x.cantidad, nota: x.nota } : x; }); formPromo(); });
    } else {
      $('#tipo-nov').addEventListener('change', redibujar); $('#cta-tipo').addEventListener('change', redibujar);
    }
    var quitar = $('#quitar-img'); if (quitar) quitar.addEventListener('click', function () { leer(); it.imagen = ''; formPromo(); });
    $('#subir').addEventListener('change', function (ev) {
      var a = ev.target.files[0]; if (!a) return;
      if (a.size > 3000000) return aviso('La imagen debe pesar menos de 3 MB');
      var lector = new FileReader();
      lector.onload = function () { api('POST', '/api/admin/imagenes', { datos: String(lector.result).split(',')[1] }).then(function (r) { leer(); it.imagen = r.ruta; formPromo(); aviso('Imagen subida'); }).catch(function (x) { aviso(x.message); }); };
      lector.readAsDataURL(a);
    });
    $('#cancelar-promo').addEventListener('click', function () { est.editPromo = null; vistaPromos(); });
    var dup = $('#duplicar-promo'); if (dup) dup.addEventListener('click', function () { var c = JSON.parse(JSON.stringify(leer())); c.id = ''; c.titulo = c.titulo + ' (copia)'; c.estado = 'borrador'; c.inicio = ''; c.fin = ''; c.ejemplo = false; est.editPromo = { nuevo: true, lista: e.lista, item: c }; formPromo(); window.scrollTo(0, 0); aviso('Copia lista: ajusta las fechas y guarda'); });
    var borrar = $('#borrar-promo'); if (borrar) borrar.addEventListener('click', function () {
      if (!confirm('¿Eliminar "' + it.titulo + '"? Esta acción no se puede deshacer.')) return;
      guardando(borrar, api('DELETE', '/api/admin/' + e.lista + '/' + it.id), 'Eliminado').then(function () { est.editPromo = null; vistaPromos(); });
    });
    $('#f').addEventListener('submit', function (ev) {
      ev.preventDefault(); var dato = leer(), ruta = '/api/admin/' + e.lista;
      var envio = e.nuevo ? api('POST', ruta, dato) : api('PUT', ruta + '/' + dato.id, dato);
      guardando($('#f button[type=submit]'), envio, dato.estado === 'publicada' ? 'Publicado en el sitio' : dato.estado === 'revision' ? 'Enviado a revisión' : 'Borrador guardado').then(function () { est.editPromo = null; vistaPromos(); });
    });
  }

  /* ---------- arranque ---------- */
  api('GET', '/api/yo').then(function (r) {
    var u = r.usuario;
    if (!u) { raiz.innerHTML = '<p class="lead">Ingresa con tu cuenta de administrador para editar el sitio.</p><p style="margin-top:16px"><a class="btn btn--red" href="' + BASE + 'ingresar.html?volver=admin.html">Ingresar</a></p>'; return; }
    if (u.rol === 'cliente') { raiz.innerHTML = '<p class="lead">Esta sección es solo para el equipo de INCERPAZ.</p><p style="margin-top:16px"><a class="btn" href="' + BASE + 'mi-cuenta.html">Ir a mi cuenta</a></p>'; return; }
    est.rol = u.rol; est.ciudadUsuario = u.ciudad;
    /* un ejecutivo solo trabaja con las promociones de su ciudad; el administrador ve todo el panel */
    if (u.rol !== 'admin') { est.tab = 'promos'; return pintar(); }
    if (location.hash === '#promociones') est.tab = 'promos';
    return recargar().then(pintar);
  }).catch(function () { raiz.innerHTML = '<p class="lead">No pudimos conectar con el servidor.</p>'; });
})();
