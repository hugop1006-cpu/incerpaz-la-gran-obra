# Publicar el servidor

El sitio con cuentas, precios y panel necesita un **servidor Node 22 con disco persistente** (guarda la base SQLite, el contenido editado y las imágenes subidas). Un hosting solo de archivos estáticos (como los "sites" de ChatGPT) sirve para el sitio público sin precios, pero no para login, pedidos ni panel.

Opciones con el `Dockerfile` de la raíz:
- **Render, Railway o Fly.io**: servicio web desde el repositorio, disco persistente montado en `/datos`, variables `ADMIN_PASSWORD` y, si quieres, `ADMIN_CORREO`.
- **Un VPS** (o un servidor de la empresa): `docker run -p 8080:8080 -v incerpaz-datos:/datos -e ADMIN_PASSWORD=... imagen`, con HTTPS por delante (Caddy o nginx).

Primer ingreso: entra a `/ingresar.html` con el correo de administrador y la clave de `ADMIN_PASSWORD` (o la que se imprimió en el registro del primer arranque) y abre `/admin.html`.

Copias de seguridad: guarda el volumen `/datos` (incerpaz.db y la carpeta contenido).
