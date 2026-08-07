# SERVER
FROM node:22-alpine AS base

RUN corepack enable && corepack prepare pnpm@latest --activate


# Build stage
FROM base AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install \
    --frozen-lockfile \
    --dangerously-allow-all-builds

COPY . .

# Allow Node.js to use more memory during the NestJS build
ENV NODE_OPTIONS="--max-old-space-size=2048"

RUN pnpm run build


# Production stage
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=7007

COPY package.json pnpm-lock.yaml ./

RUN pnpm install \
    --frozen-lockfile \
    --prod \
    --dangerously-allow-all-builds

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/uploads

EXPOSE 7007

CMD ["pnpm", "run", "start:prod"]