# Publicar Personal T en Google Play y App Store

## Decisiones tomadas
- **Nombre:** Personal T. **Cuenta de desarrollador:** individual (tu nombre legal aparece como vendedor).
- **Empaquetado:** Capacitor (la app va dentro del paquete y funciona sin conexión; la PWA sigue existiendo).
- **Identificador (`appId`): `app.personalt.trainer`.** ⚠️ **Es permanente**: una vez subida la primera versión a una tienda no se puede cambiar. Confírmalo o cámbialo en `capacitor.config.json`, `android/app/build.gradle` (applicationId/namespace) y el proyecto iOS **antes** de subir nada.
- **iPhone sin Mac:** Codemagic (`codemagic.yaml`). Android: GitHub Actions (`.github/workflows/android.yml`) o Android Studio.

## Estado verificado y pendiente
| Verificado en el entorno de desarrollo | Sin verificar |
|---|---|
| APK de depuración compila y contiene la app (nombre, paquete, ícono; permisos: Internet, notificaciones y WAKE_LOCK) | Ejecutar la app en un teléfono Android o iPhone reales |
| AAB de release firmado con un keystore de prueba (versión y firma por variables de entorno) | Compilar iOS (necesita macOS: Codemagic) |
| Proyecto iOS generado con permiso de cámara, íconos, pantalla de inicio y marca de cifrado exento | Los flujos de CI (no se han ejecutado) |
| Borrado de cuenta dentro de la app (probado con un servidor simulado) | La aprobación de las tiendas |

## Android (Google Play)
1. Cuenta de Play Console (pago único; verifica el importe vigente). **Cuenta personal creada después del 13-nov-2023: prueba cerrada con ≥12 testers durante 14 días seguidos** antes de pedir producción.
2. Crea tu keystore (guárdalo y su contraseña en un lugar seguro; si lo pierdes no podrás firmar actualizaciones con esa clave):
   `keytool -genkeypair -keystore personal-t.jks -alias personal-t -keyalg RSA -keysize 2048 -validity 10000`
3. Activa **Play App Signing** al subir el primer AAB. Compila: `npm run sync` y `cd android && ANDROID_KEYSTORE_PATH=… ANDROID_KEYSTORE_PASSWORD=… ANDROID_KEY_ALIAS=… ANDROID_KEY_PASSWORD=… VERSION_CODE=1 ./gradlew bundleRelease` (necesita Android SDK 36 y JDK 21).
4. Ficha de la tienda: descripción, capturas, política de privacidad (URL pública), formulario **Data safety**, y la **URL web para solicitar el borrado de cuenta** (Google la exige además del borrado dentro de la app).
5. Cada actualización: sube `VERSION_CODE` (siempre mayor que el anterior).

## iOS (App Store)
1. Apple Developer Program individual (99 USD/año; verifica en developer.apple.com/programs/enroll).
2. En developer.apple.com registra el **Bundle ID** `app.personalt.trainer`. En App Store Connect crea la app.
3. Crea una clave de API de App Store Connect y añádela a Codemagic como integración llamada `Personal T`.
4. Lanza el flujo `ios` de `codemagic.yaml`: compila y sube a TestFlight. Prueba con TestFlight antes de enviar a revisión.
5. **App Privacy** (etiquetas de privacidad): declara los datos que realmente usa la app (ver política). En las notas de revisión explica que la nube es opcional y cómo eliminar la cuenta (Ajustes → Nube → Eliminar mi cuenta).
6. Riesgo conocido: la regla 4.2 rechaza apps que son solo una web. La app incluye funciones nativas reales: cámara, compartir copias y aviso de descanso con la pantalla apagada (notificación local).

## Sitio de política y borrado de cuenta
1. `cp site/config.example.json site/config.json` y pon **tu nombre legal** y un **correo de contacto** (se publicarán). Sin ellos, el script se niega a generar el sitio.
2. `node scripts/build-site.mjs` genera `site/dist/` (3 páginas bilingües ES/EN, sin peticiones externas).
3. Publica `site/dist/` en un hosting estático **público** (Cloudflare Pages o GitHub Pages: ambos tienen plan gratuito; GitHub Pages en repositorios privados exige un plan de pago).
4. Pon esa dirección (https, sin barra final) en `LEGAL_BASE` de `data.js` para que la app enlace a las páginas desde Ajustes → «Privacidad y datos».
5. Usa `…/privacy.html` como URL de política en ambas tiendas y `…/delete-account.html` como URL de borrado en Google Play (Data safety).
6. Respuestas de los formularios de privacidad: ver `STORE-PRIVACY.md`. **Antes de publicar, que te revise la política alguien con criterio legal**: está redactada según lo que hace la app, pero no es asesoría jurídica.
7. Si cambias lo que la app hace con los datos (por ejemplo, un servicio de nube propio), actualiza la política **antes**.

