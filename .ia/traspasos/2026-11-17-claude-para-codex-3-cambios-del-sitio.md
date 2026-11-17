# 2026-11-17 · de Claude (arquitecto) para Codex (Luna) · 3 cambios del sitio

ENCARGO · INCERPAZ · comparador de productos, etiqueta «Nuevo» y direcciones cortas por ciudad

**Objetivo:** implementar los tres cambios del sitio nuevo que pidió la reunión de seguimiento y que no dependen de otras áreas.

**Autorización:** Hugo (director) autorizó iniciar estos tres cambios el 17-11-2026. La autorización no incluye merge ni deploy, ni el corte del sitio actual.

**Riesgo:** medio (rutas del servidor y catálogo). Antes de entregar, Claude revisa el PR; después Hugo decide el merge. Máximo dos rondas de corrección.

## Los tres cambios

1. **Comparador de productos.**
   - En el catálogo se pueden marcar entre 2 y 4 productos **de la misma ciudad** y verlos lado a lado (título, código, línea, color, medidas, peso, rendimiento, categorías). No se mezclan ciudades.
   - Los precios no van en el HTML ni en el comparador estático: solo los entrega la API a cuentas verificadas, igual que hoy (regla 5 de `AGENTS.md`). Sin cuenta se ve «Ingresa para ver precios».
   - Se usa con teclado y en celular.
   - Prueba nueva `tools/probar-comparador.js`, con el mismo estilo que las demás `tools/probar-*.js`.
2. **Etiqueta «Nuevo».**
   - Campo opcional en `site-src/data/productos.json` (por ejemplo `nuevo_hasta`, con fecha AAAA-MM-DD). Mientras la fecha no pase, el catálogo y la portada muestran la etiqueta «Nuevo»; después desaparece sola.
   - **No inventes cuáles productos son nuevos.** Hugo no lo ha dicho: implementa el mecanismo, no marques ninguno y agrega a `site-src/CONTENIDO-PENDIENTE.md` la línea «Indicar qué productos son nuevos y hasta qué fecha». Las pruebas usan datos de prueba propios.
3. **Direcciones cortas por ciudad.**
   - `/cochabamba`, `/santa-cruz`, `/oruro` y `/sucre` abren la portada del sitio con esa ciudad ya seleccionada (el catálogo ya acepta `?ciudad=`). Oruro y Sucre usan el catálogo de la fábrica más cercana (ver `.ia/DECISIONES.md`).
   - Si hay duda sobre los nombres de las direcciones, usa los de arriba y anótalo en el REPORTE.
   - No toques `site-src/redirecciones-tiendas.csv` ni nada del corte del sitio actual.

## Terminado cuando
- Los tres cambios funcionan en el sitio generado y se ven bien en celular.
- Pasa todo lo que pide `AGENTS.md` en «Antes de entregar»: `node site-src/build.js`, `node --test server/test/api.test.js` y todas las `tools/probar-*.js` del sitio, más las pruebas nuevas.
- Los archivos generados (`site/`, `server/data/catalogo.json`) están subidos.
- `.ia/ESTADO.md`, `.ia/TAREAS.md` (responsable `codex`, estado según corresponda) y `.ia/DECISIONES.md` (si decidiste algo) actualizados, y un archivo de traspaso nuevo en `.ia/traspasos/` con `PLANTILLA.md`.

## Archivos
- **Permitidos:** `site-src/` (salvo `redirecciones-tiendas.csv`), `site/assets/`, `server/lib/app.js` (solo rutas nuevas), `tools/probar-*.js` nuevos, `.ia/`.
- **Prohibido tocar:** `.github/`, `site-src/redirecciones-tiendas.csv`, `server/lib/erp/`, `server/data/precios-publicados.json`, `Dockerfile`, `Caddyfile`, `render.yaml`, `docker-compose.yml`, el juego (`index.html`, `js/`, `levels.js`, `style.css`) y las carpetas de datos del INE y la Gaceta. Sin dependencias nuevas.

## Cómo trabajar
- Rama `codex/refresh-3-cambios`, creada **a partir de la rama `claude/encargo-codex-3-cambios`** (que ya incluye este archivo sobre `claude/awesome-curie-ehi971`). Nunca trabajes en la rama principal ni en `claude/awesome-curie-ehi971`.
- Un solo PR, con **tres commits separados**, uno por cambio (orden: «Nuevo», direcciones cortas, comparador). Es una desviación del «un PR por tarea»: los tres tocan los mismos archivos generados y separarlos causaría conflictos. Si ves una razón para separarlos, avisa antes.
- PR contra `claude/awesome-curie-ehi971`. **No hagas merge, no publiques, no despliegues.**
- Si algo del encargo es ambiguo o choca con `AGENTS.md`, pregunta antes de improvisar.

## Al terminar: REPORTE como descripción del PR
```
REPORTE · INCERPAZ · 3 cambios del sitio
Rama, PR y SHA:
Checks: cada prueba con ✓ o ✗
Cambios: lista breve (por cada uno de los tres)
Desviaciones del ENCARGO: ninguna | cuáles y por qué
Pendientes o dudas:
```

**Contexto:** `PROYECTO-INCERPAZ.md` y `AGENTS.md` de esta rama. La sesión de Claude Code «Rediseño web INCERPAZ» no debe implementar estos tres cambios: quedan a cargo de Codex.

**Rama y commit:** `claude/encargo-codex-3-cambios`.
