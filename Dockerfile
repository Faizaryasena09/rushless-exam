# Stage 3: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Tambahkan user dan group
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Pastikan file yang di-copy juga dimiliki oleh nextjs
RUN chown -R nextjs:nodejs /app/public

USER nextjs

EXPOSE 3000
ENV PORT 3000

CMD ["npm", "start"]