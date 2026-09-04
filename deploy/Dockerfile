# syntax=docker/dockerfile:1.7
# Multi-stage build for True Canadian Maps. Targets: app (studio + API), worker (publisher/migrate/cli), delivery (static nginx).
FROM python:3.13-alpine AS public-source
ARG TCM_VERSION=dev
WORKDIR /source
COPY . .
RUN python scripts/public-snapshot.py --revision "$TCM_VERSION" --output "/out/source/$TCM_VERSION.tar.gz" \
 && mkdir -p /out/licenses \
 && cp LICENSE LICENSING.md THIRD_PARTY_NOTICES.md /out/licenses/ \
 && cp packages/embed/LICENSE /out/licenses/SDK-MIT.txt \
 && cp apps/marketing/third-party-notices.txt /out/licenses/browser-notices.txt

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/studio/package.json apps/studio/
COPY apps/worker/package.json apps/worker/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/style-compiler/package.json packages/style-compiler/
COPY packages/icons/package.json packages/icons/
COPY packages/artifact-store/package.json packages/artifact-store/
COPY packages/embed/package.json packages/embed/
COPY pipelines/basemap/package.json pipelines/basemap/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
ARG TCM_VERSION=dev
ENV TCM_VERSION=$TCM_VERSION TCM_EMBED_VERSION=$TCM_VERSION NEXT_TELEMETRY_DISABLED=1
COPY . .
# placeholder env so `next build` can evaluate config; real values are injected at runtime
ENV DATABASE_URL=postgres://build:build@localhost:5432/build BETTER_AUTH_SECRET=build-time-placeholder-secret-not-used-at-runtime \
    PUBLIC_STUDIO_URL=http://localhost:3000 PUBLIC_API_URL=http://localhost:3000/api PUBLIC_MAPS_URL=http://localhost:8081
RUN pnpm --filter @tcm/icons build:manifest \
 && pnpm --filter @truecanadianmaps/web build \
 && pnpm --filter @tcm/worker build \
 && pnpm --filter @tcm/studio build \
 && node scripts/collect-licenses.mjs

# ---------- app: Next.js standalone
FROM node:22-bookworm-slim AS app
ARG TCM_VERSION=dev
LABEL org.opencontainers.image.revision=$TCM_VERSION org.opencontainers.image.title="True Canadian Maps Studio"
LABEL org.opencontainers.image.source="https://github.com/aellosoftware/true-canadian-maps"
ENV TCM_VERSION=$TCM_VERSION TCM_SOURCE_REVISION=$TCM_VERSION
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/studio/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/studio/.next/static ./apps/studio/.next/static
COPY --from=build --chown=node:node /repo/apps/studio/public ./apps/studio/public
COPY --from=public-source /out/source ./apps/studio/public/source
COPY --from=public-source /out/licenses /usr/share/licenses/true-canadian-maps
COPY --from=build /repo/THIRD_PARTY_LICENSES /usr/share/licenses/true-canadian-maps/dependencies
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 CMD curl -fsS http://127.0.0.1:3000/api/healthz || exit 1
CMD ["node", "apps/studio/server.js"]

# ---------- worker: bundled ESM + runtime deps
FROM node:22-bookworm-slim AS worker
ARG TCM_VERSION=dev
LABEL org.opencontainers.image.revision=$TCM_VERSION org.opencontainers.image.title="True Canadian Maps worker"
LABEL org.opencontainers.image.source="https://github.com/aellosoftware/true-canadian-maps"
ENV TCM_VERSION=$TCM_VERSION
ENV NODE_ENV=production
# Keep the workspace depth used by pnpm. The worker's dependency links point
# from /repo/apps/worker/node_modules back to /repo/node_modules/.pnpm; moving
# them to a flat /app directory leaves those links dangling at runtime.
WORKDIR /repo/apps/worker
COPY --from=build --chown=node:node /repo/apps/worker/dist ./dist
COPY --from=build --chown=node:node /repo/apps/worker/package.json ./package.json
COPY --from=build --chown=node:node /repo/node_modules/.pnpm /repo/node_modules/.pnpm
COPY --from=build --chown=node:node /repo/apps/worker/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/packages/embed/dist/embed ./embed
COPY --from=public-source /out/licenses /usr/share/licenses/true-canadian-maps
COPY --from=build /repo/THIRD_PARTY_LICENSES /usr/share/licenses/true-canadian-maps/dependencies
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD test $(( $(date +%s) - $(stat -c %Y /tmp/tcm-worker-heartbeat 2>/dev/null || echo 0) )) -lt 90 || exit 1
CMD ["node", "dist/index.js"]

# ---------- delivery: static nginx serving the artifact volume + embed
FROM nginx:1.27-alpine AS delivery
ARG TCM_VERSION=dev
LABEL org.opencontainers.image.revision=$TCM_VERSION org.opencontainers.image.title="True Canadian Maps delivery"
LABEL org.opencontainers.image.source="https://github.com/aellosoftware/true-canadian-maps"
COPY deploy/delivery/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/delivery/mime.types /etc/nginx/mime.types
COPY --from=build /repo/packages/embed/dist/embed /srv/delivery-embed
COPY --from=public-source /out/source /srv/delivery-source
COPY --from=public-source /out/licenses /usr/share/licenses/true-canadian-maps
COPY --from=build /repo/THIRD_PARTY_LICENSES /usr/share/licenses/true-canadian-maps/dependencies
COPY deploy/delivery/entrypoint.sh /docker-entrypoint.d/40-tcm-embed.sh
RUN chmod +x /docker-entrypoint.d/40-tcm-embed.sh

# Marketing HTML, demo and Nginx policy are one atomic image.
FROM nginx:1.27-alpine AS marketing
ARG TCM_VERSION=dev
LABEL org.opencontainers.image.revision=$TCM_VERSION org.opencontainers.image.title="True Canadian Maps marketing"
LABEL org.opencontainers.image.source="https://github.com/aellosoftware/true-canadian-maps"
COPY apps/marketing/ /usr/share/nginx/html/
COPY deploy/marketing/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=public-source /out/source /usr/share/nginx/html/source
COPY --from=public-source /out/licenses /usr/share/licenses/true-canadian-maps
RUN find /usr/share/nginx/html -name '*.html' -exec sed -i "s/TCM_ASSET_REVISION/$TCM_VERSION/g" {} + \
 && printf '{"revision":"%s"}\n' "$TCM_VERSION" > /usr/share/nginx/html/version.json
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD wget -q -O /dev/null http://127.0.0.1/version.json || exit 1
