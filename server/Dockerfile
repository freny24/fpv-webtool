# Backend: Node.js API (Express + Google Earth Engine)
FROM node:20-slim

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --omit=dev

# App source (wb_cache.json ships in the image; big rasters + secrets are
# excluded via .dockerignore, and submissions live on a persistent volume)
COPY . .

# Community submissions are written here; mount a PersistentVolumeClaim at this
# path in Kubernetes so they survive restarts (see k8s/backend-deployment.yaml).
ENV DATA_DIR=/app/persist
RUN mkdir -p /app/persist

EXPOSE 3001
CMD ["node", "index.js"]
