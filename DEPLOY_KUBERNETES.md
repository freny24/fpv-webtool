# Deploying to Kubernetes (kube.iu.edu)

The app runs as two containers behind one hostname:

- **fpv-frontend** — nginx serving the static React build. It also proxies
  `/api/*` to the backend, so everything is same-origin (no CORS).
- **fpv-backend** — the Node/Express + Google Earth Engine API. Internal only
  (ClusterIP); reached through the frontend's proxy.

Community submissions are written to a **PersistentVolumeClaim**, so they
survive restarts and redeploys.

```
Internet ──► Ingress ──► fpv-frontend (nginx) ──/api──► fpv-backend (Node/GEE)
                                                              │
                                                        fpv-data PVC (submissions)
```

## Files

- `Dockerfile` — frontend image (build React, serve with nginx)
- `nginx.conf` — static serving + `/api` proxy to the backend
- `server/Dockerfile` — backend image (Node API)
- `k8s/secret.example.yaml` — secrets template (ADMIN_KEY, GEE creds)
- `k8s/pvc.yaml` — persistent volume for submissions
- `k8s/backend-deployment.yaml` — backend Deployment + Service
- `k8s/frontend-deployment.yaml` — frontend Deployment + Service
- `k8s/ingress.yaml` — public hostname + TLS

## 1. Build and push the images

Replace `REGISTRY` with the registry IU IT gives you (and update the same value
in the two `k8s/*-deployment.yaml` files).

```bash
# Frontend (context = repo root)
docker build -t REGISTRY/fpv-frontend:1.0.0 .

# Backend (context = server/)
docker build -t REGISTRY/fpv-backend:1.0.0 ./server

docker push REGISTRY/fpv-frontend:1.0.0
docker push REGISTRY/fpv-backend:1.0.0
```

## 2. Create the secret (don't commit real values)

```bash
kubectl create secret generic fpv-secrets \
  --from-literal=ADMIN_KEY='choose-a-long-random-string' \
  --from-file=GEE_SERVICE_ACCOUNT_JSON=./server/gee-service-account.json
```

## 3. Apply the manifests

```bash
kubectl apply -f k8s/pvc.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/ingress.yaml
```

Then check:

```bash
kubectl get pods
kubectl logs deploy/fpv-backend   # expect "Earth Engine initialized" + "[climate] loaded N records"
```

## Notes / things to confirm with IU IT

- **Registry:** where to push images, and any pull-secret the cluster needs.
- **Storage class:** whether `pvc.yaml` needs an explicit `storageClassName`.
- **Ingress + TLS:** the `ingressClassName`, hostname convention, and how TLS
  certificates are issued (fill the hostname into `k8s/ingress.yaml`).
- **Climate cache:** `server/data/wb_cache.json` is baked into the backend
  image, so climate works out of the box. The large Köppen raster is *not*
  shipped (it's only needed to regenerate the cache); climate for arbitrary
  off-dataset points is disabled without it, which is fine for production.
- **Frontend API URL:** built with `VITE_API_URL=""` so the app calls a relative
  `/api` path that nginx proxies to the backend — no separate API hostname
  needed.
