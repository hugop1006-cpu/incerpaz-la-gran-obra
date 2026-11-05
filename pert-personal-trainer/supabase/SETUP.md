# Configurar la sincronización en la nube (opcional)

Personal T funciona completo sin nube. Si quieres sincronizar entre dispositivos usas **tu propio** proyecto de Supabase: tus datos de entrenamiento y salud quedan en tu cuenta, no en un servidor de la app.

## 1. Crear el proyecto
1. Crea una cuenta en supabase.com y un proyecto nuevo (elige la región más cercana a ti).
2. En **SQL Editor → New query** pega el contenido de `schema.sql` y pulsa **Run**.
3. En **Authentication → Providers → Email** deja activado el correo. Si dejas activada la confirmación por correo, al crear la cuenta recibirás un enlace: confírmalo y luego inicia sesión en la app.

## 2. Conectar la app
1. En Supabase: **Project Settings → API**. Copia la **Project URL** y la clave pública (**anon** o **publishable**). **No uses nunca la clave `service_role`.**
2. En Personal T: **Ajustes → Nube (opcional)**: pega la URL y la clave pública, y pulsa **Guardar**.
3. Escribe correo y contraseña (mínimo 6 caracteres) y pulsa **Crear cuenta**. En tu segundo dispositivo usa **Iniciar sesión** con la misma cuenta.

## Cómo funciona
- Se sincroniza al abrir la app, al terminar una sesión, al volver a la app y al recuperar conexión. También con el botón **Sincronizar ahora**.
- Sesiones: se unen entre dispositivos (nunca se pierden). Plantillas, ejercicios propios y fotos: gana el cambio más reciente. Los borrados se propagan.
- La sesión en curso no se sincroniza hasta que la termines.
- La URL, la clave pública y la sesión viven solo en el dispositivo y **no** entran en las copias de seguridad.

## Privacidad y límites
- Los datos viajan cifrados (HTTPS) y quedan protegidos por permisos por usuario (RLS), pero **no están cifrados de extremo a extremo**: quien administre tu proyecto de Supabase puede leerlos.
- Restaurar una copia de seguridad con la nube activa **no** borra lo que hay en la nube: se mezcla.
- «Borrar todos los datos» borra solo este dispositivo; al sincronizar, vuelve a descargar lo de la nube. Para borrar la nube usa **Eliminar mis datos en la nube**. **Eliminar mi cuenta** (Ajustes → Nube) borra la cuenta y todos sus datos en la nube de forma definitiva; requiere la función `delete_my_account` de `schema.sql`. Este dispositivo conserva sus datos.
