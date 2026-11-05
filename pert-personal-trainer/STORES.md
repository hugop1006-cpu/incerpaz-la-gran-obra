# Publicar Personal T en Google Play y App Store

## Decisiones tomadas
- **Nombre:** Personal T. **Cuenta de desarrollador:** individual (tu nombre legal aparece como vendedor).
- **Empaquetado:** Capacitor (la app va dentro del paquete y funciona sin conexión; la PWA sigue existiendo).
- **Identificador (`appId`): `app.personalt.trainer`.** ⚠️ **Es permanente**: una vez subida la primera versión a una tienda no se puede cambiar. Confírmalo o cámbialo en `capacitor.config.json`, `android/app/build.gradle` (applicationId/namespace) y el proyecto iOS **antes** de subir nada.
- **iPhone sin Mac:** Codemagic (`codemagic.yaml`). Android: GitHub Actions (`.github/workflows/android.yml`) o Android Studio.

## Estado verificado y pendiente
| Verificado en el entorno de desarrollo | Sin verificar |
|---|---|
| APK de depuración compila y contiene la app (nombre, paquete, ícono, solo permiso de Internet) | Ejecutar la app en un teléfono Android o iPhone reales |
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
6. Riesgo conocido: la regla 4.2 rechaza apps que son solo una web. Mitiga con funciones nativas reales (cámara, compartir, aviso de descanso con la pantalla apagada: pendiente).

## Sitio de política y borrado de cuenta
1. `cp site/config.example.json site/config.json` y pon **tu nombre legal** y un **correo de contacto** (se publicarán). Sin ellos, el script se niega a generar el sitio.
2. `node scripts/build-site.mjs` genera `site/dist/` (3 páginas bilingües ES/EN, sin peticiones externas).
3. Publica `site/dist/` en un hosting estático **público** (Cloudflare Pages o GitHub Pages: ambos tienen plan gratuito; GitHub Pages en repositorios privados exige un plan de pago).
4. Pon esa dirección (https, sin barra final) en `LEGAL_BASE` de `data.js` para que la app enlace a las páginas desde Ajustes → «Privacidad y datos».
5. Usa `…/privacy.html` como URL de política en ambas tiendas y `…/delete-account.html` como URL de borrado en Google Play (Data safety).
6. Respuestas de los formularios de privacidad: ver `STORE-PRIVACY.md`. **Antes de publicar, que te revise la política alguien con criterio legal**: está redactada según lo que hace la app, pero no es asesoría jurídica.
7. Si cambias lo que la app hace con los datos (por ejemplo, un servicio de nube propio), actualiza la política **antes**.

## Antes del primer envío (pendiente)
- Publicar el sitio de política y borrado (ver arriba) y rellenar los formularios (`STORE-PRIVACY.md`).
- Decidir la arquitectura de la nube para el público general (ver `STORE-PRIVACY.md`).
- Notificación de descanso en segundo plano (plugin de notificaciones locales).
- Probar en dispositivos reales: cámara, compartir copia, sin conexión, cambio de cuenta.
- Comprobar disponibilidad del nombre "Personal T" en ambas tiendas.
