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
FROM public.ecr.aws/docker/library/node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV TZ=Asia/Jakarta

# Setup user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Install PM2 globally and Redis
RUN apk add --no-cache redis && npm install pm2 -g

# Buat folder untuk upload dan atur izin
RUN mkdir -p public/uploads && chown -R nextjs:nodejs /app

# COPY DARI STAGE "builder" (Harus sesuai dengan nama AS di stage 2)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy ecosystem config
COPY --chown=nextjs:nodejs ecosystem.config.js ./

USER nextjs

EXPOSE 3000
ENV PORT 3000

CMD ["pm2-runtime", "ecosystem.config.js"]