# Intelligent Search + Köppen Climate — Setup & Changes

This slice rebuilds the dashboard's search into a global, fuzzy, keyboard-driven
experience and adds **Köppen-Geiger climate** as a first-class, searchable
dimension. Backend logic is preserved — everything here is additive.

## One-time setup: build the climate cache

Climate is derived by sampling the **Beck et al. (2018) 1-km Köppen raster**
locally (no GEE dependency for climate). Run once (and again whenever the
waterbody asset changes):

```bash
cd server
npm install          # installs the new `geotiff` dependency
npm run build:koppen  # == node koppen/build-cache.js
```

This will:

1. Download `Beck_KG_V1_present_0p0083.tif` (~18 MB) to `server/data/`.
2. Pull every waterbody centroid from the GEE `WB_ASSET`.
3. Sample `koppen_code` / `koppen_label` / `koppen_5class` / `climate_zone` per
   waterbody.
4. Write `server/data/wb_cache.json` (also carries lake name, coverage, area).

The server reads this JSON at startup. **If it's absent the app still runs** —
climate fields are simply `null` until you build the cache.

The 5-class mapping matches the reference pipeline exactly:
`A_Tropical` (codes 1–3), `B_Arid` (4–7), `C_Temperate` (8–16),
`D_Cold` (17–28), `E_Polar` (29–30) → shown in the UI as
Tropical / Arid / Temperate / Cold / Polar.

## What changed

### Backend (`server/`)
- **`koppen/build-cache.js`** (new) — raster download + GEE centroid pull +
  windowed sampling → `data/wb_cache.json`. Memory-safe (1×1 windowed reads).
- **`climate.js`** (new) — runtime module: loads the cache, zone matching +
  synonyms, `enrichFpv()`, and a live `sampleClimateAt(lat,lon)` for
  off-waterbody points.
- **`index.js`** — `/api/fpv-overview`, `/api/fpv-identify` and
  `/api/fpv-search` now return `lake_name`, `fpv_cov`, `koppen_label`,
  `koppen_5class` and `climate_zone`. Search also understands climate-zone
  queries and waterbody names. No existing fields removed.

### Frontend (`src/`)
- **`lib/search.js`** (new) — dependency-free search engine: query parsing
  (FPV ID incl. digits-only, country/state/city/waterbody, lat, lon, `lat,lon`,
  climate zone + synonyms), fuzzy scoring, match highlighting.
- **`components/GlobalSearch.jsx` / `.css`** (new) — autocomplete dropdown with
  rich result cards (ID, location, waterbody, climate chip, coverage), match
  highlighting, full keyboard navigation, loading spinner, and a server
  fallback for deep queries.
- **`MapView.jsx`** — integrates `GlobalSearch`; adds a spatial **climate
  filter** (shows only that class + fits bounds + banner); redesigned
  **scientific markers** (energy node: white core, climate-tinted ring, soft
  pulse; selected = larger glow + bounce + auto-opened popup); popups now show
  waterbody + climate.
- **`components/FPVInfoPanel.jsx`** — climate badge + Climate Zone row.

## Search — supported queries

| Type | Example |
|------|---------|
| FPV ID | `FPV_USA_00142`, `00142`, `142` |
| Country / State / City | `India`, `Kerala`, `Karimnagar` |
| Waterbody name | `Vembanad` |
| Climate zone (+ synonyms) | `Tropical`, `Arid`, `desert`, `continental` |
| Latitude / Longitude | `41.08`, `-85.10` |
| Coordinate pair | `41.08,-85.10` |

Selecting a site flies + bounces the marker, opens its popup, highlights the
country and opens the side panel. Selecting a climate zone filters the map to
every FPV in that class and fits the view to them.

## Notes
- New dependency: `geotiff` (server, for raster sampling). Front end added **no**
  new dependencies.
- `server/_geotest.mjs` is a throwaway sampling-math validation script; safe to
  delete.
- Framer Motion, clustering, the GIS toolbar redesign, charts and the other
  workstreams from the brief are intentionally **not** in this slice.
