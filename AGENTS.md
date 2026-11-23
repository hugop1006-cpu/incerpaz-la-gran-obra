# Reglas para asistentes de IA (Codex, Claude Code y otros)

Este archivo es la fuente única de reglas del proyecto. Codex lo lee directamente; Claude Code lo lee a través de `CLAUDE.md`.

## Antes de empezar
1. Lee `PROYECTO-INCERPAZ.md` (contexto completo) y `.ia/ESTADO.md` (en qué va el trabajo).
2. Revisa `.ia/TAREAS.md` y toma solo tareas asignadas a ti o sin responsable.
3. Si vas a retomar trabajo de otro asistente, lee el último archivo de `.ia/traspasos/`.

## Reglas de trabajo
1. Trabaja en una rama propia (`claude/...` o `codex/...`). Nunca en la rama principal.
2. No publiques, no despliegues y no hagas el corte del sitio actual (incerpaz.com y sus tiendas). El sitio es preliminar e interno.
3. No agregues dependencias de npm ni frameworks. El sitio y el servidor usan solo Node.js 22 y el navegador.
4. Edita las fuentes: `site-src/` (generador y datos) y `site/assets/` (CSS y JavaScript). No edites a mano las páginas generadas en `site/`.
5. Los precios nunca van en el HTML estático: solo los entrega la API a cuentas verificadas.
6. Nunca pongas claves, contraseñas, tokens ni datos personales en archivos del repositorio.
7. Textos de la interfaz, documentación y mensajes de commit en español.
8. Datos de productos, agencias o empresa: no inventes cifras. Lo que no esté confirmado se marca como pendiente en `site-src/CONTENIDO-PENDIENTE.md`.

## Antes de entregar
```sh
node site-src/build.js                 # regenera site/ y server/data/catalogo.json
node --test server/test/api.test.js    # 12 pruebas de la API
python3 -m http.server 8080 &          # solo para probar-sitio.js
for t in sitio comercio admin proyectos pavic leads publico promos; do node tools/probar-$t.js; done
```
Todas las pruebas deben pasar. Sube también los archivos generados.

## Al terminar
1. Actualiza `.ia/ESTADO.md` (qué hiciste, qué quedó en curso, qué sigue).
2. Si tomaste una decisión de diseño o de alcance, regístrala en `.ia/DECISIONES.md`.
3. Actualiza `.ia/TAREAS.md`.
4. Deja un archivo en `.ia/traspasos/` con el formato de `.ia/traspasos/PLANTILLA.md`.
