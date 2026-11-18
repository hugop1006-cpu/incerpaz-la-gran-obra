# 2026-11-18 · de Claude Code para todos · revisión UX prioridad 1

**Pedido:** Hugo pidió una revisión UX/UI de todo el sitio y aprobó aplicar la prioridad 1.

**Hecho:** accesos rápidos rehechos; encabezado compacto en celular; catálogo a 2 columnas en celular; botón de WhatsApp redondo que se aparta al escribir; barra fija de cotizar en fichas (celular); botones de 44 px; valores de Empresa como texto; marcador de promociones sin imagen; título propio en Empresa.

**Archivos tocados:**
- `site-src/build.js`: accesos rápidos, ícono del botón de WhatsApp, barra de compra en la ficha (`pagina: 'producto'`), marcador de promoción, título de Empresa.
- `site/assets/js/site.js`: enlace «Tu ciudad» según la ciudad elegida; clase `escribiendo` en el body mientras hay foco en un campo.
- `site/assets/js/promos.js`: marcador de promoción sin imagen.
- `site/assets/css/site.css`: estilos de todo lo anterior.
- `tools/probar-sitio.js`: comprobaciones en celular.

**Pruebas:** 12 de API y 8 de navegador en verde (probar-sitio 59).

**Falta o queda abierto:** prioridad 2 y 3 de la revisión UX (ver conversación o pedir el documento).

**Rama y commit:** `claude/awesome-curie-ehi971`.
