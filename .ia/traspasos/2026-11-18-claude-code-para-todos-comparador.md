# 2026-11-18 · de Claude Code para todos · comparador de productos

**Pedido:** Hugo, en la reunión de seguimiento; permiso para implementarlo el 2026-11-18.

**Hecho:** comparador de hasta 4 productos del mismo catálogo. Botón «Comparar» en tarjetas y fichas, barra fija con el conteo, página `comparar.html` con tabla lado a lado, filas que cambian resaltadas, opción «Mostrar solo lo que cambia», enlace compartible `comparar.html?p=ciudad:slug,…`, WhatsApp con la lista de productos y precio solo con cuenta verificada.

**Archivos tocados:**
- `site-src/build.js`: botón en tarjeta y ficha, barra fija en la plantilla, página `comparar.html` con datos embebidos, `noindex` para comparar.
- `site/assets/js/site.js`: selección guardada en el navegador (`incerpaz_comparar`), barra y tabla.
- `site/assets/js/comercio.js`: repinta precios cuando el comparador rearma la tabla (evento `incerpaz:precios`).
- `site/assets/css/site.css`: estilos del botón, la barra y la tabla (scroll horizontal propio en celular).
- `tools/probar-sitio.js`, `tools/probar-comercio.js`, `tools/probar-publico.js`: pruebas.

**Pruebas:** 12 de API y 8 de navegador en verde (sitio 48, comercio 19, publico 27 comprobaciones).

**Falta o queda abierto:** productos nuevos y direcciones cortas por ciudad esperan permiso de Hugo.

**Rama y commit:** `claude/awesome-curie-ehi971`.
