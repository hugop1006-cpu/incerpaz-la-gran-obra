# Servidor de INCERPAZ (sitio + cuentas + panel). Necesita un disco persistente montado en /datos.
FROM node:22-slim
WORKDIR /app
COPY . .
ENV PORT=8080 HOST=0.0.0.0 DB_PATH=/datos/incerpaz.db CONTENT_DIR=/datos/contenido COOKIE_SECURE=1 TRUST_PROXY=1
VOLUME /datos
EXPOSE 8080
CMD ["node", "server/index.js"]
