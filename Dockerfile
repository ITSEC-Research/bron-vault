# Install dependencies only when needed
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN yarn install --frozen-lockfile

# Rebuild the source code only when needed
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN yarn build

# Production image using standalone output for smaller size
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Fixed non-root user (best practice: do not depend on host UID/GID or sudo)
RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs nextjs

# Copy only necessary files for standalone deployment
# Use --chown directly on COPY to set ownership immediately
# Note: User nextjs is created in the previous RUN step, so --chown will work
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy standalone build (includes only required node_modules)
# Note: COPY /app/.next/standalone ./ copies contents directly to /app (not to /app/.next/standalone)
# So files like server.js, package.json, etc. are copied to /app root
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

RUN chown -R nextjs:nodejs /app 2>/dev/null || true

# Entrypoint runs as root to fix /app/uploads ownership (volume may be root-owned on host)
# then drops to nextjs to run the app.
USER root
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh
ENTRYPOINT ["/app/docker-entrypoint.sh"]

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/auth/check-users', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "server.js"] 