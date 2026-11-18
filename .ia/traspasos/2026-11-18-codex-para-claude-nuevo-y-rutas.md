# 2026-11-18 · de Codex para Claude · Nuevo y rutas cortas

REPORTE · INCERPAZ · dos cambios del sitio

**Rama, PR y SHA:** `codex/refresh-3-cambios`, derivada de `claude/awesome-curie-ehi971`. PR contra esa misma rama; enlace y SHA de HEAD figurarán en la descripción del PR.

**Checks:**
- ✓ `node site-src/build.js` — 85 páginas generadas.
- ✓ `node --test server/test/api.test.js` — 12 pruebas.
- ✓ `node tools/probar-sitio.js` — páginas, flujo y comparador existente.
- ✓ `node tools/probar-comercio.js` — precios verificados y comparador.
- ✓ `node tools/probar-admin.js`.
- ✓ `node tools/probar-proyectos.js`.
- ✓ `node tools/probar-pavic.js`.
- ✓ `node tools/probar-leads.js`.
- ✓ `node tools/probar-publico.js` — 80 páginas públicas, seguridad, SEO y precios.
- ✓ `node tools/probar-promos.js`.
- ✓ `node tools/probar-nuevo.js` — fechas futuras, vencidas, portada y catálogo.
- ✓ `node tools/probar-direcciones.js` — las cuatro rutas y catálogo cercano.

**Cambios:**
- `nuevo_hasta` opcional y validado como fecha `AAAA-MM-DD`; muestra «Nuevo» en catálogo y portada mientras esté vigente. Las tarjetas vencidas no entran en la sección de portada. Ningún producto real quedó marcado.
- Rutas cortas `/cochabamba`, `/santa-cruz`, `/oruro` y `/sucre`, con ciudad preseleccionada; Oruro y Sucre usan el catálogo de Cochabamba.
- El comparador ya estaba implementado en la rama base por Claude (commit `975a6de`); se mantuvo esa versión y se verificó con las pruebas existentes, sin duplicarla.

**Desviaciones del ENCARGO:** el ENCARGO original pedía tres commits, uno por cambio. Como la rama base incorporó el comparador y Hugo indicó reutilizarlo, este PR contiene dos commits: «Nuevo» y rutas cortas.

**Pendientes o dudas:** indicar qué productos son nuevos y hasta qué fecha en `site-src/CONTENIDO-PENDIENTE.md`. Claude revisa el PR; Hugo decide el merge. No se hizo merge ni deploy.

**Rama y commit:** `codex/refresh-3-cambios` · dos commits; SHA de HEAD incluido en la descripción del PR.
