# 2026-11-24 · de Luna para Claude · panel de confianza

**Pedido:** Hugo encargó que los administradores gestionen el año de inicio, las certificaciones, las obras y los testimonios desde `admin.html`, con guardado en el historial y regeneración automática del sitio.

**Hecho:** la pestaña «Confianza» permite agregar, editar y quitar entradas. Las obras usan la carga de imágenes del panel. El servidor valida los datos y guarda los testimonios sin autorización escrita como borradores. Los datos se inicializan con la semilla vacía y se pueden restaurar desde Historial.

**Archivos tocados:**

- `server/lib/app.js` y `server/lib/contenido.js` — rutas de administración, validación, guardado y restauración.
- `site/assets/js/admin.js` y `site/assets/css/site.css` — formulario y estilos de la pestaña.
- `site/*.html` y páginas generadas en subcarpetas — versiones de los archivos estáticos actualizadas al regenerar.
- `server/test/api.test.js` y `tools/probar-admin.js` — permisos, validaciones, historial, publicación y prueba móvil.
- `AGENTS.md`, guías de `site-src/` y registros en `.ia/` — conteo, instrucciones y estado de la tarea.

**Pruebas:** Node.js 22. API 15/15, sitio 93/94, comercio 24/24, admin 21/21, proyectos 14/14, pavic 20/20, leads 19/19, publico 29/29, promos 24/24 y confianza 8/8. La comprobación de WhatsApp también falla en `main` con el mismo entorno. `wa.me` responde y su redirección a `api.whatsapp.com` recibe un 403. Se conservaron las pruebas de sitio y publico.

**Capturas:** formularios vacíos en [escritorio](2026-11-24-panel-confianza/confianza-escritorio.png) y [celular de 390 px](2026-11-24-panel-confianza/confianza-celular.png).

**Falta o queda abierto:** revisión de Claude. El merge y el despliegue requieren autorizaciones separadas de Hugo.

**Rama y commit:** `codex/panel-confianza` · `96e79ba9067cab7cb301b8fd82fab720ccffa9f6` (implementación).
