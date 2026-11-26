# 2026-11-24 · de Claude para Luna (Codex) · panel para cargar los datos de confianza

Decisión de Hugo (23-11-2026): las tareas nuevas del sitio las implementa Luna con ENCARGO y REPORTE. Este archivo es el ENCARGO. Hilo sugerido: `INCERPAZ · Luna · panel de confianza`.

```
ENCARGO · INCERPAZ (sitio) · panel de administración para los datos de confianza

Objetivo: que un administrador cargue y edite desde el panel (`admin.html`) el año de inicio, las
certificaciones, las obras y los testimonios del sitio, sin tocar archivos, y que al guardar el sitio se
regenere solo, como ya ocurre con productos y promociones.

Terminado cuando (todo verificable):
1. El panel tiene una pestaña nueva «Confianza» (solo para administradores, como «Agencias y contacto»; los ejecutivos no la ven) con
   cuatro bloques: Año de inicio, Certificaciones, Obras y Testimonios. Se puede agregar, editar y quitar
   cada elemento, y guardar.
2. API nueva, protegida con `requerirAdmin` (el mismo control de `PUT /api/admin/sitio`):
   - GET /api/admin/confianza devuelve { desde, certificaciones, obras, testimonios }.
   - PUT /api/admin/confianza guarda el objeto completo y regenera el sitio (usar el mismo `publicar()`).
3. Validaciones en el servidor (mensajes de error en español, como las demás; nunca confiar en el navegador):
   - desde: entero entre 1850 y el año actual, o null.
   - certificaciones (máx. 20): nombre obligatorio (≤120), detalle opcional (≤200), archivo opcional y,
     si viene, una dirección que empiece con https://.
   - obras (máx. 24): titulo obligatorio (≤100), ciudad obligatoria (≤40), anio opcional (entero 1950 a año
     actual + 1), superficie_m2 opcional (número > 0), pavic booleano, imagen obligatoria y válida según la
     misma regla de imágenes que ya usa `contenido.js` (carpeta `assets/img/subidas/` o `productos/`).
     Se reutiliza el botón y el endpoint de subir imágenes que ya existen en el panel de productos.
   - testimonios (máx. 12): nombre obligatorio (≤80), empresa y ciudad opcionales, texto obligatorio (≤400),
     autorizacion_escrita booleano. En el formulario, una casilla «Tengo autorización escrita de esta persona
     o empresa»; sin marcarla se puede guardar como borrador, pero NO se publica (el generador ya lo filtra).
4. El guardado conserva copia en `historial/` y se puede restaurar desde la pestaña de historial, como los
   demás archivos (hay que extender la regla de nombres de `restaurar`).
5. La carpeta de datos nueva se inicia con `confianza.json` vacío (copiarlo de `site-src/data/` junto a los otros
   tres archivos). No se agregan datos de ejemplo ni al repositorio ni a la semilla.
6. Pruebas nuevas que pasan:
   - `server/test/api.test.js`: sin sesión → 401; cliente o ejecutivo → 403 (los ejecutivos tampoco ven la pestaña); administrador guarda; cada
     validación rechaza lo inválido; el historial guarda copia; tras guardar un testimonio con autorización
     la página de inicio generada lo incluye, y uno sin autorización no. Actualizar el conteo de pruebas
     que menciona `AGENTS.md`.
   - `tools/probar-admin.js`: la pestaña carga; agregar una obra con imagen y un testimonio autorizado los
     muestra en `index.html`; un testimonio sin casilla marcada no aparece; en celular (390 px) no hay
     desborde horizontal.
7. Todas las pruebas del proyecto en verde (lista en `AGENTS.md`, «Antes de entregar»), incluida
   `tools/probar-confianza.js`. Capturas de la pestaña en escritorio y celular en el PR.

Archivos permitidos:
- `server/lib/contenido.js`, `server/lib/app.js` (solo las rutas nuevas y la regla de `restaurar`)
- `site/assets/js/admin.js`, `site/assets/css/site.css` (estilos de la pestaña nueva)
- `server/test/api.test.js`, `tools/probar-admin.js`
- `site-src/GUIA-FOTOS.md` y `site-src/CONTENIDO-PENDIENTE.md` (decir que ahora se carga desde el panel)
- `AGENTS.md` (solo el conteo de pruebas), `.ia/ESTADO.md`, `.ia/TAREAS.md`, `.ia/DECISIONES.md`, `.ia/traspasos/`
- páginas generadas en `site/` (resultado de correr `node site-src/build.js`; no se editan a mano)

Prohibido tocar:
- La lógica de dibujo de las secciones en `site-src/build.js` (`seccionPruebas`, `franjaConfianza`): ya está
  hecha y probada. Si encuentras un error, repórtalo en lugar de arreglarlo por tu cuenta.
- Autenticación, sesiones, roles, precios, ERP, cuentas, pedidos, contactos.
- `.github/workflows/`, `ine-mensual/`, `gaceta-anual/` y el juego (`js/`, `style.css`, `levels.js`).
- Dependencias de npm o frameworks (solo Node.js 22 y el navegador).
- Claves, contraseñas o datos personales en cualquier archivo.

Riesgo: medio. Escribe contenido publicado desde el panel y exige control de acceso. No cambia la
autenticación ni borra datos. Claude revisa el PR antes de pedir el merge.

Contexto (solo lo indispensable):
- Las secciones del sitio ya existen y se alimentan de `confianza.json` (lee primero la carpeta de datos del
  servidor, `CONTENT_DIR`, y si no está, `site-src/data/confianza.json`). Con listas vacías no se muestra
  nada. Los testimonios solo salen con autorizacion_escrita en true; las obras exigen titulo, ciudad e imagen.
- Patrón a imitar: la pestaña «Agencias y contacto» y la ruta `PUT /api/admin/sitio` (permiso de administrador),
  y para listas con imágenes la pestaña «Promociones» (`vistaPromos` en `admin.js`, `leerPromos`/`escribir`
  en `contenido.js`, `publicar()` en `app.js`). Mismo estilo de formularios y de avisos en español.
- No inventes datos: nada de obras, certificados, años ni testimonios de ejemplo fuera de los temporales
  de las pruebas.
- Textos de la interfaz, documentación y commits en español, sin jerga. El sitio es preliminar e interno: no
  se publica ni se despliega.
- PR contra `main` (los PR #14 y #15 del sitio fueron ahí). Una rama `codex/...` y un PR para esta tarea.
  Máximo dos rondas de corrección; en la tercera se escala a Hugo.
- Merge y deploy los autoriza Hugo, por separado. Merge no es deploy.
```

## REPORTE esperado (Luna → Claude)

```
REPORTE · INCERPAZ (sitio) · panel de administración para los datos de confianza
Rama, PR y SHA:
Checks: API (n de n), sitio, comercio, admin, proyectos, pavic, leads, publico, promos, confianza: cada uno con ✓ o ✗
Cambios: lista breve
Desviaciones del ENCARGO: ninguna | cuáles y por qué
Pendientes o dudas:
```

## Notas para Hugo
- El protocolo común dice que los PR van contra la rama por defecto del repositorio (`claude/gracious-wright-mkglyk`), pero el trabajo del sitio se ha fusionado en `main`. Este ENCARGO pide `main`; si prefieres la otra, se cambia esa línea antes de enviarlo.
- No hay CLI `codex` en esta sesión: el ENCARGO se envía con `codex queue --thread "INCERPAZ · Luna · panel de confianza" --message "<texto del bloque>"`, o se pega en el hilo de Luna.
