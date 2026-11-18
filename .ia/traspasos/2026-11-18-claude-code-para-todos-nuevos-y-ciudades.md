# 2026-11-18 · de Claude Code para todos · productos nuevos y direcciones cortas

**Pedido:** Hugo, en la reunión de seguimiento; permiso el 2026-11-18.

**Hecho:**
- Productos nuevos con fecha «nuevo hasta» (panel → producto). Etiqueta, filtro «Nuevos», sección en portada y en páginas de ciudad; se apaga sola al vencer.
- Páginas por ciudad `site/<ciudad>.html`, servidas como `/cochabamba`, `/santa-cruz`, `/oruro`, `/sucre`. Marcan la ciudad (`data-ciudad-fija`) sin mostrar la ventana de ciudad.
- Arreglo general: `[hidden] { display: none !important; }` en el CSS; el filtro del catálogo no ocultaba tarjetas en pantalla.

**Archivos tocados:**
- `server/lib/contenido.js`: valida `nuevo_hasta`.
- `site/assets/js/admin.js`: campo de fecha y aviso en la lista.
- `site-src/build.js`: etiqueta, filtro, sección de nuevos, páginas de ciudad, enlaces en pie y portada, sitemap.
- `site/assets/js/site.js`: vencimiento de la etiqueta, sección según ciudad, ciudad fija.
- `site/assets/css/site.css`: etiqueta «Nuevo» y regla `[hidden]`.
- `tools/probar-sitio.js`, `tools/probar-admin.js`, `tools/probar-publico.js`: pruebas.

**Pruebas:** 12 de API y 8 de navegador en verde.

**Falta o queda abierto:** marcar productos nuevos reales (Marketing). La Paz no tiene página propia (sin datos del punto PAVIC).

**Rama y commit:** `claude/awesome-curie-ehi971`.
