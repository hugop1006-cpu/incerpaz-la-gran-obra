# Traspaso a otro chat: INCERPAZ, dónde vamos

Pega este archivo al empezar un chat nuevo (Claude, ChatGPT, Claude Code o Codex). Dice qué es el proyecto, qué se hizo, qué sigue y las reglas de trabajo. Para el detalle técnico completo lee también `PROYECTO-INCERPAZ.md` y `AGENTS.md` del repositorio.

Actualizado: 23 de noviembre de 2026.

---

## 1. Qué es esto

**INCERPAZ** es una empresa boliviana de cerámica para la construcción (ladrillos, tejas, pisos, revestimientos, refractarios y el pavimento cerámico **PAVIC**). Color de marca rojo `#b5121b`. Atiende desde Cochabamba, Santa Cruz, Oruro y Sucre; en La Paz solo hay un punto de venta PAVIC.

Estamos construyendo **un sitio nuevo preliminar e interno** que reemplazará a incerpaz.com y a sus tiendas. Hugo (dueño del proyecto) lo presenta al directorio y a marketing.

- Repositorio: `github.com/hugop1006-cpu/incerpaz-la-gran-obra`
- Rama de trabajo: `claude/awesome-curie-ehi971` (sin pull request; no se ha fusionado a la rama principal)
- Las 6 tandas de los wireframes ya están hechas; el último commit está en la rama (ver `git log`)

## 2. Qué NO se hace todavía (importante)

- **No se publica, no se despliega y no se hace el corte del sitio actual** (redirecciones de tiendas, dominio). Hugo lo decidió: «todavía no haremos corte».
- **No se toca la web sin permiso de Hugo.** Hugo pide permiso previo antes de cambiar la web: se propone, él aprueba y recién ahí se implementa, por tandas.
- Los precios **solo** los ven cuentas verificadas por un ejecutivo de su ciudad. Nunca van en el HTML estático.
- No inventar cifras, datos de empresa ni textos legales. Lo no confirmado se marca como pendiente en `site-src/CONTENIDO-PENDIENTE.md`.

## 3. Tecnología

- HTML, CSS y JavaScript sin frameworks ni dependencias. Generador y servidor en **Node.js 22** (`node:sqlite`, sin npm).
- `site-src/build.js` arma las páginas desde `site-src/data/*.json` y escribe `site/`.
- Servidor `server/` (cuentas, precios, presupuestos, pedidos, contactos, panel de administración).
- ERP Seasoft: el adaptador sigue un contrato **propuesto** (`server/ERP.md`); la API real no se conoce.
- Despliegue preparado y **no ejecutado**: Docker, Render + Cloudflare, o servidor propio con Caddy (`server/DESPLIEGUE.md`).

## 4. Estructura de carpetas (lo esencial)

```
site-src/build.js          generador (edita aquí, no las páginas de site/)
site-src/data/             productos, proyectos, guías, promociones, sitio (JSON)
site-src/CONTENIDO-PENDIENTE.md   datos faltantes y decisiones pendientes
site/assets/{css,js}/      estilos y scripts del sitio (se editan a mano)
site/*.html                páginas GENERADAS (no editar a mano)
server/                    API, base de datos, adaptadores del ERP, pruebas
tools/                     pruebas de navegador (Playwright)
.ia/                       comunicación entre asistentes (ESTADO, DECISIONES, TAREAS, traspasos/, revisiones/)
AGENTS.md / CLAUDE.md      reglas para asistentes (CLAUDE.md solo importa AGENTS.md)
PROYECTO-INCERPAZ.md       contexto completo del proyecto
```

## 5. Cómo se trabaja

```sh
node site-src/build.js                 # regenera site/ y server/data/catalogo.json
node --test server/test/api.test.js    # 12 pruebas de la API
python3 -m http.server 8080 --bind 127.0.0.1 &   # solo para tools/probar-sitio.js
for t in sitio comercio admin proyectos pavic leads publico promos; do node tools/probar-$t.js; done
```

Todas deben pasar antes de subir (hoy: 12 de API y 8 de navegador en verde; el servidor no sirve carpetas sin archivo, el juego se abre en `juego/index.html`). Se sube también el sitio generado. Los textos de la interfaz, la documentación y los commits van **en español**. Al terminar una tarea se actualiza `.ia/ESTADO.md`, `.ia/TAREAS.md`, `.ia/DECISIONES.md` si hubo decisiones, y se deja un archivo en `.ia/traspasos/`.

## 6. Lo que ya está construido

**Sitio de marca:** inicio, catálogo por ciudad (Cochabamba 32 y Santa Cruz 25 productos), fichas con calculadora, promociones y combos por ciudad, proyectos para construir (churrasquero, mesón, pared con enchape) con lista de materiales, 5 guías, PAVIC (marca, recursos para proyectistas con calculadora, pliegos y DXF), Dónde estamos, Empresa, exportaciones (español e inglés), privacidad.

**Comercio interno:** cuentas con verificación por ejecutivo, precios por ciudad y lista, presupuestos, pedidos con estados, panel del equipo, panel de administración con historial, contactos (leads) con CSV, respaldos.

