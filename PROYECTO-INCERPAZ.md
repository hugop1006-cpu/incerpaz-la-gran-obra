# Proyecto INCERPAZ: contexto completo para trabajar con IA

Documento de referencia del proyecto. Está escrito para que cualquier asistente (Claude, Claude Code, ChatGPT o Codex) entienda el proyecto sin leer el historial de conversaciones, y para armar a partir de él las carpetas y archivos de comunicación entre asistentes (sección 12).

Actualizado: 17 de noviembre de 2026.

---

## 1. Qué es el proyecto

**INCERPAZ** es una empresa boliviana de cerámica para la construcción: ladrillos, tejas, pisos, revestimientos, piezas especiales, refractarios y el pavimento cerámico **PAVIC**. Tiene agencias y fábricas en Cochabamba, Santa Cruz, Oruro y Sucre, y un punto de venta PAVIC en La Paz. Color de marca: rojo `#b5121b`.

El repositorio contiene dos cosas:

1. **El nuevo sitio web de INCERPAZ** (lo principal): un sitio preliminar e interno que reemplazará a incerpaz.com y a sus tiendas actuales. Todavía **no está publicado** y **no se hará el corte** del sitio actual hasta que se decida.
2. **«La Gran Obra»**: un juego de plataformas 2D de marca, hecho antes que el sitio (raíz del repositorio).

### Objetivos del sitio
- Promover la marca y generar contactos (leads).
- Comercio interno: precios solo para cuentas verificadas, presupuestos y pedidos conectados al ERP Seasoft.
- Herramientas para constructores y dueños de casa: calculadoras, proyectos con lista de materiales, guías.
- Área corporativa (equipo y administración), hub de PAVIC para proyectistas, promociones y combos por ciudad.
- Más adelante, exportaciones.

### Etapas
| Etapa | Contenido | Estado |
|---|---|---|
| 1. Renovación | Sitio de marca, catálogo, agencias, contacto, guías, proyectos, PAVIC, promociones | Construido en el prototipo; falta contenido real y revisiones |
| 2. Comercio interno | Cuentas verificadas, precios, presupuestos, pedidos al ERP Seasoft | Construido con adaptador local; falta la API real de Seasoft |
| 3. Comercio internacional | Venta por brokers o consolidadores (baldosa de arcilla tipo mexicana, enchapes, tejas) | En validación de mercado (en pausa) |

### Equipo propuesto
- Dirección y arquitectura: Hugo (dueño del proyecto).
- Programador en jefe: responsable oficial de sistemas del grupo.
- Empresa que desarrolló el sistema de dirección corporativa (cumplimiento, actas, gestión patrimonial).
- Coordinación de marketing y community manager junior.
- Fergie: hizo un prototipo alternativo en Base44 (ver sección 10).

---

## 2. Repositorio y ramas

- Repositorio: `github.com/hugop1006-cpu/incerpaz-la-gran-obra`.
- Rama de trabajo: `claude/awesome-curie-ehi971`. Todo el trabajo del sitio está ahí. **No hay pull request abierto** y no se ha fusionado a la rama principal.
- Historial: unos 40 commits desde el 20 de octubre de 2026. Mensajes de commit en español.

---

## 3. Lenguajes y tecnología

| Parte | Lenguaje | Detalle |
|---|---|---|
| Sitio | HTML, CSS, JavaScript (ES5 en el navegador) | Sin frameworks ni dependencias. Tipografías Barlow Condensed y Barlow (Google Fonts) |
| Generador del sitio | JavaScript (Node.js 22) | `site-src/build.js` arma todas las páginas a partir de JSON |
| Servidor | JavaScript (Node.js 22) | Módulo `http` y `node:sqlite` incluidos en Node. **Cero dependencias de npm** |
| Base de datos | SQLite | Un archivo; una sola instancia |
| Datos y contenido | JSON | Productos, agencias, promociones, proyectos, guías |
| Pruebas | Node test runner y Playwright (Chromium) | Pruebas de API y pruebas de navegador de punta a punta |
| Despliegue (preparado, no ejecutado) | Docker, Render (YAML), Caddy, Cloudflare | Ver sección 9 |
| Juego | HTML, CSS, JavaScript con Canvas | Sin imágenes ni sonidos externos |

