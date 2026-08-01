# SERVER
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# Build stage
FROM base AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --dangerously-allow-all-builds
COPY . .
RUN pnpm run build

# Production stage
FROM base AS runner
WORKDIR /app


COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod --dangerously-allow-all-builds

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/uploads

EXPOSE 7007

CMD ["pnpm", "run", "start:prod"]
