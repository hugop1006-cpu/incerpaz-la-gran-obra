# Sitio de INCERPAZ (primera entrega)

Sitio estático de marca: inicio, catálogo con 32 fichas de producto, PAVIC, Dónde estamos y Empresa.
No necesita servidor ni dependencias: se genera con Node y se publica copiando la carpeta `site/`.

## Estructura

```
site-src/
  build.js              genera todo el HTML en /site
  config.json           leadEndpoint: dirección que recibe los formularios (vacío = abren WhatsApp)
  data/sitio.json       ciudades, WhatsApp, agencias, fábricas, valores, misión, redes
  data/productos.json   catálogo (32 productos tomados de la tienda de Cochabamba)
  CONTENIDO-PENDIENTE.md  datos que faltan o hay que confirmar antes de publicar
site/                   resultado listo para publicar (HTML, CSS, JS e imágenes)
tools/probar-sitio.js   prueba automática del sitio
```

## Uso

```
node site-src/build.js            # regenera /site
npx http-server -p 8080 .         # ver en http://localhost:8080/site/
node tools/probar-sitio.js        # prueba (necesita: npm i playwright y el servidor de arriba)
```

## Cómo editar

- **Un teléfono, una dirección o una agencia:** `data/sitio.json`, luego `node site-src/build.js`.
- **Un producto:** `data/productos.json` (las fotos van en `site/assets/img/productos/`).
- **Textos de las páginas:** `build.js`, dentro de cada bloque de página.
- **Colores y tipografía:** variables al inicio de `site/assets/css/site.css`.

## Formularios

Sin servidor, cada formulario abre WhatsApp con el mensaje armado hacia el número de la ciudad elegida.
Para enviarlos a un CRM o a un correo, pon la dirección en `config.json` (`leadEndpoint`). El sitio envía un
POST con JSON (`asunto`, `ciudad`, `nombre`, `celular`, etc.) y, si falla, vuelve a abrir WhatsApp.

## Publicación

Copia la carpeta `site/` al servidor del dominio (o publícala con GitHub Pages desde la raíz del repositorio:
quedará en `/site/`). Cambia `dominio` en `data/sitio.json` si el sitio no vive en https://www.incerpaz.com.
