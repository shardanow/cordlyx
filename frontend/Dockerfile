FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/shared/tsconfig.json packages/shared/tsconfig.json
COPY packages/shared/tsconfig.cjs.json packages/shared/tsconfig.cjs.json
COPY frontend/package.json frontend/package.json
COPY frontend/tsconfig.json frontend/tsconfig.json
COPY frontend/next.config.ts frontend/next.config.ts

# NEXT_PUBLIC_* vars are baked into the client bundle at build time,
# so they must be available as build args (not only runtime env).
ARG NEXT_PUBLIC_API_URL=/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm ci

COPY packages/shared/src/ packages/shared/src/
COPY frontend/ frontend/

# @cordlyx/shared resolves via ./dist (package.json main/exports),
# so it must be built before the Next.js build.
RUN npm run build -w packages/shared
RUN npm run build -w frontend

FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache tini

ENV NODE_ENV=production

# NOTE: in a monorepo the standalone output is nested
# (frontend/.next/standalone/frontend/server.js), not server.js at root.
COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./frontend/.next/static
COPY --from=builder /app/frontend/public ./frontend/public

WORKDIR /app/frontend
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
