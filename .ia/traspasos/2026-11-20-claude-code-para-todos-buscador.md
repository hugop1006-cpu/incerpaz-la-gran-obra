# 2026-11-20 · de Claude Code para todos · buscador general y presupuesto en el encabezado

**Pedido:** Hugo pidió revisar los wireframes contra el sitio y aprobó la tanda 1.

**Hecho:** lupa y barra de búsqueda en el encabezado; página `buscar.html` con índice embebido (productos, proyectos, guías, promociones, páginas); ícono de presupuesto con contador; en celular la ciudad pasa al menú abierto.

**Archivos tocados:**
- `site-src/build.js`: íconos y barra de búsqueda en la plantilla, barra superior solo con la cuenta, página e índice de búsqueda, `noindex` para buscar.
- `site/assets/js/site.js`: abrir y cerrar la barra, búsqueda con puntaje y grupos, clase `menu-abierto` en el encabezado.
- `site/assets/js/comercio.js`: contador del ícono (oculto en 0); la barra superior ya no repite el presupuesto.
- `site/assets/css/site.css`: estilos del encabezado, la barra y los resultados.
- `tools/probar-sitio.js`, `tools/probar-publico.js`: pruebas.

**Pruebas:** 12 de API y 8 de navegador en verde (probar-sitio 65).

**Falta o queda abierto:** tandas 2 a 6 de los wireframes (ver `.ia/TAREAS.md`).

**Rama y commit:** `claude/awesome-curie-ehi971`.
