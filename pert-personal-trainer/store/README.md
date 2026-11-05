# Material de las fichas de tienda

| Archivo | Para qué |
|---|---|
| `listing-es.md` | Textos en español (idioma principal) para Google Play y App Store |
| `listing-en.md` | Textos en inglés (opcional; **la app solo está en español**, ver aviso dentro) |
| `check-listing.cjs` | Valida los límites de caracteres: `node store/check-listing.cjs` |
| `screenshots/apple-iphone-6.9/` | 6 capturas de **1320×2868** (iPhone 6.9″) para App Store Connect |
| `screenshots/google-phone/` | 6 capturas de **1080×1920** para Google Play (teléfono) |
| `graphics/feature-graphic-1024x500.jpg` | Gráfico de función de Google Play (1024×500, sin transparencia) |
| `graphics/icon-512.png` | Ícono de 512×512 para Google Play |
| `make-screenshots.cjs` | Regenera capturas y gráficos con datos ficticios y reloj fijo |

## Antes de subir nada
- **Las «fotos» de máquinas en las capturas son ilustraciones generadas**, no fotos reales. Cuando tengas tus fotos, puedes regenerar las capturas (o dejarlas así: muestran cómo se ve una foto en la ficha). Los datos de entrenamiento de las capturas son **ficticios**; nunca uses los tuyos.
- **Verifica antes de publicar la frase «aunque la pantalla esté apagada»** (aviso de descanso): solo está probada con un plugin simulado, no en un teléfono real. Si no llega en tu teléfono, quítala de las dos descripciones.
- Los límites de caracteres y los tamaños de imagen salen de guías de terceros: **confírmalos en Play Console y App Store Connect**. Apple pide al menos una captura de 6,9″ (acepta 1320×2868 o 1290×2796); Google pide al menos 2 capturas y el gráfico de función.
- iPhone: el proyecto está configurado **solo para iPhone** (no iPad) para no tener que enviar capturas de iPad ni pasar la revisión de tablet. En iPad se abre en modo compatibilidad.
- Las capturas deben reflejar la versión que envíes. Si cambias la interfaz, vuelve a generarlas: `node store/make-screenshots.cjs` (necesita Playwright y Chromium).
- Campos que debes completar tú en las consolas: URL de soporte y de la política (las páginas de `site/dist`), categoría (Salud y bienestar / Fitness), clasificación por edades y declaraciones (ver `../STORE-PRIVACY.md`).

## Capturas (orden y mensaje)
1. Elige tu rutina y empieza · 2. Un ejercicio a la vez (foto y ficha) · 3. Registra series, peso y esfuerzo (temporizador) · 4. Progreso y récords · 5. Plantillas y ejercicios propios · 6. Tus datos son tuyos (copias y nube opcional).
