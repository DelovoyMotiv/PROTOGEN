# PROTOGEN-01 Production Dockerfile
# Multi-stage build for minimal image size

# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source code
COPY . .

# Build TypeScript (if needed for production)
# RUN npm run build

# Stage 2: Production
FROM node:22-alpine

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    dumb-init \
    && addgroup -g 1000 protogen \
    && adduser -D -u 1000 -G protogen protogen

WORKDIR /app

# Copy from builder
COPY --from=builder --chown=protogen:protogen /app/node_modules ./node_modules
COPY --from=builder --chown=protogen:protogen /app/package*.json ./
COPY --chown=protogen:protogen . .

# Create data directory with correct permissions
RUN mkdir -p /app/data && \
    chown -R protogen:protogen /app/data && \
    chmod 700 /app/data

# Create backups directory
RUN mkdir -p /app/data/backups && \
    chown -R protogen:protogen /app/data/backups && \
    chmod 700 /app/data/backups

# Switch to non-root user
USER protogen

# Expose ports
EXPOSE 3000 8080 8443

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start application
CMD ["npm", "start"]
