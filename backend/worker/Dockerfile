FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/shared/tsconfig.json packages/shared/tsconfig.json
COPY packages/shared/tsconfig.cjs.json packages/shared/tsconfig.cjs.json
COPY backend/package.json backend/package.json
COPY backend/tsconfig.json backend/tsconfig.json
COPY backend/tsconfig.build.json backend/tsconfig.build.json
COPY backend/nest-cli.json backend/nest-cli.json

RUN npm ci

COPY packages/shared/src/ packages/shared/src/
RUN npm run build -w packages/shared

COPY backend/src/ backend/src/
RUN npm run build -w backend

FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache tini

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/package.json ./backend/

ENV NODE_ENV=production

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "backend/dist/src/worker"]
