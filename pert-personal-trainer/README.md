# Personal T (prototipo PWA)

Entrenamiento guiado, un ejercicio a la vez, con registro real. Local-first: los datos viven en el dispositivo (localStorage), sin cuenta ni servidor. Sincronización en la nube **opcional** con tu propio proyecto de Supabase (ver `supabase/SETUP.md`).

## Probar
```
python3 -m http.server 8000   # en esta carpeta
```
Abrir `http://localhost:8000` en el móvil o el navegador y "Añadir a pantalla de inicio".

## Reglas de producto
- Cada dato es **realizado** (serie marcada por el usuario), **referencia** (última sesión terminada) o **propuesta** (plan/sugerencia). Una propuesta nunca se registra sola ni autorrellena campos.
- Peso siempre con su tipo: por lado / por mano / totales / peso corporal (lb o kg).
- Síntomas Sí/No con aviso de detener y buscar atención urgente. La app no diagnostica ni reduce la rutina automáticamente.
- Sin datos personales en el repo: el catálogo trae solo propuestas genéricas. Exporta/importa tu historial en JSON/CSV.

## Publicar
- Web (PWA) en un hosting estático: `HOSTING.md` (`npm run build:pwa`).
- Google Play y App Store: `STORES.md`.

## Funciones
Sesión guiada, plantillas editables, ejercicios propios, fotos de máquinas, gráficas y récords, copias de seguridad (automáticas, a tu nube vía compartir, restaurar), importación de historial y sincronización opcional.

## Pendiente
Cifrado de extremo a extremo en la nube, publicación en tiendas.
