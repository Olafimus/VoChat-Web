# Build-Kontext: Repo-Root (docker compose: context: . / dockerfile: backend/Dockerfile)
# Node >= 22.13 wird fuer das eingebaute node:sqlite benoetigt.
FROM node:22.14-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
# Das Web-Workspace wird nicht gebraucht; die Lockfile bleibt trotzdem gueltig.
# Optional: zusätzliche CA für Builds hinter TLS-Proxys (docker build --secret id=ca,src=<datei>).
RUN --mount=type=secret,id=ca,required=false \
    NODE_EXTRA_CA_CERTS=$([ -f /run/secrets/ca ] && echo /run/secrets/ca) \
    npm ci --legacy-peer-deps --workspace backend --workspace packages/shared --include-workspace-root

FROM node:22.14-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=8787
WORKDIR /app
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node packages/shared ./packages/shared
COPY --chown=node:node backend ./backend
# Das Workspace-Manifest verweist auf web; fuer den Start wird es nicht benoetigt.
RUN mkdir -p /app/backend/data/media && chown -R node:node /app/backend/data
USER node
WORKDIR /app/backend
# Persistente Daten (SQLite-Fallback, Medien, Cache)
VOLUME ["/app/backend/data"]
EXPOSE 8787
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# node direkt als Hauptprozess, damit SIGTERM (docker stop) beim Server ankommt.
CMD ["node", "--import", "tsx", "src/server.ts"]
