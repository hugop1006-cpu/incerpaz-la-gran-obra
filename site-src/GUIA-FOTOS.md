# Guía de fotos para el sitio

Para que el catálogo se vea uniforme. Es una recomendación de trabajo para Marketing; las medidas se pueden ajustar con quien tome las fotos.

## Fotos de producto (tarjetas y fichas)
- **Fondo blanco liso** (sin paisaje ni obra al fondo) y la pieza completa, sin recortes.
- **Formato cuadrado**, mínimo 1200 × 1200 px, en JPG. El sitio las muestra cuadradas y las ajusta sin deformarlas.
- **Misma escala y mismo ángulo en todas:** pieza centrada, ocupando cerca del 80 % del cuadro, vista tres cuartos desde arriba como las fotos actuales de ladrillos.
- **Luz suave y pareja**, sin sombras duras ni reflejos; el color debe ser fiel al de la pieza.
- La foto principal es siempre la de fondo blanco. La foto de la pieza colocada en obra va como segunda imagen.
- Nombre del archivo: el mismo del producto, en minúsculas y con guiones (por ejemplo `18-huecos-luis-xv-1.jpg`).

## Fotos de obras (inicio y PAVIC)
- Horizontales (proporción 4:3), mínimo 1600 px de ancho, con la obra terminada y bien iluminada.
- Datos que se muestran con cada obra: título, ciudad y, si se confirman, año y superficie. **Sin estos datos confirmados no se publica la obra.**
- Solo obras de las que INCERPAZ pueda mostrar la foto. Si aparecen personas, deben haber autorizado.

## Cómo entran al sitio
1. Las fotos de producto van en `site/assets/img/productos/` y se enlazan en los datos del producto.
2. Las obras, certificados y testimonios se cargan en `site-src/data/confianza.json` (ver abajo). Mientras una lista esté vacía, esa sección no se muestra.
3. Hay que regenerar el sitio con `node site-src/build.js`.

## `confianza.json`
- `desde`: año de inicio de la empresa (número). Aparece como «Desde AAAA» en la franja de confianza.
- `certificaciones`: `{ nombre, detalle, archivo }`. `archivo` es opcional (ruta del PDF dentro del sitio).
- `obras`: `{ titulo, ciudad, anio, superficie_m2, imagen, pavic }`. Obligatorios: título, ciudad e imagen. `pavic: true` la muestra también en la página de PAVIC.
- `testimonios`: `{ nombre, empresa, ciudad, texto, autorizacion_escrita }`. **Solo se publican con `autorizacion_escrita: true`**, es decir, cuando existe autorización escrita de la persona o empresa.
