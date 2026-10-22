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
| ERP_ADAPTER | mock | `mock` o `seasoft` |
| SEASOFT_URL / SEASOFT_TOKEN | — | Acceso al ERP (ver ERP.md) |
| COOKIE_SECURE | 0 | `1` detrás de HTTPS |
| TRUST_PROXY | 0 | `1` si hay proxy inverso (IP real para límites) |
| TARIFAS_PATH | server/data/tarifas.ejemplo.json | Tarifas por producto y lista (general/constructor) |
| SYNC_MS | 300000 | Intervalo de sincronización de estados con el ERP |

## Cuentas internas
    node server/crear-admin.js correo contraseña "Nombre" [ciudad] [admin|ejecutivo]

Los clientes se registran en `registro.html`; un ejecutivo de su ciudad los verifica en `equipo.html`. Solo cuentas verificadas reciben precios (`/api/precios`).

## Seguridad
Contraseñas con scrypt, sesiones por cookie HttpOnly, cabecera anti-CSRF, límite de intentos. Los precios nunca están en el HTML estático.

## Tarifas
`tarifas.ejemplo.json` contiene precios **ficticios** (0,60 Bs/kg). Reemplazar con las tarifas reales por ciudad antes de operar.

## Pruebas
    node --test server/test/api.test.js
    NODE_PATH=/opt/node22/lib/node_modules node tools/probar-comercio.js
