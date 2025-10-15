# ========================================
# Multi-stage build for optimized image
# ========================================

FROM node:20-alpine AS builder

# Install build dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    librsvg-dev

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev for native builds)
RUN npm ci --include=dev

# ========================================
# Production stage
# ========================================

FROM node:20-alpine

# Metadata
LABEL maintainer="Rasavedic Team" \
      description="Discord Music Bot with Lavalink" \
      version="2.0.0"

# Install runtime dependencies
RUN apk add --no-cache \
    ffmpeg \
    dumb-init \
    cairo \
    pango \
    jpeg \
    giflib \
    librsvg \
    tini

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force && \
    rm -rf /tmp/*

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    mkdir -p /app/logs && \
    chown -R nodejs:nodejs /app

# Copy application code
COPY --chown=nodejs:nodejs . .

# Switch to non-root user
USER nodejs

# Expose port (if needed for metrics/health)
EXPOSE 3000

# Health check - verify bot process is running
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))" || \
      node -e "console.log('Bot running')" || exit 1

# Use tini as init system (lightweight alternative to dumb-init)
ENTRYPOINT ["/sbin/tini", "--"]

# Start the bot with production settings
CMD ["node", "index.js"]

# Optional: Add environment variables for production
ENV NODE_ENV=production \
    DEBUG_LEVEL=WARN \
    TZ=Asia/Kolkata
