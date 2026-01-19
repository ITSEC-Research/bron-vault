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

# Accept build arguments for UID/GID (default to 1001 if not provided)
ARG BUILD_UID=1001
ARG BUILD_GID=1001

# Don't run as root for security
# Create group and user with provided UID/GID to match host user
# Handle special case: UID 1000 is already used by 'node' user in Alpine
RUN \
    if [ "${BUILD_UID}" = "0" ]; then \
      echo "BUILD_UID is 0 (root), using default UID 1001 for nextjs user"; \
      ACTUAL_UID=1001; \
      ACTUAL_GID=${BUILD_GID:-1001}; \
      if [ "${ACTUAL_GID}" = "0" ]; then ACTUAL_GID=1001; fi; \
      addgroup -g ${ACTUAL_GID} -S nodejs && \
      adduser -S -u ${ACTUAL_UID} -G nodejs nextjs; \
    elif [ "${BUILD_UID}" = "1000" ]; then \
      echo "BUILD_UID is 1000, renaming existing 'node' user to 'nextjs'"; \
      # Rename user 'node' to 'nextjs' and group 'node' to 'nodejs' in /etc/passwd and /etc/group
      # Use more specific pattern to avoid accidental matches
      sed -i 's/^node:x:1000:1000:/nextjs:x:1000:1000:/' /etc/passwd && \
      sed -i 's/^node:x:1000:/nodejs:x:1000:/' /etc/group && \
      # Verify the rename worked
      (getent passwd nextjs > /dev/null && getent group nodejs > /dev/null) || \
      (echo "Warning: Failed to rename node to nextjs, creating new user" && \
       addgroup -g 1000 -S nodejs && \
       adduser -S -u 1000 -G nodejs nextjs); \
    else \
      echo "Creating new user nextjs with UID ${BUILD_UID} and GID ${BUILD_GID}"; \
      ACTUAL_UID=${BUILD_UID}; \
      ACTUAL_GID=${BUILD_GID}; \
      # Check if group with this GID exists, delete if it's not nodejs
      if getent group ${ACTUAL_GID} > /dev/null 2>&1; then \
        GROUP_NAME=$(getent group ${ACTUAL_GID} | cut -d: -f1); \
        if [ "${GROUP_NAME}" != "nodejs" ]; then \
          delgroup ${GROUP_NAME} 2>/dev/null || true; \
        fi; \
      fi && \
      # Check if user with this UID exists, delete if it's not nextjs
      if getent passwd ${ACTUAL_UID} > /dev/null 2>&1; then \
        USER_NAME=$(getent passwd ${ACTUAL_UID} | cut -d: -f1); \
        if [ "${USER_NAME}" != "nextjs" ]; then \
          deluser ${USER_NAME} 2>/dev/null || true; \
        fi; \
      fi && \
      addgroup -g ${ACTUAL_GID} -S nodejs && \
      adduser -S -u ${ACTUAL_UID} -G nodejs nextjs; \
    fi

# Copy only necessary files for standalone deployment
# Use --chown directly on COPY to set ownership immediately
# Note: User nextjs is created in the previous RUN step, so --chown will work
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy standalone build (includes only required node_modules)
# Note: COPY /app/.next/standalone ./ copies contents directly to /app (not to /app/.next/standalone)
# So files like server.js, package.json, etc. are copied to /app root
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Ensure ownership is correct for all copied files
# Note: --chown on COPY should work, but this ensures everything is owned correctly
# uploads directory will be created and owned separately below
RUN chown -R nextjs:nodejs /app 2>/dev/null || true

# Create uploads directory with proper ownership
RUN mkdir -p /app/uploads/chunks /app/uploads/extracted_files && \
    chown -R nextjs:nodejs /app/uploads && \
    chmod -R 775 /app/uploads

# Switch to nextjs user
# Note: docker-compose.yml will override with user directive if BUILD_UID is 0
USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/auth/check-users', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "server.js"] 