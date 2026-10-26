# Publicar INCERPAZ

El sitio con cuentas, precios, pedidos y panel necesita un **servidor con Node 22 y un disco persistente**: ahí viven la base SQLite, el contenido que editas desde el panel y las imágenes que subes. Un hosting solo de archivos estáticos (como los "sites" de ChatGPT) sirve para el sitio sin precios, pero no para ingreso, pedidos, contactos ni panel.

Hay dos caminos preparados en el repositorio. Los dos usan el mismo `Dockerfile`.

> **Importante:** el servidor funciona con **una sola instancia** (SQLite). No actives varias copias ni escalado automático.

---

## Camino A · Render (recomendado para empezar)

Necesitas una cuenta en Render y un plan de pago (el disco persistente no existe en el plan gratuito).

1. En Render: **New → Blueprint** y elige el repositorio. Render lee `render.yaml` y propone el servicio `incerpaz` con un disco de 2 GB en `/datos`.
2. Confirma. El primer despliegue tarda unos minutos.
3. Abre el servicio → **Environment** y copia el valor de `ADMIN_PASSWORD` (Render lo generó). Esa es la clave inicial de **hugop1006@gmail.com**.
4. Abre la dirección `https://incerpaz-xxxx.onrender.com`, entra en `/ingresar.html` y luego en `/admin.html`. Cambia la clave creando tu cuenta definitiva en Equipo si lo prefieres.
5. En **Settings → Custom Domains** agrega `www.incerpaz.com` y el dominio sin www, y crea en tu proveedor de DNS los registros que Render indica. Render emite el certificado https solo.
6. El servicio queda con `PUBLICO=0`: no se indexa en Google. Mira la sección *Salida pública* más abajo para el día del corte.

**Actualizaciones:** cada `git push` a la rama conectada se despliega solo (`autoDeploy`). El contenido que editaste en el panel y la base **no se pierden**: están en el disco.

---

## Camino B · Servidor propio (VPS o servidor de la empresa)

Requisitos: un Linux con Docker y Docker Compose, y los puertos 80 y 443 abiertos.

```bash
git clone <repositorio> incerpaz && cd incerpaz
git checkout <rama>
cp .env.ejemplo .env      # edita DOMINIO, ADMIN_PASSWORD, etc.
docker compose up -d --build
docker compose logs -f app
```

- `Caddy` obtiene y renueva el certificado https solo y redirige `incerpaz.com` a `www.incerpaz.com`. El DNS de ambos nombres debe apuntar a la IP del servidor.
- Los datos viven en el volumen `datos`.
- **Actualizar:** `git pull && docker compose up -d --build`.
- **Ver el estado:** `docker compose ps` (el servicio `app` debe quedar *healthy*).

---

## Variables de entorno

| Variable | Valor típico | Para qué |
|---|---|---|
| `ADMIN_PASSWORD` | clave larga | Clave del administrador inicial (se crea una sola vez). Sin ella se genera una al azar y se imprime en el registro |
| `ADMIN_CORREO` / `ADMIN_NOMBRE` | hugop1006@gmail.com / Hugo | Cuenta del administrador inicial |
| `PUBLICO` | `0` o `1` | `1` = indexable (sitemap y robots abiertos) |
| `CANONICAL_HOST` | `www.incerpaz.com` | Redirige cualquier otro dominio a este |
| `COOKIE_SECURE` | `1` | Cookies solo por https y cabecera HSTS |
| `TRUST_PROXY` | `1` | Detrás del proxy del hosting: IP real y redirección de http a https |
| `RESPALDO_DIARIO` | `1` | Respaldo diario en `/datos/respaldos` |
| `RESPALDOS_MAX` | `14` | Cuántos respaldos se conservan |
| `DB_PATH`, `CONTENT_DIR` | `/datos/...` | Ya vienen definidos en el `Dockerfile` |
| `SEMBRAR_DEMO` | no definir | Crea una cuenta de prueba. **No la actives en producción** |
| `ERP_ADAPTER` | `local` | `seasoft` cuando exista la conexión al ERP (ver `server/ERP.md`) |

La lista completa está en `server/README.md`.

---

## Respaldos

1. **Automático:** con `RESPALDO_DIARIO=1` el servidor guarda cada día en `/datos/respaldos/AAAAMMDD-HHMM/` una copia consistente de la base y del contenido (productos, agencias e imágenes). Protege de errores y de cambios malos, pero está en el mismo disco.
2. **Manual desde el panel:** `admin.html` → **Historial** → *Descargar copia de la base*. Guárdala fuera del servidor (contiene datos personales: trátala con cuidado).
3. **Recomendado:** descarga una copia al menos una vez por semana y antes de cada cambio grande. Si usas Render con disco, activa también los *snapshots* del disco.

Respaldo inmediato por consola: `docker compose exec app node server/respaldo.js` (o en Render, desde **Shell**: `node server/respaldo.js`).

### Restaurar

1. Detén el servicio (Render: *Suspend*; Docker: `docker compose stop app`).
2. Copia el respaldo elegido sobre los datos: `incerpaz.db` a `/datos/incerpaz.db` y la carpeta `contenido` a `/datos/contenido`. Borra antes los archivos `incerpaz.db-wal` y `incerpaz.db-shm` si existen.
3. Inicia el servicio y revisa que ingresas al panel y ves los productos.

---

## Salida pública (el día del corte)

Antes: ejecuta `node tools/probar-publico.js` en tu computador o en el servidor de pruebas. Revisa SEO, enlaces, que no haya precios en el HTML, compresión, caché, redirecciones y la política de seguridad.

El día del corte:
1. Confirma el dominio principal en `CANONICAL_HOST=www.incerpaz.com` y que el DNS de `www` y del dominio sin www apuntan al servicio.
2. Cambia `PUBLICO` a `1` y reinicia: el sitio se genera indexable y publica `sitemap.xml`.
3. Comprueba `https://www.incerpaz.com/robots.txt` y `/sitemap.xml`.
4. Verifica el dominio en **Google Search Console** y envía el sitemap.
5. Crea o reclama el **Perfil de Negocio de Google** de cada agencia, con la misma dirección y teléfono que muestra `donde-estamos.html`.
6. Aplica las redirecciones 301 de las tiendas actuales (`cbba.tienda.incerpaz.com`, `scz.tienda.incerpaz.com`) usando `site-src/redirecciones-tiendas.csv`, cuando los pedidos en línea ya funcionen en el sitio nuevo.
7. Verifica que **no** exista la cuenta de prueba (`ejecutivo.prueba@incerpaz.test`) y crea las cuentas reales de los ejecutivos desde `admin.html` → Equipo.

Para volver a modo interno (sin indexar), pon `PUBLICO=0` y reinicia.

---

## Si algo falla

- **El servicio no arranca / no pasa el health check:** revisa el registro. `/api/salud` responde 503 si la base no abre o si el sitio no se generó.
- **No puedo ingresar:** si definiste `COOKIE_SECURE=1`, entra siempre por `https://`; por http el navegador descarta la cookie.
- **"Demasiados intentos":** los ingresos y formularios tienen límite por IP; espera unos minutos.
- **Perdí la clave del administrador:** `node server/crear-admin.js correo clave "Nombre" cochabamba admin` desde la consola del servicio.
- **No se ve un cambio del panel:** el panel regenera las páginas al guardar; fuerza la recarga del navegador (Ctrl+F5).
