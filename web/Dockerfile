# Build-Kontext: Repo-Root
FROM node:22.14-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
COPY web/package.json web/
# Optional: zusätzliche CA für Builds hinter TLS-Proxys (docker build --secret id=ca,src=<datei>).
RUN --mount=type=secret,id=ca,required=false \
    NODE_EXTRA_CA_CERTS=$([ -f /run/secrets/ca ] && echo /run/secrets/ca) \
    npm ci --legacy-peer-deps
COPY packages/shared packages/shared
COPY web web
ENV VITE_API_URL=/api
RUN npm run build -w web

FROM nginx:1.27-alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY web/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