Tamaño aproximado: 7.100 líneas de JavaScript, 5.200 de HTML (sin contar las fichas generadas), 380 de CSS y 5.500 de JSON.

Principios técnicos que se mantienen:
- Sin dependencias externas ni paso de compilación del lado del navegador.
- Los precios **nunca** están en el HTML estático; solo los entrega la API a cuentas verificadas.
- Sitio estático generado + servidor pequeño para cuentas, precios, pedidos, contactos y administración.
- Todo el texto de la interfaz en español; accesible (foco visible, `<dialog>`, etiquetas en formularios) y usable en celular.

---

## 4. Estructura de carpetas

```
/                               raíz del repositorio
├── PROYECTO-INCERPAZ.md        este documento
├── README.md                   instrucciones del juego «La Gran Obra»
├── index.html, style.css,      juego: página, estilos, colores de marca y reglas,
│   config.js, levels.js,       niveles, manifiesto e íconos
│   manifest.json, icons/
├── js/                         juego: motor (game.js), arte (sprites.js), audio, fuente
├── wireframes/index.html       wireframes del rediseño (primera etapa de diseño)
│
├── site-src/                   FUENTES DEL SITIO
│   ├── build.js                generador: lee data/*.json y escribe site/ y server/data/catalogo.json
│   ├── config.json             interno: true (sin indexar), dirección del CRM
│   ├── CONTENIDO-PENDIENTE.md  lista viva de datos faltantes y decisiones pendientes
│   ├── README.md               cómo generar el sitio
│   ├── redirecciones-tiendas.csv   redirecciones 301 de las tiendas actuales (no aplicadas)
│   └── data/
│       ├── sitio.json          ciudades, WhatsApp, agencias, categorías, redes, textos de empresa
│       ├── productos.json      57 productos: 32 de Cochabamba y 25 de Santa Cruz
│       ├── proyectos.json      3 proyectos (churrasquero, mesón, pared con enchape) con fórmulas
│       ├── guias.json          5 guías técnicas
│       └── promociones.json    novedades y combos (hoy solo ejemplos)
│
├── site/                       SITIO GENERADO (no editar a mano salvo assets/)
│   ├── *.html                  inicio, catálogo, promociones, proyectos, guías, PAVIC,
│   │                           dónde estamos, empresa, exportaciones, privacidad, cuenta y panel
│   ├── productos/<ciudad>/     una ficha por producto
│   ├── proyectos/, guias/, promociones/, combos/
│   ├── robots.txt (sitemap.xml solo con PUBLICO=1)
│   └── assets/
│       ├── css/site.css        estilos de todo el sitio
│       ├── js/site.js          ciudad, ventana de ciudad, WhatsApp, calculadoras, catálogo, formularios
│       ├── js/comercio.js      cuentas, precios, presupuesto, pedidos, panel del equipo
│       ├── js/admin.js         panel de administración (productos, precios, promociones, agencias, equipo)
│       ├── js/promos.js, proyectos.js, pavic.js
│       ├── js/config.js        generado: ciudades, WhatsApp, destino de formularios
│       └── img/                logos y 96 fotos de producto
│
├── server/                     SERVIDOR
│   ├── index.js                arranque
│   ├── lib/app.js              rutas de la API, seguridad, archivos estáticos
│   ├── lib/db.js               esquema SQLite
│   ├── lib/auth.js             contraseñas (scrypt) y sesiones
│   ├── lib/contenido.js        contenido editable desde el panel, historial y restauración
│   ├── lib/http.js, respaldo.js, semilla.js
│   ├── lib/erp/                adaptadores del ERP: local (por defecto), mock, seasoft (sin probar)
│   ├── data/catalogo.json      generado: catálogo confiable para validar pedidos
│   ├── data/contenido/         contenido editado desde el panel (no se sube a git)
│   ├── test/api.test.js        12 pruebas de la API
│   ├── crear-admin.js, respaldo.js, entrada.sh
│   ├── README.md               variables de entorno, cuentas, seguridad
│   ├── ERP.md                  contrato propuesto con Seasoft
│   └── DESPLIEGUE.md           guía de despliegue Render + Cloudflare o servidor propio
│
├── tools/                      PRUEBAS DE NAVEGADOR (Playwright)
│   ├── probar-sitio.js         páginas, ciudad, ventana de ciudad, calculadora, catálogo, móvil
│   ├── probar-comercio.js      registro, verificación, precios, presupuesto, pedido
│   ├── probar-admin.js, probar-proyectos.js, probar-pavic.js,
│   │   probar-leads.js, probar-publico.js, probar-promos.js
│   ├── visitante.js            contexto de navegador de un visitante que ya eligió ciudad
│   └── probar-niveles.js, bot-lib.js   pruebas del juego
│
└── Dockerfile, docker-compose.yml, Caddyfile, render.yaml, .env.ejemplo, .dockerignore
```

