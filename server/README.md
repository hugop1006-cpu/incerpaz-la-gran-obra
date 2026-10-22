# Servidor de comercio INCERPAZ

Node 22+ sin dependencias (`http` + `node:sqlite`). Sirve el sitio estático de `site/` y la API `/api/*`.

## Ejecutar
    node site-src/build.js        # genera site/ y server/data/catalogo.json
    node server/index.js          # http://localhost:3000

## Variables de entorno
| Variable | Por defecto | Uso |
|---|---|---|
| PORT / HOST | 3000 / 0.0.0.0 | Dirección de escucha |
| DB_PATH | server/data/incerpaz.db | Base SQLite |
| ERP_ADAPTER | local | `local` (precios y pedidos en este servidor, editables desde el panel), `mock` (precios ficticios) o `seasoft` |
| CONTENT_DIR | server/data/contenido | Contenido editable (productos, agencias…), imágenes subidas e historial |
| ADMIN_CORREO / ADMIN_NOMBRE / ADMIN_PASSWORD | hugop1006@gmail.com / Hugo / (al azar) | Administrador inicial; sin ADMIN_PASSWORD se genera una clave y se imprime una sola vez en el registro |
| SEMBRAR_DEMO | — | `1` crea la cuenta de prueba ejecutivo.prueba@incerpaz.test (clave Prueba-Incerpaz-2026 o DEMO_PASSWORD). No la actives en producción |
| SEASOFT_URL / SEASOFT_TOKEN | — | Acceso al ERP (ver ERP.md) |
| COOKIE_SECURE | 0 | `1` detrás de HTTPS |
| TRUST_PROXY | 0 | `1` si hay proxy inverso (IP real para límites) |
| TARIFAS_PATH | server/data/tarifas.ejemplo.json | Solo para ERP_ADAPTER=mock |
| SYNC_MS | 300000 | Intervalo de sincronización de estados con el ERP |

## Cuentas internas
    node server/crear-admin.js correo contraseña "Nombre" [ciudad] [admin|ejecutivo]

Los clientes se registran en `registro.html`; un ejecutivo de su ciudad los verifica en `equipo.html`. Solo cuentas verificadas reciben precios (`/api/precios`).

## Seguridad
Contraseñas con scrypt, sesiones por cookie HttpOnly, cabecera anti-CSRF, límite de intentos. Los precios nunca están en el HTML estático.

## Panel de administración (`/admin.html`, solo rol admin)
Productos (editar, crear, borrar, imágenes), precios por ciudad y lista (con carga por CSV), agencias, teléfonos, WhatsApp y redes, cuentas del equipo e historial con restauración. Cada guardado regenera el sitio (`site-src/build.js` con CONTENT_DIR) y conserva la versión anterior.

## Precios
Con `ERP_ADAPTER=local` los precios viven en la tabla `precios`. La primera vez se cargan los publicados en las tiendas actuales (`server/data/precios-publicados.json`, lista general; Cochabamba es precio puesto en obra dentro del radio urbano). La lista "constructor" usa el precio general mientras no tenga uno propio.

## Despliegue
Ver `server/DESPLIEGUE.md`.

## Pruebas
    node --test server/test/api.test.js
    NODE_PATH=/opt/node22/lib/node_modules node tools/probar-comercio.js
