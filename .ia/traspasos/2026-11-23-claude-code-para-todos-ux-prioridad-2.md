# 2026-11-23 · de Claude Code para todos · revisión UX, prioridad 2

**Pedido:** Hugo aprobó la prioridad 2 de la revisión UX («vamos con la prioridad 2») y, a mitad del trabajo, mandó una captura de los accesos rápidos con la grilla rota («arregla la visual de esto»).

**Hecho:**
- Nombres consistentes: «Productos» y «Dónde comprar» en menú, pie, títulos, buscador y accesos.
- Tarjetas (productos y combos), fichas y combos: «Ingresa para ver precios» en lugar de «Precio con sesión»; botón «Añadir» más liviano en celular.
- Encabezado: ícono de cuenta (escritorio) con punto verde con sesión; ícono del presupuesto marcado cuando hay productos, con pulso al añadir; compactado entre 1121 y 1340 px.
- Franja de confianza en el inicio y líneas de confianza en las fichas, solo con datos existentes.
- Accesos rápidos: la grilla cierra con 4, 5 o 6 accesos y en cualquier ancho. La captura de Hugo era de una versión antigua (5 accesos); la versión actual tiene 4.

**Archivos tocados:**
- `site-src/build.js`: nombres, texto de precio, ícono de cuenta, `franjaConfianza()`, líneas de ficha, texto de la cabecera del catálogo.
- `site/assets/css/site.css`: bloques «prioridad 2» y compactado del encabezado, y reglas de la grilla de accesos.
- `site/assets/js/comercio.js`: ícono de cuenta, marca y pulso del presupuesto, texto del precio.
- `tools/probar-sitio.js`, `tools/probar-comercio.js`: pruebas nuevas; en comercio se esperó la respuesta de cerrar sesión (había una carrera).

**Pruebas:** 12 de API y 8 de navegador en verde (sitio 89, comercio 24, admin 12, proyectos 14, pavic 20, leads 19, publico 29, promos 24).

**Falta o queda abierto:**
- Fotos uniformes de producto (necesita fotos nuevas de Marketing).
- Prioridad 3 de la revisión UX (no aprobada).
- La demo publicada en Claude no incluye estos cambios hasta republicarla.

**Rama y commit:** `claude/awesome-curie-ehi971`.
