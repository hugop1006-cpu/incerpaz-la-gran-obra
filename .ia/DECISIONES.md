# Decisiones

Una línea por decisión: fecha, decisión, quién decidió. Lo más reciente arriba.

| Fecha | Decisión | Decidió |
|---|---|---|
| 2026-11-23 | Decisión de Hugo: las tareas nuevas del sitio las implementa Luna (Codex en la nube) con ENCARGO y REPORTE del protocolo común. Claude, en chat o en Claude Code, diseña, escribe el ENCARGO y revisa el PR; no implementa tareas nuevas del sitio salvo que Hugo indique otra cosa para una tarea concreta. Motivo: usar Claude de forma más eficiente. Hugo sigue autorizando cada tarea, cada merge y cada deploy. | Hugo |
| 2026-11-23 | El sitio usa «Productos» (no «Catálogo») y «Dónde comprar» (no «Dónde estamos») para nombrar esas secciones; «Catálogo de Cochabamba/Santa Cruz» queda solo para la lista de cada ciudad | Hugo (aprobó la prioridad 2) |
| 2026-11-23 | Señales de confianza solo con datos que ya están en el sitio (ciudades, agencias, fábricas); sin cifras de la empresa hasta que Marketing las confirme | Claude Code |
| 2026-11-18 | Direcciones cortas solo para las 4 ciudades con datos (Cochabamba, Santa Cruz, Oruro, Sucre); son páginas propias indexables. Oruro y Sucre muestran el catálogo de Cochabamba | Claude Code |
| 2026-11-18 | Un producto se destaca como nuevo con una fecha de vencimiento («nuevo hasta»), no con una marca permanente | Claude Code |
| 2026-11-18 | El comparador acepta hasta 4 productos del mismo catálogo; `comparar.html` no se indexa ni entra al sitemap | Claude Code |
| 2026-11-16 | Del prototipo de Fergie (Base44) se toman: ventana de ciudad, WhatsApp según la página y formulario en la portada. No se toman: precios visibles para todos, sellos de constructoras inventadas, cifras de empresa sin confirmar, su catálogo ni la plataforma | Hugo |
| 2026-11-07 | No se hace todavía el corte del sitio actual (redirecciones de tiendas y dominio) | Hugo |
| 2026-11-05 | Validación del mercado exportador en pausa; se retoma con el CSV de USITC DataWeb (6907.23.10) | Hugo |
| 2026-10 | El sitio es preliminar e interno (sin indexar); no se publica hasta decidir alojamiento y operación | Hugo |
| 2026-10 | Precios solo para cuentas verificadas por un ejecutivo de su ciudad | Hugo |
| 2026-10 | Dos catálogos (Cochabamba y Santa Cruz); Oruro y Sucre usan el de la fábrica más cercana | Hugo |
| 2026-10 | Los combos pueden incluir productos que no son del catálogo | Hugo |
| 2026-10 | Cloudflare delante del servidor si se usa Render | Hugo |
| 2026-10 | Sin frameworks ni dependencias de npm; servidor con Node.js 22 y SQLite | Claude Code |
