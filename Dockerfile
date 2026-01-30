# Multi-stage build for flasher frontend (esptool-js example)
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Root deps (library build)
COPY package*.json ./
# Avoid running prepare/build before sources are copied
RUN npm ci --ignore-scripts

COPY . .

# Build the library (lib/ + bundle.js)
ENV NODE_OPTIONS="--max-old-space-size=768"
RUN npm run build

# Build the example frontend (Parcel -> dist/)
WORKDIR /app/examples/typescript
RUN npm ci
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy built files from builder stage
COPY --from=builder /app/examples/typescript/dist /usr/share/nginx/html

# Nginx configuration for SPA-like routing and cache (same approach as portal frontend)
RUN echo 'server { \
    listen 80; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    \
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
