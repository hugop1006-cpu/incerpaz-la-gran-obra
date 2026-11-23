# Estado del trabajo

Lo actualiza el asistente o la persona que termina una tarea. Lo más reciente arriba.

## 2026-11-23 · Codex
**Regla de trabajo vigente**
- Luna (Codex en la nube) implementa las tareas nuevas del sitio con ENCARGO y REPORTE del protocolo común.
- Claude, en chat o en Claude Code, diseña, redacta el ENCARGO y revisa el PR. Solo implementa si Hugo lo indica para esa tarea.
- Hugo sigue autorizando cada tarea, cada merge y cada deploy.

## 2026-11-23 (noche) · Claude Code
**Hecho**
- Comparador: botón «← Volver al catálogo» arriba de la página. Si se llegó desde el catálogo regresa a él tal cual (con ciudad y filtro); si se abrió directo, lleva al catálogo de los productos elegidos. También se cambió «Precio con sesión» por «Ingresa para ver precios» en la fila de precio de la tabla.
- Pruebas: probar-sitio 92 (3 nuevas). Falta aplicar el mismo botón a otras páginas de herramienta si Hugo lo pide (techos, buscar).
- La demo privada en Claude no incluye este cambio hasta republicarla.

## 2026-11-23 (tarde) · Claude Code
**Hecho** (revisión UX, prioridad 2, aprobada por Hugo)
- Nombres consistentes: el menú, los títulos y el buscador dicen «Productos» y «Dónde comprar» (antes «Catálogo» y «Dónde estamos»). Las direcciones (`catalogo.html`, `donde-estamos.html`) no cambian.
- Tarjetas del catálogo: una sola línea de precio («Ingresa para ver precios», enlace discreto) y botón «Añadir» más liviano en celular. Misma línea en fichas y combos. El texto de la cabecera del catálogo explica cómo se ven los precios.
- Cuenta y presupuesto visibles: ícono de cuenta en el encabezado de escritorio (lleva a ingresar o a Mi cuenta/Panel; punto verde con sesión). El ícono del presupuesto se oscurece cuando hay productos y el contador da un pulso al añadir. En celular la cuenta sigue en la barra superior. Entre 1121 y 1340 px el encabezado se compacta para que todo quepa.
- Señales de confianza: franja en el inicio (4 ciudades, agencias y fábricas calculadas de los datos, fabricado en Bolivia, precios con cuenta verificada) y dos líneas en cada ficha. No hay cifras inventadas.
- Accesos rápidos: la grilla ya no deja celdas vacías con 5 o 6 accesos (Hugo mostró una versión antigua con 5 accesos y la última fila rota).
- Prueba: se arregló una carrera en `probar-comercio.js` (esperar la respuesta de cerrar sesión). Pruebas nuevas: sitio 89, comercio 24. 12 de API y 8 de navegador en verde.

**No se hizo**
- Fotos uniformes de producto: las tarjetas ya muestran todas las fotos contenidas sobre blanco; unificar el estilo de las fotos originales requiere fotos nuevas (marketing).
- Prioridad 3 de la revisión UX (no aprobada).

## 2026-11-23 · Codex
**Hecho**
- Se agregó a los pendientes de Catálogo la identificación de los productos nuevos y su fecha de vigencia.

## 2026-11-23 · Claude Code
**Hecho** (wireframes, tanda 6: la última)
- Catálogo: selector «Ordenar» (orden del catálogo, nombre de la A a la Z, categoría); los combos van siempre primero.
- Empresa: sección «Nuestras marcas» con INCERPAZ, PAVIC, tejas (marca en preparación, hoy la categoría Techos) y «La Gran Obra». Se quitó el bloque «Marcas» chico que había dentro de Calidad.
- Juego «La Gran Obra»: `site-src/build.js` copia el juego de la raíz del repositorio a `site/juego/` (con `noindex`) para que el sitio y el servidor lo sirvan. Enlazado desde Empresa («Jugar»), el pie de página y el buscador.
- Pruebas nuevas (probar-sitio 86, probar-publico 29). 12 de API y 8 de navegador en verde.
- Con esto quedan hechas las 6 tandas de los wireframes que no dependían de otras áreas.

**Nota técnica**
- El servidor no sirve carpetas sin nombre de archivo: el juego se abre en `juego/index.html` (no en `/juego/`).
- Si se edita el juego en la raíz, hay que regenerar el sitio para que `site/juego/` se actualice.

**Sigue**
- Revisión UX prioridades 2 y 3 (propuesta no aprobada).
- Pedidos de la reunión que dependen de otras áreas (ver `.ia/TAREAS.md`).

## 2026-11-21 (tarde) · Claude Code
**Hecho** (wireframes, tanda 5: tejas)
- Página nueva `techos.html` («Techos y tejas»): calculadora de tejas por pendiente (superficie real = área en planta × √(1 + pendiente²); tejas = superficie real × tejas por m² × (1 + merma); peso aproximado), WhatsApp con el techo calculado, «Añadir al presupuesto» con cuenta, y las tejas del catálogo.
- Usa solo datos de fichas: teja colonial tapa de Santa Cruz (18 por m², 2,6 kg). La teja canal no entra porque su ficha repite la de la tapa. En Cochabamba avisa que las tejas están en el catálogo de Santa Cruz.
- Enlaces: fichas de tejas («Calcula tus tejas»), catálogo, buscador y sitemap.
- Pruebas nuevas en probar-sitio (80). 12 de API y 8 de navegador en verde.

**Pendiente de datos**
- Pendiente mínima de cada modelo (el texto dice que está por confirmar en la ficha técnica).
- Ficha propia de la teja canal; tejas por m² de otros modelos; catálogo de tejas en Cochabamba.
- Marca propia de tejas (decisión aparte del sitio).

**Sigue**
- Tanda 6: ordenar el catálogo, «Nuestras marcas» en Empresa y enlace al juego.

## 2026-11-21 · Claude Code
**Hecho** (wireframes, tanda 4: PAVIC)
- Recursos PAVIC: la calculadora de obra suma «Capacidad de carga por camión (toneladas)» y la fila «Camiones». **El valor de 20 t es de ejemplo** (editable y marcado como ejemplo en la tabla); falta confirmar la capacidad real.
- Página PAVIC: sección «Cómo trabajamos un proyecto» (consulta, cotización, muestras, despacho, asesoría en obra) y sección «Muestras» con formulario de pedido (nombre, empresa, celular, ciudad, piezas, dónde recibirlas, consentimiento). Llega a Contactos con el asunto «Solicitud de muestras PAVIC».
- Pruebas nuevas en probar-pavic (20) y probar-leads (19). 12 de API y 8 de navegador en verde.

**Pendiente de decisión**
- Quién atiende las solicitudes de muestras y cómo se entregan (envío o retiro en agencia). El texto del proceso («Los plazos los acuerda tu ejecutivo») es genérico: validar con ventas, igual que decía el wireframe.

**Sigue**
- Tanda 5: calculadora de tejas por pendiente.

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
