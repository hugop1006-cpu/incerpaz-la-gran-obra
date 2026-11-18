# 2026-11-18 · de Claude (arquitecto) para Codex (Luna) · corrección del PR #10 (ronda 1 de 2)

ENCARGO · INCERPAZ · pruebas de «Nuevo» y de direcciones cortas, sobre la base actual

**Objetivo:** dejar en la rama base solo lo que falta de tu trabajo (dos pruebas y una línea de contenido pendiente), sin reimplementar nada.

**Por qué:** tu PR #10 se cerró sin fusionar. A las 15:36 (hora de Bolivia), tres minutos después de abrirlo, la rama base `claude/awesome-curie-ehi971` recibió en el commit `d748f7e` la etiqueta «Nuevo» (campo `nuevo_hasta`) y las páginas por ciudad (`/cochabamba`, `/santa-cruz`, `/oruro`, `/sucre`, servidas por el mismo servidor sin `.html`). El comparador ya estaba desde `975a6de`. El trabajo no era tuyo para rehacer: llegó en paralelo desde otra sesión. Tu desviación de dos commits en el PR #10 estuvo bien justificada.

**Autorización:** Hugo (director) autorizó esta corrección el 18-11-2026. No incluye merge ni deploy.

**Riesgo:** bajo (solo pruebas y un texto).

## Qué hacer
1. Crea la rama `codex/pruebas-nuevo-y-rutas` a partir de la punta actual de `claude/awesome-curie-ehi971` (haz `git fetch origin` antes). **No** la bases en `claude/encargo-codex-3-cambios`: este archivo solo se lee desde esa rama con `git show`, no se trabaja ahí.
2. **No reimplementes** la etiqueta «Nuevo» ni las páginas por ciudad. Ya existen en la base.
3. Agrega `tools/probar-nuevo.js`, con el mismo estilo que las demás `tools/probar-*.js` y datos de prueba propios: fecha futura (se ve «Nuevo»), fecha vencida (no se ve), sin fecha (no se ve), y fecha mal escrita (no rompe la generación). No marques ningún producto real como nuevo.
4. Agrega `tools/probar-direcciones.js`: las cuatro rutas `/cochabamba`, `/santa-cruz`, `/oruro` y `/sucre` responden 200 con el servidor del proyecto, abren la ciudad correcta, y Oruro y Sucre muestran el catálogo de Cochabamba (ver `.ia/DECISIONES.md`). Confirma también que esas páginas no llevan precios en el HTML (regla 5 de `AGENTS.md`).
5. En `site-src/CONTENIDO-PENDIENTE.md` agrega la línea «Indicar qué productos son nuevos y hasta qué fecha» (no la dupliques si ya existe).
6. Si una prueba nueva revela un defecto real en lo que ya está en la base, **no lo arregles**: descríbelo en el REPORTE con el comando y la salida. Lo decidimos después.

## Terminado cuando
- `node site-src/build.js` no cambia nada en `site/` (si cambia, avisa en el REPORTE: la base no estaba regenerada).
- Pasan `node --test server/test/api.test.js` y todas las `tools/probar-*.js` del sitio, incluidas las dos nuevas. Ninguna prueba debilitada.
- `.ia/ESTADO.md` y `.ia/TAREAS.md` actualizados y un archivo de traspaso nuevo en `.ia/traspasos/` con `PLANTILLA.md`.

## Archivos
- **Permitidos:** `tools/probar-nuevo.js`, `tools/probar-direcciones.js`, `site-src/CONTENIDO-PENDIENTE.md`, `.ia/`.
- **Prohibido tocar:** todo lo demás, en particular `site-src/build.js`, `server/`, `site/` (generado), `.github/`, `site-src/redirecciones-tiendas.csv`, `server/data/precios-publicados.json`, `Dockerfile`, `Caddyfile`, `render.yaml`, `docker-compose.yml`, el juego (`index.html`, `js/`, `levels.js`, `style.css`) y las carpetas de datos del INE y la Gaceta. Sin dependencias nuevas.

## Cómo trabajar
- Un solo PR contra `claude/awesome-curie-ehi971`. **No hagas merge, no publiques, no despliegues.**
- Si algo es ambiguo o choca con `AGENTS.md`, pregunta antes de improvisar.

## Al terminar: REPORTE como descripción del PR
```
REPORTE · INCERPAZ · pruebas de «Nuevo» y direcciones cortas
Rama, PR y SHA:
Checks: cada prueba con ✓ o ✗
Cambios: lista breve
Desviaciones del ENCARGO: ninguna | cuáles y por qué
Defectos encontrados en la base (con comando y salida): ninguno | cuáles
Pendientes o dudas:
```

**Contexto:** `AGENTS.md` y `.ia/DECISIONES.md` de la base. Mensaje original del PR cerrado: https://github.com/hugop1006-cpu/incerpaz-la-gran-obra/pull/10
