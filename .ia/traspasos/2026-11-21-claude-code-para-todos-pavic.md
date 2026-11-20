# 2026-11-21 · de Claude Code para todos · PAVIC: camiones, proceso y muestras

**Pedido:** Hugo aprobó la tanda 4 de los wireframes.

**Hecho:** calculadora de obra con camiones (capacidad editable, 20 t de ejemplo); sección «Cómo trabajamos un proyecto»; formulario de pedido de muestras.

**Archivos tocados:**
- `site-src/build.js`: campo de capacidad del camión en recursos PAVIC; secciones `#proceso` y `#muestras` en `pavic.html`.
- `site/assets/js/pavic.js`: cálculo de camiones, fila en el resultado y en el CSV.
- `site/assets/css/site.css`: estilos de los pasos del proceso.
- `tools/probar-pavic.js`, `tools/probar-leads.js`: pruebas.

**Pruebas:** 12 de API y 8 de navegador en verde.

**Falta o queda abierto:** confirmar capacidad real del camión; validar el proceso con ventas; definir quién atiende las muestras. Tandas 5 y 6.

**Rama y commit:** `claude/awesome-curie-ehi971`.