---

## 5. Cómo se trabaja

```sh
node site-src/build.js                 # genera site/ y server/data/catalogo.json
node server/index.js                   # sitio + API en http://localhost:3000
node --test server/test/api.test.js    # pruebas de la API

# Pruebas de navegador (cada una levanta su propio servidor, salvo probar-sitio):
python3 -m http.server 8080            # solo para probar-sitio.js (sirve la raíz)
node tools/probar-sitio.js
node tools/probar-comercio.js          # y probar-admin, probar-proyectos, probar-pavic,
                                       # probar-leads, probar-publico, probar-promos
```

Variantes del generador (variables de entorno):
- `PUBLICO=1`: sitio indexable (el día de la salida pública).
- `DEMO=1`: demostración sin cuentas, precios ni envío de formularios, con aviso visible.
- `COMERCIO=0`: sin la parte de comercio.
- `CONTENT_DIR`, `SITE_OUT`, `CATALOGO_OUT`: rutas de contenido y de salida.

Regla: después de cambiar `site-src/` o `site/assets/`, regenerar el sitio, correr las 12 pruebas de la API y las 8 pruebas de navegador, y subir también los archivos generados.

---

## 6. Servidor: API, datos y seguridad

**Tablas SQLite:** usuarios, sesiones, presupuestos, presupuesto_items, pedidos, pedido_items, pedido_eventos, precios, ajustes, cambios, leads.

**Roles:** cliente (se registra y lo verifica un ejecutivo de su ciudad), ejecutivo (por ciudad), admin.

**Rutas principales:**
- Públicas: `GET /api/salud`, `POST /api/registro`, `POST /api/login`, `POST /api/logout`, `GET /api/yo`, `POST /api/leads`.
- Cliente verificado: `GET /api/precios`, presupuestos (`GET/POST/DELETE /api/presupuestos…`, enviar), pedidos (`GET/POST /api/pedidos…`, repetir).
- Equipo y administración (`/api/admin/…`): cuentas, equipo, pedidos y estados, contactos (con CSV), precios, productos, imágenes, contenido del sitio, promociones, historial, restaurar y respaldo.

**Seguridad:** contraseñas con scrypt, cookie HttpOnly, cabecera anti-CSRF `X-Requested-With: incerpaz`, límites de intentos, política de seguridad de contenido (CSP), HSTS, compresión, caché con ETag y archivos versionados.

**ERP Seasoft:** el adaptador `seasoft` implementa un contrato **propuesto** (`server/ERP.md`): crear pedido y consultar su estado. La API real no se conoce; falta ambiente de pruebas y credenciales.

**Variables de entorno:** ver `server/README.md` y `.env.ejemplo`. Las más importantes: `PORT`, `DB_PATH`, `CONTENT_DIR`, `ERP_ADAPTER`, `ADMIN_*`, `PUBLICO`, `CANONICAL_HOST`, `COOKIE_SECURE`, `TRUST_PROXY`, `CLOUDFLARE`, `ORIGEN_SECRETO`, `SEASOFT_URL`, `SEASOFT_TOKEN`. Nunca se suben claves al repositorio.

---

## 7. Funciones del sitio hoy

