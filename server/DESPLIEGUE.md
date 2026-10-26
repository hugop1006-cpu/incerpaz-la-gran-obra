# Publicar INCERPAZ

El sitio con cuentas, precios, pedidos y panel necesita un **servidor con Node 22 y un disco persistente**: ahí viven la base SQLite, el contenido que editas desde el panel y las imágenes que subes. Un hosting solo de archivos estáticos (como los "sites" de ChatGPT) sirve para el sitio sin precios, pero no para ingreso, pedidos, contactos ni panel.

Hay dos caminos preparados en el repositorio. Los dos usan el mismo `Dockerfile`. **El camino elegido es Render con Cloudflare delante.**

> **Importante:** el servidor funciona con **una sola instancia** (SQLite). No actives varias copias ni escalado automático.

---

## Camino A · Render + Cloudflare (el elegido)

Render ejecuta el servidor y guarda los datos; **Cloudflare va delante**: administra el DNS, pone el https, filtra ataques y cachea las imágenes, el CSS y los scripts. Necesitas una cuenta de Render con plan de pago (el disco persistente no existe en el gratuito) y una cuenta de Cloudflare (el plan gratuito alcanza).

### Fase 1 · Render solo (pruebas)
1. En Render: **New → Blueprint** y elige el repositorio. Render lee `render.yaml` y propone el servicio `incerpaz` con un disco de 2 GB en `/datos`.
2. Confirma. El primer despliegue tarda unos minutos.
3. Abre el servicio → **Environment** y copia el valor de `ADMIN_PASSWORD` (Render lo generó). Es la clave inicial de **hugop1006@gmail.com**.
4. Entra a `https://incerpaz-xxxx.onrender.com/ingresar.html` y luego a `/admin.html`. Revisa el sitio completo en esta dirección: queda sin indexar (`PUBLICO=0`).

**Actualizaciones:** cada `git push` a la rama conectada se despliega solo. La base y lo que edites en el panel viven en el disco y no se pierden.

### Fase 2 · Cloudflare delante

> ⚠️ **Antes de cambiar el DNS:** `incerpaz.com` ya tiene servicios en marcha (correo como `ventas.cbba@incerpaz.com`, el ERP en `seasoft.incerpaz.com`, `estructural`, las tiendas `cbba.tienda`, `scz.tienda`, `or.tienda`, `tj.tienda`, `prospeccion`, `exportaciones`…). Al pasar el dominio a Cloudflare **hay que copiar todos esos registros**, o se cae el correo y los sistemas. Pide al responsable de TI la lista actual de registros DNS.

1. En Cloudflare: **Add a site** → `incerpaz.com` → plan Free. Cloudflare detecta los registros actuales: **compáralos uno por uno con la lista de TI** y agrega los que falten.
2. Los registros de **correo** (MX, `mail`, `imap`, `smtp`, SPF/DKIM en TXT) y los de **sistemas internos** (`seasoft`, `estructural`) déjalos en **nube gris** (solo DNS). Las tiendas WordPress pueden quedar en nube naranja si quieres filtro y caché.
3. Cuando todo esté copiado, cambia los *nameservers* del dominio en tu registrador a los dos que indica Cloudflare. Puede tardar hasta 24 horas.
4. En Render → servicio → **Settings → Custom Domains**: agrega `www.incerpaz.com`. Render muestra el destino (`incerpaz-xxxx.onrender.com`).
5. En Cloudflare → **DNS**: crea `CNAME www → incerpaz-xxxx.onrender.com` con **nube naranja**. Si Render no logra verificar el dominio, pon la nube en gris unos minutos, deja que Render emita su certificado y vuelve a activarla.
6. **SSL/TLS** → modo **Full (strict)**. En *Edge Certificates* activa **Always Use HTTPS** y TLS mínimo 1.2.
7. **Candado de origen** (para que nadie entre directo a la dirección de Render y se salte la protección):
   - Elige un valor largo al azar (30 caracteres o más).
   - Cloudflare → **Rules → Transform Rules → Modify Request Header**: agrega el encabezado `X-Origen-Secreto` con ese valor, para todas las solicitudes a `www.incerpaz.com`.
   - Render → **Environment**: agrega `ORIGEN_SECRETO` con el mismo valor y guarda.
   - Comprueba: `https://www.incerpaz.com` abre normal y `https://incerpaz-xxxx.onrender.com` responde *Acceso no autorizado* (la verificación de salud sigue abierta).
