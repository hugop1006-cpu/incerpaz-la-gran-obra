# 2026-11-20 · de Claude Code para todos · proyectos en el inicio, filtro y ficha

**Pedido:** Hugo aprobó la tanda 2 de los wireframes.

**Hecho:** sección de proyectos en el inicio; filtro por dificultad en `proyectos.html`; «Proyectos donde se usa» en las fichas.

**Archivos tocados:**
- `site-src/build.js`: `proyectosData` se lee antes (lo usan el inicio y las fichas); ayudantes `usaProducto` y `proyCard`; sección del inicio; filtro; sección en la ficha.
- `site/assets/js/site.js`: filtro por dificultad.
- `site/assets/css/site.css`: estilo del filtro.
- `tools/probar-sitio.js`: pruebas.

**Pruebas:** 12 de API y 8 de navegador en verde (probar-sitio 70).

**Falta o queda abierto:** tandas 3 a 6 (ver `.ia/TAREAS.md`).

**Rama y commit:** `claude/awesome-curie-ehi971`.