- Ciudad: ventana «¿Desde qué ciudad nos visitas?» en la primera visita y selector en el encabezado. Cambia catálogo, promociones, WhatsApp y la ciudad de los formularios.
- Catálogo por ciudad (Cochabamba y Santa Cruz; Oruro y Sucre usan el de la fábrica más cercana) con filtros, búsqueda y combos.
- Fichas de producto con medidas, rendimiento y calculadora de piezas.
- Comparador de productos: hasta 4 del mismo catálogo, lado a lado, en `comparar.html` (enlace compartible; precio solo con cuenta).
- Proyectos con lista de materiales, costos (con cuenta) y esquema que cambia con las medidas.
- PAVIC: página de marca y recursos para proyectistas (calculadora de obra, sección típica, texto para pliegos, DXF).
- Promociones por ciudad: concursos, sorteos, eventos, cursos, noticias y combos (con productos del catálogo u otros, como ollas o herramientas). El ejecutivo crea borradores; el administrador publica.
- Guías técnicas, exportaciones (consulta en español e inglés), privacidad.
- Formularios guardados como contactos (Equipo → Contactos); en la portada, formulario con consentimiento de privacidad.
- Botón fijo de WhatsApp con mensaje según la página.
- Cuentas, precios, presupuestos y pedidos; panel del equipo; panel de administración con historial.
- Correcciones de ortografía y concordancia de los textos de producto, aplicadas al generar (los datos originales no se tocan).

---

## 8. Documentos y artefactos creados en Claude

Son páginas y documentos privados en claude.ai: solo Hugo puede abrirlos hasta que los comparta. ChatGPT y Codex no pueden leerlos por enlace; hay que exportarlos o copiar su contenido.

| Documento | Enlace |
|---|---|
| Wireframes del rediseño | https://claude.ai/artifact/LsF6x9S3asuaiHYCKGgP11 |
| Demo navegable del sitio | https://claude.ai/artifact/WDbPpVxD214H381VBe9jTt |
| Presentación de la propuesta (diapositivas) | https://claude.ai/artifact/D54V4PNRboC1KoJiKrkdfU |
| Resumen de una página para marketing | https://claude.ai/artifact/UcCMT2K9ahhrNn3SPLV4kN |
| Pendientes por área | https://claude.ai/artifact/R2jswDkboEsrVUhRPBQZoM |
| Validación del mercado exportador | https://claude.ai/artifact/67E84rrd4naETwfkm6avxj |
| Reunión con Sistemas | https://claude.ai/artifact/XiDorihgPejXmh7kYqnfB1 |
| Plantilla de campaña mensual | https://claude.ai/artifact/AQgbjYaU7Bowxf5fn4BiED |
| Revisión técnica de fórmulas y textos | https://claude.ai/artifact/CghxwC4gay5rYycxkA2fdh |
| Mensajes por responsable | https://claude.ai/artifact/RcB4PuNozC9kvZpnVKK78j |
| Descripciones de producto (propuesta) | https://claude.ai/artifact/BMrkc82XChJQCx2todatVf |
| Revisión del prototipo de Fergie | https://claude.ai/artifact/91TqepMaCnYRQaeV3mcXey |

Documentos dentro del repositorio: `site-src/CONTENIDO-PENDIENTE.md`, `server/README.md`, `server/ERP.md`, `server/DESPLIEGUE.md`, `site-src/README.md`.

---

## 9. Despliegue (preparado, no ejecutado)

- Opción A: **Render** (blueprint `render.yaml`, Docker, disco persistente en `/datos`) con **Cloudflare** delante.
- Opción B: servidor propio con `docker-compose.yml` y **Caddy** (HTTPS automático).
- Respaldo diario de la base y del contenido (`VACUUM INTO`), se conservan 14.
- Pasos, lista de salida pública y redirecciones: `server/DESPLIEGUE.md`.
- **Decisión pendiente:** dónde se aloja y quién lo opera. No se publica ni se hace el corte hasta decidirlo.

---

## 10. Decisiones tomadas

