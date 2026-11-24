# 2026-11-24 · de Claude para Luna (Codex) · navegación consistente («Volver») en las páginas de detalle

Decisión de Hugo (23-11-2026): las tareas nuevas del sitio las implementa Luna con ENCARGO y REPORTE. Este archivo es el ENCARGO. Hilo sugerido: `INCERPAZ · Luna · navegación`. Es independiente de `2026-11-24-claude-para-luna-panel-confianza.md`; se pueden trabajar en ramas separadas.

```
ENCARGO · INCERPAZ (sitio) · botón «Volver» consistente en las páginas de detalle

Objetivo: que quien entra a una ficha, combo, promoción, proyecto, guía o a los recursos PAVIC siempre
tenga a la vista un botón «← Volver a …», igual al que ya existe en el comparador, «Calcula tus tejas»
y «Buscar».

Terminado cuando (todo verificable):
1. Las siguientes páginas generadas tienen el botón arriba, justo debajo de la ruta de migas (como en
   `techos.html`), con la clase `volver` y el atributo `data-volver`, y estos textos y destinos:
   - Ficha de producto (`productos/<ciudad>/<slug>.html`): «← Volver a los productos», destino
     `catalogo.html?ciudad=<catálogo del producto>`.
   - Combo (`combos/<ciudad>/<id>.html`): «← Volver a las promociones», destino `promociones.html`.
   - Promoción o curso (`promociones/<id>.html`): «← Volver a las promociones», destino `promociones.html`.
   - Proyecto (`proyectos/<slug>.html`): «← Volver a los proyectos», destino `proyectos.html`.
   - Guía (`guias/<slug>.html`): «← Volver a las guías», destino `guias.html`.
   - Recursos PAVIC (`pavic-recursos.html`): «← Volver a PAVIC», destino `pavic.html`.
   Las rutas relativas deben funcionar en cada profundidad de carpeta (hay páginas en `../` y `../../`).
2. Comportamiento (ya implementado en `site.js` para `a[data-volver]`; solo hay que reutilizarlo, no
   duplicarlo): si la persona llegó desde otra página del sitio, el botón regresa a ella con sus filtros y su
   posición; si abrió la página directo o desde un buscador, vale el enlace de destino.
3. NO llevan el botón las páginas de primer nivel (inicio, catálogo, promociones, proyectos, guías, PAVIC,
   Dónde comprar, Empresa, Exportaciones, Privacidad, páginas de ciudad, 404): no tienen «atrás» natural.
   Las que hoy ya lo tienen (comparar, tejas, buscar) no cambian.
4. En la ficha de producto del celular el botón no choca con la barra fija de cotizar de abajo ni con el
   botón de WhatsApp (revisar a 390 px y 360 px), y no provoca desborde horizontal en ninguna de las páginas.
5. En celular el botón ocupa poco alto (el contenido no debe bajar más de ~56 px respecto de hoy).
6. Pruebas nuevas en `tools/probar-sitio.js` que pasan:
   - Una página de cada tipo (ficha, combo, promoción, proyecto, guía, recursos PAVIC) tiene el botón con el
     texto y el destino correctos abierta directa.
   - Llegando desde el catálogo (con ciudad y filtro) a una ficha, «Volver» regresa al catálogo con ese mismo
     filtro; llegando desde «Buscar» o desde «Comparar», regresa a esa página.
   - Las páginas de primer nivel NO tienen `[data-volver]`.
   - Sin desborde horizontal a 390 px en las seis páginas.
7. Todas las pruebas del proyecto en verde (lista en `AGENTS.md`, «Antes de entregar»). Capturas de
   escritorio y celular de una ficha, un proyecto y una guía en el PR.

Archivos permitidos:
- `site-src/build.js` (solo las plantillas de las seis páginas y, si hace falta, una pequeña función
  para no repetir el botón)
- `site/assets/css/site.css` (solo la regla `.volver` y su versión de celular)
- `site/assets/js/site.js` (solo el manejador `a[data-volver]` si hay que ajustarlo; sin duplicarlo)
- `tools/probar-sitio.js`
- `.ia/ESTADO.md`, `.ia/TAREAS.md`, `.ia/DECISIONES.md`, `.ia/traspasos/`
- páginas generadas en `site/` (resultado de `node site-src/build.js`; no se editan a mano)

Prohibido tocar:
- `server/`, `site/assets/js/comercio.js`, `admin.js`, cuentas, precios, pedidos, ERP y autenticación.
- Calculadoras, comparador, buscador, datos (`site-src/data/*.json`) y textos de contenido.
- Migas de pan existentes (se mantienen tal cual) y el menú principal.
- `.github/workflows/`, `ine-mensual/`, `gaceta-anual/` y el juego (`js/`, `style.css`, `levels.js`).
- Dependencias de npm o frameworks (solo Node.js 22 y el navegador).

Riesgo: bajo. Solo interfaz, estilos y pruebas.

Contexto (solo lo indispensable):
- El botón ya existe en `comparar.html` (con un manejador propio que solo regresa si se llegó desde el
  catálogo), `techos.html` y `buscar.html` (con el manejador genérico `data-volver`). Estilo: clase `.volver`
  en `site.css`. Sigue ese patrón; no inventes uno nuevo.
- Todas las páginas de detalle ya tienen migas de pan (`<nav class="crumbs">`); el botón va justo después.
- Los textos de la interfaz usan «Productos» (no «Catálogo») y «Dónde comprar» (no «Dónde estamos»).
- Textos, documentación y commits en español, sin jerga. El sitio es preliminar e interno: no se publica ni
  se despliega.
- Esta tarea y la del panel de confianza pueden tocar `site.css`, `ESTADO.md` y `TAREAS.md`: si hay conflicto
  al fusionar la segunda, se conserva el contenido de ambas.
- PR contra `main` (los PR #14 y #15 del sitio fueron ahí). Una rama `codex/...` y un PR para esta tarea.
  Máximo dos rondas de corrección; en la tercera se escala a Hugo.
- Merge y deploy los autoriza Hugo, por separado. Merge no es deploy.
```

## REPORTE esperado (Luna → Claude)

```
REPORTE · INCERPAZ (sitio) · botón «Volver» consistente en las páginas de detalle
Rama, PR y SHA:
Checks: API (n de n), sitio, comercio, admin, proyectos, pavic, leads, publico, promos, confianza: cada uno con ✓ o ✗
Cambios: lista breve
Desviaciones del ENCARGO: ninguna | cuáles y por qué
Pendientes o dudas:
```

## Notas para Hugo
- Es una tarea de riesgo bajo: no toca datos, servidor ni cuentas.
- Se envía igual que la otra: `codex queue --thread "INCERPAZ · Luna · navegación" --message "<texto del bloque ENCARGO>"`.
- Mismo asunto de rama de destino que el otro ENCARGO: `main` (el protocolo dice la rama por defecto, `claude/gracious-wright-mkglyk`; si prefieres esa, se cambia la línea antes de enviarlo).