8. **Ajustes de Cloudflare que conviene dejar así** (si no, rompen cosas):
   - *Speed → Optimization*: desactiva **Rocket Loader** y el minificado automático.
   - *Scrape Shield*: desactiva **Email Address Obfuscation** (reescribe los correos y choca con la política de seguridad).
   - **No** uses reglas de "Cache Everything" sobre el HTML ni sobre `/api/`: las páginas y los datos personales no deben cachearse.
   - *Security → WAF → Rate limiting*: una regla que limite `/api/` a unas 20 solicitudes por minuto por IP (el servidor ya limita ingresos y formularios por su cuenta).
9. **Medición gratuita (opcional):** activa *Web Analytics* para el sitio. Después, en Render → Environment: `CSP_SCRIPT_EXTRA=https://static.cloudflareinsights.com` y `CSP_CONNECT_EXTRA=https://cloudflareinsights.com`. No usa cookies; aun así, actualiza el texto de `privacidad.html`, que hoy dice que no hay herramientas de medición.

**Cómo se comporta con Cloudflare delante**
- El servidor toma la IP real del visitante de `CF-Connecting-IP` (variable `CLOUDFLARE=1`, ya incluida), no de `X-Forwarded-For`, que se puede falsear.
- El HTML no se cachea; el CSS y los scripts llevan `?v=hash`, así que al desplegar no hace falta purgar nada. Si cambias una imagen conservando el nombre, purga ese archivo en *Caching → Purge*.

### Fase 3 · Salida pública (el día del corte)
1. En Render → Environment: `CANONICAL_HOST=www.incerpaz.com` y `PUBLICO=1`. Guarda: el servicio se reinicia e indexa.
2. **Dominio sin www:** en Cloudflare, crea un registro `A` de `incerpaz.com` (valor `192.0.2.1`, nube naranja) y una *Redirect Rule*: si el nombre de host es `incerpaz.com`, redirigir (301, dinámico) a `concat("https://www.incerpaz.com", http.request.uri)`. **Este paso reemplaza la página actual de `incerpaz.com`**, así que hazlo el día del corte.
3. Sigue la lista de *Salida pública* más abajo (Search Console, perfiles de Google, redirecciones de las tiendas, cuentas reales). Para las tiendas puedes usar *Rules → Redirect Rules* o *Bulk Redirects* con `site-src/redirecciones-tiendas.csv`.

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
| `CANONICAL_HOST` | `www.incerpaz.com` | Redirige cualquier otro dominio a este (agrégala el día del corte, no antes: bloquearía las pruebas en la dirección de Render) |
| `CLOUDFLARE` | `1` | Toma la IP real de `CF-Connecting-IP` |
| `ORIGEN_SECRETO` | valor largo | Candado: solo se atiende lo que Cloudflare marca con `X-Origen-Secreto` |
| `CSP_SCRIPT_EXTRA`, `CSP_CONNECT_EXTRA` | hosts | Permite una herramienta de medición (Cloudflare Web Analytics) |
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

## Lista de verificación de la salida pública

Antes: ejecuta `node tools/probar-publico.js` en tu computador. Revisa SEO, enlaces, que no haya precios en el HTML, compresión, caché, redirecciones y la política de seguridad.

El día del corte (con `PUBLICO=1` y `CANONICAL_HOST` ya puestos, ver Fase 3):
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