- El sitio es preliminar e interno (`noindex`). No se publica ni se toca el sitio actual por ahora.
- Precios solo para cuentas verificadas por un ejecutivo de su ciudad.
- Dos catálogos (Cochabamba y Santa Cruz), tal como las tiendas actuales.
- Combos pueden incluir productos ajenos al catálogo.
- Del prototipo de Fergie (Base44, incerpaz-build-pro.base44.app) se tomaron: ventana de ciudad, WhatsApp según la página y formulario en la portada. **No** se toman: precios visibles para todos, sellos de constructoras inventadas, cifras de empresa sin confirmar, su catálogo ni la plataforma Base44.
- La validación del mercado exportador está en pausa (siguiente paso: CSV de USITC DataWeb para la subpartida 6907.23.10).

---

## 11. Pendientes

**Nuevo pedido de Hugo (por planificar):**
Pedidos de la reunión de seguimiento (detalle y estado en `.ia/TAREAS.md`): comparador (hecho), productos nuevos, direcciones cortas por ciudad, transporte según producto y ubicación, seguimiento de la entrega, testimonios, más proyectos «Construye tú mismo», cursos reales y ficha técnica PAVIC.

**De otras áreas** (detalle en `site-src/CONTENIDO-PENDIENTE.md`):
- Sistemas: API, ambiente de pruebas y credenciales de Seasoft; códigos de producto por ciudad.
- Programador en jefe: registros DNS de incerpaz.com, decisión de alojamiento, operación del servidor.
- Legal: privacidad, términos de uso, bases de concursos y sorteos, texto de consentimiento.
- Marketing: primera campaña real, quién aprueba publicaciones, quién atiende contactos, fotos, datos de agencias.
- Técnicos: revisión de fórmulas, pasos y guías; aprobación de las descripciones de producto.
- Datos en conflicto: WhatsApp de agencia Central de Cochabamba y de Castillo; medidas distintas entre ciudades.

---

## 12. Propuesta: carpetas de comunicación entre Claude, ChatGPT, Claude Code y Codex

Cómo lee cada herramienta el proyecto:
- **Claude Code** lee automáticamente `CLAUDE.md` en la raíz del repositorio (y admite importar otros archivos con una línea `@ruta/archivo.md`).
- **Codex** lee automáticamente `AGENTS.md` en la raíz del repositorio.
- **Claude** y **ChatGPT** en el chat no leen el repositorio por sí solos: se les sube o pega el archivo de contexto (este documento) al iniciar.

Estructura sugerida:

```
/
├── AGENTS.md            reglas para Codex (y fuente única de reglas para todos)
├── CLAUDE.md            una línea: @AGENTS.md  (Claude Code usa las mismas reglas)
├── PROYECTO-INCERPAZ.md este documento: el contexto completo
└── .ia/                 comunicación entre asistentes
    ├── ESTADO.md        qué se hizo, qué está en curso, qué sigue (lo actualiza quien termina)
    ├── DECISIONES.md    decisiones tomadas, con fecha y quién decidió
    ├── TAREAS.md        tareas pendientes con responsable: claude-code | codex | chat | humano
    ├── traspasos/       un archivo por traspaso: AAAA-MM-DD-de-a-para-b-tema.md
    │                    (qué se pidió, qué se hizo, archivos tocados, pruebas, qué falta)
    └── revisiones/      revisiones de un asistente sobre el trabajo de otro
```

Reglas mínimas para `AGENTS.md`:
1. Leer `PROYECTO-INCERPAZ.md` y `.ia/ESTADO.md` antes de empezar.
2. Trabajar en una rama propia; nunca en la principal. No publicar, no desplegar y no hacer el corte del sitio actual.
3. No agregar dependencias de npm ni frameworks.
4. Editar `site-src/` y `site/assets/`; regenerar con `node site-src/build.js`; no editar a mano las páginas generadas.
5. Antes de entregar: 12 pruebas de API y 8 pruebas de navegador en verde.
6. Nunca poner claves, contraseñas o tokens en archivos del repositorio.
7. Al terminar: actualizar `.ia/ESTADO.md` y dejar un archivo en `.ia/traspasos/`.
8. Textos de la interfaz y mensajes de commit en español.
