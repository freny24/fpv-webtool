# Docker + Kubernetes Cheat Sheet (for the FPV/WSPV project & interviews)

## The one-sentence version

Hosting = running your app on an always-on server. **Docker** packs the app into
a standard "box" so it runs identically anywhere. **Kubernetes** is the manager
that runs those boxes on real servers and keeps them alive.

## The analogies

- **Docker container** = a standard steel shipping container. Put anything
  inside; every ship/crane/truck handles it the same. Solves *"works on my
  machine."*
- **Kubernetes** = the restaurant manager. You say "keep 2 chefs working, here's
  the menu"; it staffs, replaces a sick chef, keeps the kitchen running.

## Our architecture

```
Internet ──► Ingress ──► Frontend box (nginx + React) ──/api──► Backend box (Node + GEE)
              (HTTPS)                                                   │
                                                              Persistent Volume
                                                              (saves contributions)
```

- One public web address. The **frontend** serves the website AND forwards
  `/api` to the **backend**, so both boxes talk with no CORS.
- The **persistent volume** is a hard drive that survives restarts, so community
  submissions are never wiped.

## Docker vocabulary

| Term | Plain meaning |
|------|---------------|
| **Dockerfile** | The recipe to build a box (start from Node 20, copy code, install packages, run) |
| **Image** | The built box — a frozen template |
| **Container** | A running copy of an image |
| **Registry** | The warehouse where built images are stored so servers can pull them |
| **nginx** | Tiny web server that serves the static React files + proxies `/api` |

## Kubernetes vocabulary (the YAML files)

| Term | Plain meaning |
|------|---------------|
| **Deployment** | "Run this box and keep N copies alive" (self-healing: restarts on crash) |
| **Service** | A stable internal address so boxes can find each other |
| **Ingress** | Exposes the app to the public internet at a hostname, with HTTPS |
| **PersistentVolumeClaim (PVC)** | A durable hard drive that survives restarts |
| **Secret** | Safe storage for passwords/keys (admin key, Google credentials) |
| **Namespace** | A labeled area of the cluster that holds your app's resources |

## Why we chose this

IU offered **AppKube** (PHP-only — our app is Node/React, so no) or their
**Kubernetes cluster** (runs any containerized app — yes). Result: the
university hosts it **free, permanently, with persistent storage**, which also
fixes the free-tier problems (cold-start delay + contributions getting wiped).

## Our files

- `Dockerfile` + `nginx.conf` — frontend image (build React, serve, proxy `/api`)
- `server/Dockerfile` — backend image (Node API; climate cache baked in)
- `k8s/backend-deployment.yaml` / `frontend-deployment.yaml` — run the boxes + give them addresses
- `k8s/pvc.yaml` — durable storage for submissions
- `k8s/secret.example.yaml` — admin key + Google Earth Engine credentials
- `k8s/ingress.yaml` — public hostname + TLS
- `DEPLOY_KUBERNETES.md` — build → push → apply steps

## Interview one-liners

- **What is containerization / why Docker?** "Packaging an app with all its
  dependencies so it runs identically everywhere — reproducibility, portability,
  isolation. Kills 'works on my machine.'"
- **Image vs container?** "Image = built template; container = a running
  instance of it."
- **What does Kubernetes do?** "Orchestrates containers: schedules them onto
  servers, self-heals (restarts failures), scales, and handles networking +
  storage."
- **Why a PersistentVolume?** "Containers are ephemeral — their local disk is
  wiped on restart — so durable data needs a volume that lives outside the
  container."
- **How do containers talk / go public?** "Services give stable internal
  addresses; an Ingress exposes the app publicly with a hostname and TLS."
- **What's a registry?** "A store for built images; servers pull from it to run
  containers."
- **CI/CD (bonus)?** "A pipeline that automatically builds and pushes new images
  on each git push, so deploys are consistent and hands-off."

## The story to tell

> "I built a full-stack geospatial dashboard — React frontend, Node/Express
> backend integrating Google Earth Engine — then containerized it with Docker
> (separate frontend/nginx and backend images) and wrote Kubernetes manifests
> (Deployments, Services, Ingress, a PersistentVolumeClaim for durable data, and
> Secrets) to deploy it on the university's cluster."

## What I still need to fill in (from IT)

- **Registry** path for the images
- **Storage class** for the PVC
- **Ingress class**, **hostname**, and **TLS** setup