## Aviso de descanso (notificación local)
- Android: el aviso es **no exacto** (`setAndAllowWhileIdle`): puede retrasarse unos segundos, y más si el teléfono está en ahorro profundo de batería. Se evitó a propósito el permiso de alarmas exactas (Google Play lo restringe). Se quitaron `SCHEDULE_EXACT_ALARM` y `RECEIVE_BOOT_COMPLETED` del manifiesto.
- El texto del aviso es genérico («Descanso terminado») para no mostrar datos en la pantalla de bloqueo.
- Si el usuario deniega las notificaciones, la app avisa una vez y sigue con sonido y vibración con la app abierta.
- **Sin probar en dispositivo real:** la lógica está probada con un plugin simulado y un reloj falso; la entrega real con la pantalla apagada (Android e iOS) hay que comprobarla en un teléfono.

## Ruta de publicación, en orden

Leyenda: 👤 lo haces tú · 🤖 puedo hacerlo yo · ⏱ tiempo de espera · 💲 costo

### Fase 0 — Decisiones (hoy, sin costo)
- 👤 **`appId` definitivo** (`app.personalt.trainer` o el que prefieras). Es permanente tras la primera subida.
- 👤 **Nube para el público general:** publicar con la nube como función avanzada «trae tu propio Supabase» (recomendado para la v1) o montar un servicio propio (cambia política, costos y obligaciones). Ver `STORE-PRIVACY.md`.
- 👤 **Nombre «Personal T»:** buscarlo en App Store, Google Play y en el registro de marcas de tu país.

### Fase 1 — Probar lo que aún no se ha probado (esta semana, sin costo)
- 👤 Instalar el APK de prueba en un Android: cámara, compartir copia, uso sin conexión, **aviso de descanso con la pantalla apagada**, crear/restaurar copia.
- 👤 **Probar la nube contra un Supabase real** (`supabase/SETUP.md`): hasta ahora solo se ha probado con un servidor simulado. Incluye crear cuenta, sincronizar con dos dispositivos y «Eliminar mi cuenta».
- 🤖 Corregir lo que encuentres (envíame los mensajes de error y el modelo de teléfono).

### Fase 2 — Repositorio propio y sitio legal (esta semana, sin costo)
- 👤 Crear un repositorio **privado** nuevo (p. ej. `personal-t`) en GitHub. Las compilaciones en la nube necesitan que `.github/` y `codemagic.yaml` estén en la raíz del repositorio. Para llevarte la carpeta con su historial (desde el repositorio actual):
  `git subtree split -P pert-personal-trainer -b personal-t-solo` y luego `git push <URL-del-repo-nuevo> personal-t-solo:main`
- 👤 Poner tu **nombre legal y correo de contacto** en `site/config.json`, generar `site/dist/` y publicarlo (Cloudflare Pages o GitHub Pages). Poner la dirección en `LEGAL_BASE` (`data.js`).
- 👤 **Revisión legal** de la política por alguien con criterio jurídico.
- 🤖 Actualizar la política si cambias algo (nube, permisos).

### Fase 3 — Material de la ficha (en paralelo)
- 🤖 Redactar descripción corta/larga, palabras clave y notas de versión (ES/EN).
- 🤖 Generar **capturas de pantalla** para móvil con datos de ejemplo (nunca tus datos reales).
- 👤 Elegir categoría (Salud y bienestar / Fitness), clasificación por edades y declaraciones (anuncios: no; acceso: sin cuenta obligatoria).

### Fase 4 — Android primero (el reloj de 14 días)
- 👤 💲 Cuenta de Google Play Console (pago único; verifica el importe vigente). ⏱ Verificación de identidad.
- 👤 Crear el **keystore** y **guardarlo con copia fuera de línea** (si se pierde, no podrás firmar actualizaciones con esa clave). Subir los secretos al CI.
- 👤 Subir el primer AAB a **prueba cerrada** con **≥12 testers durante 14 días seguidos** (cuenta personal creada después del 13-nov-2023). ⏱ 14+ días.
- 👤 Rellenar la ficha, **Data safety** y URL de borrado (`STORE-PRIVACY.md`) y solicitar acceso a producción. ⏱ revisión de Google.

### Fase 5 — iPhone (puede ir en paralelo a la prueba de 14 días)
- 👤 💲 Apple Developer Program individual (99 USD/año; verifica el importe). ⏱ Aprobación habitual: horas a un día.
- 👤 Registrar el Bundle ID, crear la app en App Store Connect, crear la clave API y la integración `Personal T` en Codemagic (💲 plan gratuito: 500 min/mes de Mac; verifica el límite).
- 🤖 Ajustar `codemagic.yaml` con los errores que salgan en la primera compilación (iOS no se ha compilado nunca).
- 👤 Probar con **TestFlight**; completar App Privacy y las notas de revisión (`STORE-PRIVACY.md`); enviar a revisión. ⏱ Revisión de Apple.

### Después de publicar
- 👤 Cada versión nueva: subir `VERSION_CODE` y revisar que la política siga siendo cierta.
- 👤 Planificar el **plan B si Apple rechaza por la regla 4.2** (poca funcionalidad nativa): se responde con las funciones nativas (cámara, compartir, notificaciones) o se añaden más.
