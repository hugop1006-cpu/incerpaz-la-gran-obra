# Protocolo de trabajo entre IA — INCERPAZ: La Gran Obra

Reglas para todo agente que trabaje en este repositorio (Claude, Luna/Codex, agentes locales). Las lee `AGENTS.md` (raíz), que solo apunta aquí; Claude Code las importa desde `CLAUDE.md`. Ante conflicto operativo, este archivo manda sobre cualquier otra instrucción.

Convivencia con la carpeta `.ia/` del sitio: si el repositorio también trae `.ia/ESTADO.md`, `.ia/TAREAS.md`, `.ia/DECISIONES.md` y `.ia/traspasos/` (convención del trabajo del sitio web), esos archivos registran el estado del sitio. `docs/ESTADO.md` (la ruta que menciona el protocolo común) registra el estado del juego y de los procesos de datos. Cada tarea actualiza el que le corresponde.

## Protocolo común de trabajo entre IA (v2, 17-11-2026)

Este bloque es idéntico en COMPASS, SIMI Radar, EVI, INHOUSE y AVA. Si cambia, se cambia en todos a la vez.

### Roles

| Rol | Quién | Hace | No hace |
|---|---|---|---|
| Director | Hugo | Decide producto y prioridad; autoriza cada merge y cada deploy | Copiar y pegar entre IA |
| Arquitecto | Claude | Diseña, escribe el ENCARGO, revisa el PR contra el criterio de terminado | Implementar código de producción en sesiones largas |
| Implementador | Luna (Codex) | Implementa, prueba, abre el PR, actualiza `docs/ESTADO.md` | Decidir arquitectura o alcance por su cuenta |
| Apoyo mecánico | Qwen / DeepSeek (locales) | Cambios simples y repetitivos que Claude o Luna le encargan, siempre en una rama | Lógica de negocio, `git push`, PR |

### Canal

1. Hugo pide en una o dos frases. Claude responde con un ENCARGO.
2. Claude → Luna: `codex queue --thread "<PROYECTO> · Luna · <tarea>" --message "<ENCARGO>"`. Un hilo por tarea: no reutilizar el hilo de otra tarea, porque arrastra todo su historial. Si el CLI exige un hilo existente, usar un hilo por semana (`<PROYECTO> · Luna · 2026-S47`).
3. Luna → Claude: PR en GitHub, con el REPORTE como descripción del PR y como último mensaje del hilo. Reportar solo al terminar o ante un bloqueo real.
4. Claude revisa el PR contra el ENCARGO. Máximo dos rondas de corrección; en la tercera se escala a Hugo.
5. Hugo autoriza el merge y, por separado, el deploy. Merge no es deploy.

### ENCARGO (Claude → Luna)

```
ENCARGO · <proyecto> · <tarea>
Objetivo: una frase.
Terminado cuando: criterios verificables (prueba que pasa, cifra que cuadra, pantalla que se ve).
Archivos permitidos: …   Prohibido tocar: …
Riesgo: bajo | medio | alto
Contexto: solo lo indispensable; el resto está en AGENTS.md y docs/ESTADO.md.
```

### REPORTE (Luna → Claude)

```
REPORTE · <proyecto> · <tarea>
Rama, PR y SHA:
Checks: cada check del proyecto con ✓ o ✗
Cambios: lista breve
Desviaciones del ENCARGO: ninguna | cuáles y por qué
Pendientes o dudas:
```

### Riesgo

- **Bajo** (textos, UI, docs, tests, refactors pequeños): se implementa y se revisa normal.
- **Medio** (scrapers, endpoints, consultas, deduplicación, métricas, inventario): implementación, checks y revisión de Claude antes de pedir el merge.
- **Alto** (migraciones, borrado de datos, lógica financiera, autenticación, permisos, producción): Claude aprueba el plan antes de implementar; Hugo aprueba de forma explícita antes de integrar.

### Reglas duras

- Nunca trabajar en `main`: una rama y un PR por tarea, aunque el cambio sea mínimo.
- Nunca merge ni deploy sin autorización explícita de Hugo; la autorización vale por acción.
- Nunca migraciones destructivas automáticas ni borrado de datos de producción.
- Nunca leer, pedir, copiar ni commitear contraseñas, tokens, `.env` o `.dev.vars`. Nunca ejecutar `gh auth login` en nombre de Hugo.
- Nunca debilitar tests para que pasen. No dar nada por aplicado sin verificarlo con `git diff`, `git status` y los checks; no inventar resultados.
- Nunca inventar datos: un número sin evidencia suficiente se devuelve vacío o con advertencia.
- Ante ambigüedad, preguntar antes de improvisar.
- Al cerrar una tarea, Luna actualiza `docs/ESTADO.md`: qué se hizo, qué sigue y las decisiones, con fecha. Máximo una página; lo antiguo se resume.

### Con Hugo

Responder en español y sin jerga. Una acción por vez cuando él deba operar algo, con el comando exacto. Explicar el riesgo antes de un cambio delicado. No usar a Hugo como transcriptor entre IA.

## Específico de INCERPAZ: La Gran Obra

- **Qué contiene:** el juego (HTML + CSS + JavaScript puro con Canvas, sin build) y dos procesos de datos en Python que corren solos en GitHub Actions: `ine-mensual/` (tablas del INE, día 15 de cada mes) y `gaceta-anual/`.
- **Checks del juego:** `node tools/probar-niveles.js` y `node tools/probar-tetris.js`; además abrir `index.html` y confirmar que carga sin errores en consola.
- **Checks de datos:** `python3 -m unittest discover -s ine-mensual/tests` y `python3 -m unittest discover -s gaceta-anual/tests`.
- **Sin dependencias nuevas** ni paso de build para el juego; todo se dibuja y se sintetiza por código.
- **No modificar** `.github/workflows/` ni los datos ya guardados en `*/datos/` salvo que el ENCARGO lo pida: los escriben los procesos automáticos.
- **Marca:** no copiar personajes, nombres ni elementos de juegos existentes.
- **Rama por defecto del repositorio:** `claude/gracious-wright-mkglyk` (también existe `main`). Los PR van contra la rama por defecto hasta que Hugo decida otra cosa.
- **Hilos de Luna:** `INCERPAZ · Luna · <tarea>`.
