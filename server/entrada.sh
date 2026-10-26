#!/bin/sh
# Arranque del contenedor: prepara el disco persistente (/datos) como administrador y luego
# ejecuta el servidor sin privilegios (usuario "node").
set -e
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$(dirname "${DB_PATH:-/datos/incerpaz.db}")" "${CONTENT_DIR:-/datos/contenido}"
  chown -R node:node "$(dirname "${DB_PATH:-/datos/incerpaz.db}")" "${CONTENT_DIR:-/datos/contenido}" 2>/dev/null || true
  exec setpriv --reuid=node --regid=node --init-groups node server/index.js
fi
exec node server/index.js
