# Estado del trabajo

Lo actualiza el asistente o la persona que termina una tarea. Lo más reciente arriba.

## 2026-11-20 (noche) · Claude Code
**Hecho** (wireframes, tanda 3)
- Inicio: banda oscura «¿Construyes o vendes materiales?» (precios de tu ciudad, presupuestos y pedidos, recompra) con «Crear cuenta» e «Ingresar». Solo existe con comercio activo y se oculta si ya hay sesión.
- Formularios cortos de la portada y de las páginas de ciudad: campo «Soy» (dueño de casa, constructor o maestro, ferretería o distribuidor, proyectista o arquitecto, empresa o entidad, otro). Llega a Contactos como dato extra.
- Pruebas nuevas en probar-sitio (72), probar-comercio (21) y probar-leads. 12 de API y 8 de navegador en verde.

**Pendiente de decisión**
- El programa de puntos que mencionaba el wireframe no se incluyó: falta decidir si existe.

**Sigue**
- Tanda 4: PAVIC con peso y camiones, «Cómo trabajamos un proyecto» y pedido de muestras.

## 2026-11-20 (tarde) · Claude Code
**Hecho** (wireframes, tanda 2)
- Inicio: sección «Proyectos para tu casa» con los 3 proyectos.
- Proyectos: filtro por dificultad (Todos, Básico, Medio) con contador. El bloque «¿Tienes otra idea?» ya existía.
- Fichas: «Proyectos donde se usa», calculado con los materiales de cada proyecto (incluido el enchape a elegir).
- Pruebas nuevas en probar-sitio (70). 12 de API y 8 de navegador en verde.

**Sigue**
- Tanda 3: banda para constructores y campo «Soy» en el formulario corto.

## 2026-11-20 · Claude Code
**Hecho** (wireframes vs. sitio, tanda 1 de 6, con permiso de Hugo)
- Buscador general: lupa en el encabezado que abre una barra de búsqueda y página `buscar.html` con resultados agrupados (productos del catálogo de la ciudad elegida, proyectos, guías, promociones vigentes y páginas). Busca por nombre, código, línea y categoría; sin resultados ofrece WhatsApp.
- Presupuesto en el encabezado: ícono con contador rojo (oculto en 0). La barra superior queda con la cuenta (Ingresar / Crear cuenta o Mi cuenta / Salir).
- Celular: logo, lupa, presupuesto y Menú en una fila; la ciudad se elige dentro del menú abierto.
- Pruebas nuevas en probar-sitio; `buscar.html` no indexable. 12 de API y 8 de navegador en verde.

**Sigue** (tandas pendientes de los wireframes)
2. Proyectos en el inicio, filtro por dificultad y «Proyectos donde se usa» en la ficha.
3. Banda para constructores y campo «Soy» en el formulario corto.
4. PAVIC: peso y camiones, «Cómo trabajamos un proyecto», pedido de muestras.
5. Calculadora de tejas por pendiente.
6. Ordenar el catálogo, «Nuestras marcas» en Empresa y enlace al juego.

## 2026-11-18 (noche) · Claude Code
**Hecho** (revisión UX/UI, prioridad 1, con permiso de Hugo)
- Accesos rápidos: 4 tareas (calcular, catálogo, comparar, tu ciudad) con flecha y líneas que no se cortan; en páginas de ciudad también 4.
- Celular: encabezado en una fila (ciudad junto al menú, barra superior de una línea), botones del inicio a todo el ancho, catálogo a 2 columnas con categorías deslizables (de 20.300 a 8.300 px de alto), botón de WhatsApp redondo que se aparta al escribir, barra fija «Cotizar / Añadir» en las fichas.
- Botones de al menos 44 px; valores de Empresa como texto (no parecen botones); promociones sin imagen con bloque de marca en lugar del ícono desvaído; Empresa con título propio («Quiénes somos»).
- Pruebas nuevas en `tools/probar-sitio.js`. 12 de API y 8 de navegador en verde.

**Sigue**
- Revisión UX prioridad 2 (presupuesto y cuenta visibles, tarjetas más limpias, nombres consistentes, buscador general) si Hugo la aprueba.
- Revisar los wireframes contra el sitio actual (pedido de Hugo).

## 2026-11-18 (tarde) · Claude Code
**Hecho**
- Productos nuevos: campo «Destacar como nuevo hasta» en el panel (producto); etiqueta «Nuevo» en tarjetas y fichas, filtro «Nuevos» en el catálogo y sección «Productos nuevos» en la portada y en las páginas de ciudad. Vence sola en la fecha. Hoy ningún producto está marcado, así que no se ve en el sitio hasta que alguien marque uno.
- Direcciones cortas por ciudad: páginas `cochabamba.html`, `santa-cruz.html`, `oruro.html` y `sucre.html` (el servidor las sirve como /cochabamba, etc.). Dejan la ciudad elegida y muestran catálogo, nuevos, promociones, agencias y contacto. Enlazadas desde el pie y desde la portada; incluidas en el sitemap.
- Corregido un error previo: el filtro del catálogo no ocultaba en pantalla las tarjetas filtradas (regla global `[hidden]` en el CSS).
- Pruebas nuevas en probar-sitio, probar-admin y probar-publico. 12 de API y 8 de navegador en verde.

**Sigue**
- Pedidos de la reunión que dependen de otras áreas (ver `.ia/TAREAS.md`).

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
