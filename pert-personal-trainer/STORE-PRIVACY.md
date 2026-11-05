# Respuestas para los formularios de privacidad de las tiendas

Redactadas a partir del comportamiento real de la app (código en este repo). **Verifica cada respuesta contra la ayuda oficial vigente de Apple y Google antes de enviar**: las definiciones de «recopilar» cambian y yo no puedo confirmarlas desde aquí. Si dudas, **declara de más** (declarar de menos es el riesgo real).

## Hechos que sustentan las respuestas
- Los datos viven en el dispositivo. Sin anuncios, analíticas, rastreadores ni SDK de terceros de seguimiento.
- Permisos: cámara (solo al pulsar «Tomar foto») e Internet (solo nube opcional y enlaces).
- Nube opcional: el usuario introduce la URL y clave pública **de su propio proyecto de Supabase**; el autor no opera servidores ni recibe datos. Cifrado en tránsito (HTTPS); sin cifrado de extremo a extremo.
- Borrado: dentro de la app (Ajustes → Nube → Eliminar mi cuenta / Eliminar mis datos en la nube / Borrar todos los datos) y página web `delete-account.html`.
- Android: `allowBackup=false`. iOS: `ITSAppUsesNonExemptEncryption=false` (solo cifrado estándar del sistema/HTTPS).

## ⚠️ Decisión de arquitectura que afecta a estas respuestas
Hoy la nube es «trae tu propio Supabase»: apta para usuarios técnicos, **no para el público general** de una tienda (nadie normal crea un proyecto de base de datos). Opciones:
1. **Publicar con la nube como función avanzada** (como está): las respuestas de abajo valen. La app funciona completa sin cuenta.
2. **Operar un servicio de sincronización propio** para todos los usuarios: el autor pasaría a recibir datos de salud. Cambia las etiquetas (recopila: salud, fotos, correo, ID de usuario), exige actualizar la política, revisar RGPD/leyes de datos de salud y asumir costos y soporte.

## Apple — App Privacy («etiquetas de privacidad»)
- **Conservadora (recomendada):** declarar *Health & Fitness → Fitness/Health* (registro de entrenamiento y respuesta de síntomas), *User Content → Photos*, *Contact Info → Email Address* e *Identifiers → User ID*. Para todos: **vinculados al usuario: sí**; **uso para seguimiento: no**; finalidad: **App Functionality**; (son opcionales: solo con la nube activa).
- **Mínima (defendible solo si la nube queda como función avanzada hacia el proyecto del propio usuario):** «Data Not Collected». Compruébalo contra la definición de «collect» de Apple.
- URL de la política: `…/privacy.html`. Cuenta: la app permite crearla y **eliminarla dentro de la app** (guía 5.1.1(v)).
- Notas para el revisor (en inglés, pegar en *App Review Information*):
  > Personal T works fully without an account: no sign-in is required to review any feature. Cloud sync is optional (Settings → Cloud) and connects to a Supabase project that the user configures; we operate no servers. Account deletion: Settings → Cloud → Delete my account. The app is a workout log and is not a medical device; it does not diagnose or give medical advice. The camera is used only to photograph gym machines when the user taps “Take photo”.

## Google Play — Data safety
- **¿Recopila o comparte datos?** Con la nube activa, los datos salen del dispositivo hacia el proyecto del usuario. Opción conservadora: **«Sí, recopila»** con estos tipos, **todos opcionales**, finalidad *App functionality*, **no compartidos** con terceros, **cifrados en tránsito: sí**:
  *Health and fitness → Health info / Fitness info*, *Photos and videos → Photos*, *Personal info → Email address*, *App activity → Other user-generated content* (comentarios).
- **¿Puede el usuario solicitar el borrado?** Sí. URL de borrado: `…/delete-account.html`.
- **Política de privacidad:** `…/privacy.html`.
- **Acceso a la app:** no requiere inicio de sesión para ninguna función.
- **Categoría / declaraciones:** si Play Console muestra la declaración de **apps de salud** (Health apps declaration) por tener funciones de salud/fitness, complétala; indica que no es un dispositivo médico y que no usa Health Connect.
- **Público objetivo:** adultos (18+).
