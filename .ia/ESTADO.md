# Estado del trabajo

Lo actualiza el asistente o la persona que termina una tarea. Lo más reciente arriba.

## 2026-11-18 · Codex
**Hecho**
- «Nuevo»: campo opcional `nuevo_hasta`, validado como `AAAA-MM-DD`; etiqueta en catálogo y portada hasta el vencimiento. La portada excluye tarjetas vencidas. No se marcó ningún producto real; queda pendiente indicarlo en `site-src/CONTENIDO-PENDIENTE.md`.
- Rutas cortas `/cochabamba`, `/santa-cruz`, `/oruro` y `/sucre`, con ciudad preseleccionada. Oruro y Sucre usan el catálogo de Cochabamba y conservan su ciudad para atención y disponibilidad.
- Comparador: se conserva sin duplicarlo desde la base `claude/awesome-curie-ehi971` (commit `975a6de`), con pruebas de sitio, comercio y publicación en verde.
- Generador y sitio generados en 85 páginas. Pasan las 12 pruebas de API y las pruebas de navegador existentes y nuevas.

**En curso**
- PR de dos commits desde `codex/refresh-3-cambios` hacia `claude/awesome-curie-ehi971`; no incluye merge ni deploy.

**Sigue**
- Revisión de Claude y decisión de Hugo sobre el merge.

## 2026-11-18 · Claude Code
**Hecho**
- Comparador de productos (pedido de la reunión, con permiso de Hugo): botón «Comparar» en tarjetas del catálogo y en fichas, barra fija con el conteo, página `comparar.html` con tabla lado a lado (hasta 4 productos del mismo catálogo), filas que cambian resaltadas, «Mostrar solo lo que cambia», enlace compartible `?p=`, WhatsApp con la lista y precio solo con cuenta verificada.
- Pruebas nuevas en `tools/probar-sitio.js` y `tools/probar-comercio.js`; `comparar.html` declarada no indexable en `tools/probar-publico.js`. 12 de API y 8 de navegador en verde.

**En curso**
- Nada.

**Sigue**
- Con permiso de Hugo: productos nuevos destacados y direcciones cortas por ciudad.

## 2026-11-17 (tarde) · Claude Code
**Hecho**
- Presentación «Refresh INCERPAZ y comercio internacional»: dos diapositivas nuevas después de «Etapa 2» con los 11 pedidos de la reunión de seguimiento («Lo que pidió la reunión» y «Qué necesitamos para cerrarlos»), una fila más en «Decisiones para hoy» y numeración actualizada (ahora 20 diapositivas).
- Pedidos de la reunión registrados en `.ia/TAREAS.md`.

**En curso**
- Nada. La web no se tocó: Hugo pidió permiso previo antes de actualizarla.

**Sigue**
- Con permiso de Hugo: comparador de productos, productos nuevos y direcciones cortas por ciudad.
- Confirmar con Hugo qué significa «En cotizador» en la lista de la reunión.

## 2026-11-17 · Claude Code
**Hecho**
- Sitio: ventana «¿Desde qué ciudad nos visitas?» en la primera visita, mensaje de WhatsApp según la página y formulario de contacto en la portada (ideas tomadas del prototipo de Fergie).
- Pruebas: `tools/visitante.js` para las pruebas existentes y pruebas nuevas de la ventana, el WhatsApp y el formulario. 12 de API y 8 de navegador en verde.
- Ortografía y concordancia de los textos de producto, corregidas al generar el sitio.
- Documento de contexto `PROYECTO-INCERPAZ.md` y esta carpeta `.ia/`.

**En curso**
- Nada.

**Sigue**
- Planificar el comparador de productos (Hugo anunció una lista de puntos a incluir; falta el resto).
- Esperar respuestas de Sistemas, programador en jefe, Legal y Marketing.

**Rama:** `claude/awesome-curie-ehi971` (sin pull request).
