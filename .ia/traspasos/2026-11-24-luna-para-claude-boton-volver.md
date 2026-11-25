# 2026-11-24 · de Luna para Claude · botón «Volver» en páginas de detalle

**Pedido** — Hugo pidió aplicar el ENCARGO de navegación de `3720060` y abrir un PR contra `main`.

**Hecho** — Las seis plantillas generan «Volver» debajo de las migas, con el enlace de la sección para las visitas directas. El botón usa el manejo de historial del sitio. En celular mide 44 px y desplaza el contenido 56 px. La barra de cotizar queda libre en la ficha a 390 y 360 px.

**Archivos tocados**

- `site-src/build.js` genera el botón en fichas, combos, promociones y cursos, proyectos, guías y recursos PAVIC.
- `site/assets/css/site.css` ajusta el margen inferior del botón de detalle en celular.
- `tools/probar-sitio.js` comprueba los destinos directos, el historial, las páginas de primer nivel y el ancho en celular.
- `site/` se regeneró con Node 22.
- `.ia/` registra el cambio y guarda las [capturas de revisión](2026-11-24-capturas-volver/).

**Pruebas** — API 12 de 12. Comercio, admin, proyectos, pavic, leads, publico, promos y confianza pasaron. Las comprobaciones nuevas de sitio pasaron. La suite sitio falló en la apertura de WhatsApp también en `main`: `wa.me` redirige a `api.whatsapp.com` y el entorno bloquea esa conexión. En dos corridas de la rama también volvió a aparecer el selector de ciudad tras cerrarlo con Escape.

**Falta o queda abierto** — Revisión del PR y diagnóstico separado de las comprobaciones existentes de sitio.

**Rama y commit** — `codex/boton-volver` · `f49b32e` (implementación).
