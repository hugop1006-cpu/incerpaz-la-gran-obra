# Publicar la versión web (PWA) de Personal T

La versión web es la misma app, instalable desde el navegador (iPhone y Android), con modo sin conexión, cámara y copias de seguridad. Es **estática**: no hay servidor de Personal T ni datos en el sitio; cada dispositivo guarda sus propios datos.

## 1. Generar el paquete
```
npm install
npm run build:pwa      # crea dist-web/ (app + service worker + cabeceras de seguridad _headers)
```
Si ya generaste las páginas legales (`node scripts/build-site.mjs`, ver `STORES.md`), `build:pwa` las incluye en el mismo sitio (`/privacy.html`, `/delete-account.html`). Luego pon la dirección del sitio en `LEGAL_BASE` de `data.js` y vuelve a generar.

## 2. Subirlo (elige una opción; los detalles de las pantallas pueden cambiar: confírmalos en cada servicio)
- **Cloudflare Pages (recomendada, gratis y permanente):** en el panel, *Workers & Pages → Create → Pages → Direct Upload (arrastrar y soltar)*, pon un nombre de proyecto y arrastra el **contenido** de `dist-web/` (o el zip). Tu sitio quedará en `https://<proyecto>.pages.dev`. Límites de la subida por arrastre: 1.000 archivos y 25 MiB (el paquete son ~11 archivos y ~140 KB). Un proyecto creado así no puede pasarse después a integración con Git.
- **Netlify Drop (alternativa):** arrastra la carpeta a la página de Drop. Puedes subir sin cuenta, pero **reclama el sitio de inmediato con una cuenta gratuita**: los sitios sin reclamar se borran (las fuentes no coinciden en el plazo; puede ser ~1 hora).
- **GitHub Pages:** exige repositorio público en el plan gratuito.

Las dos primeras leen el archivo `_headers` (no se sirve como página) y aplican la política de seguridad incluida.

## 3. Instalarla en el teléfono
- **iPhone (Safari):** abre la dirección → botón *Compartir* → *Añadir a pantalla de inicio*. **Úsala desde ese ícono**: Safari puede borrar los datos de sitios web que no se abren en una semana, pero no los de una app instalada en la pantalla de inicio.
- **Android (Chrome):** menú ⋮ → *Instalar app* / *Añadir a pantalla de inicio*.
- El navegador y el ícono instalado guardan datos **por separado**: elige uno y quédate con él.

## Qué cambia respecto a la app de Android/iOS
| | Versión web (PWA) | App instalada (Capacitor) |
|---|---|---|
| Aviso de descanso con la pantalla apagada | **No** (solo sonido y vibración con la app abierta; las notificaciones programadas con la app cerrada exigen un servidor) | Sí (notificación local) |
| Sin conexión | Sí (service worker) | Sí |
| Cámara, galería, copias | Sí | Sí |
| Datos | Almacenamiento del navegador | Almacenamiento de la app |

## Importante
- **Cualquiera con el enlace puede abrir la app** (es una app, sin datos tuyos dentro). Tus datos solo están en tu dispositivo.
- **Guarda copias** (Ajustes → Guardar copia): si borras los datos del navegador, se pierden.
- **Actualizar:** sube el paquete nuevo (`npm run build:pwa`). El service worker busca la versión nueva al abrir la app con conexión.
- La política de seguridad solo permite conectar con `*.supabase.co` y `*.supabase.in` (la nube opcional). Si usas otro servicio, hay que cambiar `scripts/pwa-headers.txt`.
