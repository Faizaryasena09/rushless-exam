# Stage 1: Install dependencies
FROM public.ecr.aws/docker/library/node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build the application (PASTIKAN ADA "AS builder")
FROM public.ecr.aws/docker/library/node:20-alpine AS builder
WORKDIR /app
# Ambil node_modules dari stage deps
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Stage 3: Production runner
FROM public.ecr.aws/docker/library/node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV TZ=Asia/Jakarta

# Install PM2 globally and Redis
RUN npm install pm2 -g && \
    apt-get update -qq && \
    apt-get install -y -qq --no-install-recommends redis-server && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Buat folder untuk upload dan atur izin
RUN mkdir -p public/uploads

# COPY DARI STAGE "builder" (Harus sesuai dengan nama AS di stage 2)
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Copy ecosystem config
COPY --chown=node:node ecosystem.config.js ./

USER node

EXPOSE 3000
ENV PORT 3000

CMD ["pm2-runtime", "ecosystem.config.js"]