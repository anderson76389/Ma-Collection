# Image de secours MA-COLLECTION : uniquement snapshots et serveur Node.
# Aucun npm, secret, script de déploiement ou connexion à Kaptain/TMDB.
FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node scripts/build-emergency-catalogue.mjs scripts/tmdb-own-lists.mjs ./scripts/
COPY --chown=node:node data/catalogue-archives/tmdb/ ./data/catalogue-archives/tmdb/
COPY --chown=node:node collections/*.json ./collections/
COPY --chown=node:node services/catalogue-recovery/server.mjs ./services/catalogue-recovery/server.mjs
RUN node services/catalogue-recovery/server.mjs --check
USER node
ENV HOST=0.0.0.0 PORT=8788 NODE_ENV=production
EXPOSE 8788
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:8788/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "services/catalogue-recovery/server.mjs"]
