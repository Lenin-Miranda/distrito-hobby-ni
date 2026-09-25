# syntax=docker/dockerfile:1
FROM node:24.21.0-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN npm install --global pnpm@12.6.0
WORKDIR /workspace

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
RUN --mount=type=cache,id=distrito-pnpm,target=/pnpm/store,sharing=locked pnpm install --frozen-lockfile --store-dir=/pnpm/store
COPY --chown=node:node . .
RUN pnpm --filter @distrito/api db:generate && pnpm --filter @distrito/contracts build

FROM dependencies AS development
ENV PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false
RUN mkdir -p .turbo apps/api/.turbo apps/api/.next apps/api/dist && chown node:node /workspace apps/web apps/api packages/contracts && chown -R node:node .turbo apps/api/.turbo apps/api/.next apps/api/dist packages/contracts/dist apps/api/src/generated
USER node
CMD ["pnpm", "exec", "turbo", "watch", "dev", "--filter=@distrito/api"]

FROM dependencies AS build
RUN pnpm --filter @distrito/api build && pnpm --filter @distrito/api deploy --prod --legacy /out/api && node scripts/local/package-runtime.mjs /out/api

FROM node:24.21.0-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/api/ ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:4000/api/v1/ready',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
