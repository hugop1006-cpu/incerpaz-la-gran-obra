# INCERPAZ: La Gran Obra

Juego de plataformas 2D para navegador, hecho para la marca **INCERPAZ** (cerámica y materiales de construcción, Bolivia).
HTML + CSS + JavaScript puro con Canvas: sin frameworks, sin build y sin imágenes ni sonidos externos (todo se dibuja y se sintetiza por código).

> Una familia necesita su casa terminada antes de la tormenta. **Ladri**, un ladrillo con casco amarillo y botas, recorre la obra juntando materiales para levantarla a tiempo.

## Cómo jugar

Abre `index.html` en el navegador (doble clic). No necesita servidor.

| Acción | Teclado | Celular |
|---|---|---|
| Moverse | ← → o A D | botones ◀ ▶ |
| Saltar (mantén para saltar más alto) | Espacio, ↑ o W | SALTO |
| Apilar un ladrillo bajo los pies | ↓, S o X | APILAR |
| Muro instantáneo | C o Shift | MURO |
| Pausa | P o Esc | botón II |
| Sonido | M | menú |

- **Pisa** a las termitas para vencerlas. Las goteras caen cuando pasas debajo y la humedad (nube) crece lentamente.
- **Apilar**: Ladri pone un ladrillo bajo sus pies para alcanzar lugares altos. Hay un límite por nivel (se ve en el HUD, "APILAR").
- **Power-ups**: casco reforzado (aguanta un golpe), carretilla (más velocidad y embiste enemigos 8 s), muro instantáneo (plataforma temporal de 3 tiles), bolsa de ladrillos (+3 para apilar).
- **Coleccionables**: ladrillitos (puntos; cada 50 = vida extra) y 3 tejas doradas escondidas por nivel.
- **Nivel 5, La Tormenta**: la cámara avanza sola y la lluvia te empuja. Al final, **La Grieta** parte el suelo: párate junto a cada grieta abierta y pulsa *apilar* para sellarla con un ladrillo. Con 6 sellos la vences.
- El progreso (niveles desbloqueados, récord, tejas) se guarda en `localStorage`. Para borrarlo, limpia los datos del sitio en el navegador.

## En el celular (vertical y pantalla completa)

- Se juega en **vertical**: el juego ocupa toda la pantalla y los botones (◀ ▶, SALTO, APILAR, MURO) quedan abajo durante la partida. En horizontal también funciona.
- **Android (Chrome):** pasa a pantalla completa al primer toque.
- **iPhone (Safari):** no permite pantalla completa desde una página web. Para tenerla: botón Compartir → **Añadir a pantalla de inicio**, y abre el juego desde ese ícono.
- Para sacar el ícono con el logo, edita `icons/` (192 y 512 px) y `manifest.json`.

## Estructura

```
index.html      página del juego (canvas + botones táctiles)
manifest.json   datos para instalarlo en el celular (pantalla completa, ícono)
icons/          íconos de la app
style.css       diseño responsive
config.js       COLORES DE MARCA, logo, física y reglas
levels.js       los 5 niveles (mapas de texto)
js/font.js      fuente de píxeles (con tildes y ñ)
js/audio.js     efectos y música (Web Audio API)
js/sprites.js   arte dibujado por código
js/game.js      motor: física, colisiones por tiles, enemigos, jefe, menús
tools/          prueba automática (un robot juega cada nivel)
```

## Cambiar colores y logo

Edita `config.js`: `BRAND` (colores del juego y del ladrillo de Ladri), `LOGO` (texto, lemas y colores del cartel de título y de la fachada de la casa final) y `THEMES` (paleta de cada etapa). Los colores actuales salen del logo de INCERPAZ (amarillo y rojo).

## Editar niveles

Todo está en `levels.js`. Cada nivel es un objeto con un `map`: un arreglo de 17 cadenas, una por fila, todas del mismo largo. Cada carácter es un tile (1 tile = 16 px):

| Símbolo | Significado | Símbolo | Significado |
|---|---|---|---|
| ` ` | aire | `P` | inicio de Ladri |
| `#` | terreno / piso | `F` | meta (arco de 2 tiles de ancho) |
| `B` | ladrillo sólido | `o` | ladrillito |
| `R` | teja de techo (resbala) | `G` | teja dorada (pon exactamente 3) |
| `/` `\` | pendientes de techo | `C` | punto de control |
| `S` | arena (frena) | `e` | termita |
| `T` | revestimiento cerámico | `d` | gotera (cuelga de arriba) |
| `=` | tablón (se atraviesa desde abajo) | `h` | humedad |
| `^` | varillas filosas | `H` `W` `M` `r` | casco, carretilla, muro, bolsa de ladrillos |

Campos útiles: `time` (segundos), `bricks` (límite de ladrillos), `theme` (paleta), `music`, `hints` (carteles), `movers` (grúas: posición, ancho, recorrido y velocidad). El nivel 5 además tiene `scroll` (cámara forzada) y `boss`.

Medidas para diseñar: Ladri salta unos 3,5 tiles de alto y cruza huecos de hasta 3 tiles. Una pared de 4 tiles obliga a apilar 1 ladrillo; de 5, a apilar 2. Los pinchos `^` de 2 tiles de ancho se pueden saltar; de 3 casi no.

## Probar los niveles automáticamente

```
npm i playwright
node tools/probar-niveles.js        # todos los niveles
node tools/probar-niveles.js 4      # solo el nivel 5 (índice desde 0)
```
Un robot juega cada nivel hasta la meta (y vence al jefe) y avisa si aparece un error en consola.

## Publicar gratis con GitHub Pages

1. Sube el proyecto a un repositorio de GitHub (rama `main`).
2. En el repositorio: **Settings → Pages**.
3. En *Build and deployment* elige **Deploy from a branch**, rama `main`, carpeta `/ (root)` y guarda.
4. En un minuto el juego estará en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPOSITORIO/`.

Funciona en celular: abre el enlace y juega con los botones en pantalla (mejor en horizontal).

## Sitio de marca (primera entrega)

Además del juego, este repositorio contiene el rediseño de incerpaz.com en `site/` (código fuente y datos en `site-src/`).
Se abre en `/site/` y no afecta al juego. Guía de uso, edición y publicación: [`site-src/README.md`](site-src/README.md).
Lo que falta confirmar antes de publicar: [`site-src/CONTENIDO-PENDIENTE.md`](site-src/CONTENIDO-PENDIENTE.md).
