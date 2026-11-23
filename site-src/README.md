# Sitio de INCERPAZ (primera entrega)

Sitio estático de marca: inicio, catálogos de Cochabamba y Santa Cruz (57 fichas de producto), PAVIC, Dónde estamos y Empresa.
No necesita servidor ni dependencias: se genera con Node y se publica copiando la carpeta `site/`.

## Estructura

```
site-src/
  build.js              genera todo el HTML en /site
  config.json           interno (true = sin indexar), leadEndpoint (dirección que recibe los formularios; vacío = abren WhatsApp)
  data/sitio.json       ciudades, WhatsApp, agencias, fábricas, valores, misión, redes
  data/productos.json   catálogo (productos de las tiendas de Cochabamba y Santa Cruz)
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

## Uso interno y publicación

Por ahora el sitio es **interno**: `config.json` trae `"interno": true`, así que todas las páginas llevan `noindex` y `robots.txt` bloquea a los buscadores.
No lo publiques en un alojamiento público (por ejemplo, GitHub Pages en un repositorio público) mientras siga así.
Para verlo en tu computador: `npx http-server -p 8080 .` y abre http://localhost:8080/site/. Para compartirlo dentro de la empresa, copia la carpeta `site/` a un servidor interno.

Cuando se publique en incerpaz.com: cambia `interno` a `false`, ejecuta `node site-src/build.js` (se generan `sitemap.xml` y un `robots.txt` que permite indexar) y copia `site/` al servidor del dominio.

El dominio previsto es https://www.incerpaz.com (campo `dominio` de `data/sitio.json`).

## Modo comercio
Con `"comercio": true` (por defecto) el sitio carga `comercio.js` y necesita el servidor de `server/` (ver `server/README.md`) para cuentas, precios y pedidos.

## Publicación pública
`PUBLICO=1 node site-src/build.js` genera el sitio indexable (o `"interno": false` en `config.json`). Los archivos `site.css` y los scripts se enlazan con `?v=hash` para poder cachearlos un año. `assets/js/config.js` lo genera el build (ciudades y destino de los formularios). Verificación: `node tools/probar-publico.js`.
