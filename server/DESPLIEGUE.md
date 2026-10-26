# Publicar el servidor

El sitio con cuentas, precios y panel necesita un **servidor Node 22 con disco persistente** (guarda la base SQLite, el contenido editado y las imágenes subidas). Un hosting solo de archivos estáticos (como los "sites" de ChatGPT) sirve para el sitio público sin precios, pero no para login, pedidos ni panel.

Opciones con el `Dockerfile` de la raíz:
- **Render, Railway o Fly.io**: servicio web desde el repositorio, disco persistente montado en `/datos`, variables `ADMIN_PASSWORD` y, si quieres, `ADMIN_CORREO`.
- **Un VPS** (o un servidor de la empresa): `docker run -p 8080:8080 -v incerpaz-datos:/datos -e ADMIN_PASSWORD=... imagen`, con HTTPS por delante (Caddy o nginx).

Primer ingreso: entra a `/ingresar.html` con el correo de administrador y la clave de `ADMIN_PASSWORD` (o la que se imprimió en el registro del primer arranque) y abre `/admin.html`.

Copias de seguridad: guarda el volumen `/datos` (incerpaz.db y la carpeta contenido).

## Salida a producción (sitio público)

Antes de publicar, ejecuta `node tools/probar-publico.js`: revisa títulos, descripciones, canonical, enlaces rotos, imágenes, que no haya precios en el HTML, compresión, caché, redirecciones y que la política de seguridad no rompa nada.

Variables del servidor para producción:

| Variable | Valor | Para qué |
|---|---|---|
| `PUBLICO` | `1` | Indexable: sin noindex, con sitemap.xml y robots.txt abiertos (sin esto el sitio sigue interno) |
| `CANONICAL_HOST` | `www.incerpaz.com` | Redirige cualquier otro dominio (por ejemplo incerpaz.com) a este |
| `COOKIE_SECURE` | `1` | Cookies solo por https y cabecera HSTS |
| `TRUST_PROXY` | `1` | Detrás del proxy del hosting: toma la IP real y redirige http a https |
| `ADMIN_PASSWORD` | una clave larga | Clave del administrador al primer arranque |

Lista de verificación:
1. DNS: `www` apunta al servicio; el dominio sin www también (registro A, o ALIAS/ANAME si tu proveedor lo permite) para que se redirija a `www`.
2. No actives `SEMBRAR_DEMO` (no debe existir la cuenta de prueba).
3. Google Search Console: verifica el dominio y envía `https://www.incerpaz.com/sitemap.xml`.
4. Perfil de Negocio de Google para cada agencia, con la misma dirección y teléfono que muestra `donde-estamos.html`.
5. Redirecciones de las tiendas actuales (`cbba.tienda.incerpaz.com` y `scz.tienda.incerpaz.com`): `site-src/redirecciones-tiendas.csv` trae el origen y destino de cada producto, categoría y agencia. Configúralas en cada tienda (regla 301) cuando los pedidos en línea ya funcionen en el sitio nuevo, para conservar el posicionamiento.
6. Mide: decide si se instala Google Analytics u otra herramienta (no está instalada; hoy la fuente de datos son los contactos del panel).
