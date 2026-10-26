# Servidor de INCERPAZ (sitio + cuentas + panel). Necesita un disco persistente montado en /datos.
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY server ./server
COPY site ./site
COPY site-src ./site-src
RUN chmod +x server/entrada.sh && chown -R node:node /app
ENV PORT=8080 HOST=0.0.0.0 DB_PATH=/datos/incerpaz.db CONTENT_DIR=/datos/contenido COOKIE_SECURE=1 TRUST_PROXY=1 RESPALDO_DIARIO=1
VOLUME /datos
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "server/entrada.sh"]