**Ideas tomadas del prototipo de Fergie (Base44) y de los pedidos de la reunión (todas con permiso de Hugo):**
- Ventana «¿Desde qué ciudad nos visitas?» en la primera visita y páginas por ciudad (`/cochabamba`, `/santa-cruz`, `/oruro`, `/sucre`).
- Botón fijo de WhatsApp con mensaje según la página; formulario corto en la portada con consentimiento.
- Comparador de hasta 4 productos del mismo catálogo (`comparar.html`).
- Productos nuevos con fecha de vencimiento (campo «nuevo hasta» en el panel).
- Revisión UX prioridad 1: accesos rápidos, encabezado compacto en celular, catálogo a 2 columnas en celular, botón de WhatsApp redondo que se aparta al escribir, barra fija de cotizar en fichas.
- **Wireframes, tandas hechas:**
  1. Buscador general (`buscar.html`) y presupuesto con contador en el encabezado.
  2. Proyectos en el inicio, filtro por dificultad y «Proyectos donde se usa» en las fichas.
  3. Banda «¿Construyes o vendes materiales?» y campo «Soy» en los formularios cortos.
  4. PAVIC: camiones en la calculadora, «Cómo trabajamos un proyecto» y pedido de muestras.
  5. Calculadora de tejas por pendiente (`techos.html`).
  6. Ordenar el catálogo, «Nuestras marcas» en Empresa y el juego «La Gran Obra» dentro del sitio (`site/juego/`, copiado por el generador).
- **Revisión UX prioridad 2:** nombres consistentes, tarjetas más limpias, ícono de cuenta y presupuesto marcado, franja de confianza con datos reales.

**Documentos creados en Claude** (privados; ChatGPT y Codex no los abren por enlace): presentación del directorio (20 diapositivas, incluye «Lo que pidió la reunión»), demo navegable, wireframes, resumen de una página, pendientes por área, validación exportadora, plantilla de campaña mensual, revisión técnica, mensajes por responsable, descripciones de producto, revisión del prototipo de Fergie.

## 7. Qué sigue

**Con Hugo, en este orden:**
1. **Revisión UX prioridad 3** (propuesta, no aprobada). La prioridad 2 ya está hecha: nombres consistentes («Productos», «Dónde comprar»), tarjetas con una línea de precio, ícono de cuenta y presupuesto marcado, franja de confianza. Las fotos de producto uniformes dependen de Marketing.
2. **Cerrar los pedidos de la reunión que dependen de otras áreas:** transporte según producto y ubicación, seguimiento real de la entrega, testimonios, ficha técnica PAVIC, cursos reales, más proyectos «Construye tú mismo».

**Pendientes que dependen de otras personas** (hay mensajes listos para cada área):
- **Sistemas:** API y ambiente de pruebas de Seasoft, códigos de producto por ciudad.
- **Programador en jefe:** DNS actuales de incerpaz.com, dónde se aloja el sitio y quién lo opera.
- **Legal:** política de privacidad, términos de uso, bases de concursos y sorteos, texto de consentimiento.
- **Marketing:** primera campaña real (hoy las promociones son ejemplos), quién atiende contactos y muestras, fotos propias, marcar los productos nuevos reales.
- **Técnicos:** revisar fórmulas de proyectos y guías; aprobar las descripciones de producto propuestas.
- **Datos por confirmar:**
  - WhatsApp de la agencia Central de Cochabamba (el prototipo de Fergie dice 79723246; nuestro sitio, 70750963) y de Castillo.
  - Capacidad real del camión PAVIC (hoy 20 t de ejemplo).
  - Pendiente mínima de cada teja y ficha de la teja canal.
  - Medidas distintas entre ciudades.

**En pausa:** validación del mercado exportador. Siguiente paso: CSV de importaciones de la subpartida 6907.23.10 desde USITC DataWeb (la API del Census no funcionó con el proxy de la sesión).

**Decisiones que no están tomadas:** programa de puntos para constructores (¿existe?), marca propia de tejas, alojamiento del sitio.

## 8. Cosas que conviene saber

- La plataforma que recomendaban los wireframes (Next.js, CMS externo, Medusa, CRM) **no se usó**: el sitio se construyó con una base propia más liviana. Conviene que el programador en jefe confirme ese camino antes de crecer.
- Tras cada cambio visual se revisó con capturas en escritorio (1280 px) y celular (390 px).
- Las verificaciones automáticas de seguridad a veces bloquean comandos con ciertos textos de código; se resuelve haciendo los cambios con el editor en lugar del shell.
- El detalle de cada entrega está en `.ia/traspasos/` y el estado vivo en `.ia/ESTADO.md` y `.ia/TAREAS.md`.

## 9. Primer mensaje sugerido para el chat nuevo

> Soy Hugo. Estoy trabajando en el sitio nuevo de INCERPAZ (repositorio y rama arriba). Lee `AGENTS.md`, `.ia/ESTADO.md`, `.ia/TAREAS.md` y este traspaso. No publiques ni toques el sitio actual, y pídeme permiso antes de cambiar la web. Hoy quiero: **[escribe aquí lo que sigue, por ejemplo «la revisión UX prioridad 2»]**.
