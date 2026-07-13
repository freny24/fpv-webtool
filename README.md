# FPV Web Tool

A web platform for global monitoring of Floating Photovoltaic (FPV) sites,
built on Google Earth Engine and satellite geospatial data.

- Interactive map of FPV sites and their host waterbodies (Leaflet)
- Search by country, city, FPV ID, waterbody ID, or lat/lon
- Environmental insights per site: NDCI, chlorophyll-a proxy, and water
  surface temperature time series
- Community contributions: anyone can submit a site that's missing from the
  map; an admin review queue approves/rejects submissions with automatic
  duplicate detection before they appear publicly

## Project structure

- `/` — React + Vite frontend
- `/server` — Express backend (Earth Engine queries + submissions API)

## Local development

**Backend:**

```
cd server
npm install
cp .env.example .env   # fill in ADMIN_KEY; either set GEE_SERVICE_ACCOUNT_JSON
                        # or place gee-service-account.json in this folder
npm start
```

**Frontend** (in a separate terminal, from the repo root):

```
npm install
cp .env.example .env.local   # defaults to http://localhost:3001, fine for local dev
npm run dev
```

## Deploying publicly

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full Vercel (frontend) + Render
(backend) walkthrough, including environment variables and the persistence
caveat for the submissions store.
