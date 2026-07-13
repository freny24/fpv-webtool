# Deploying the FPV Web Tool publicly

The app has two halves that deploy separately:

- **Frontend** (`/`, React + Vite) → **Vercel**
- **Backend** (`/server`, Express + Earth Engine + submissions API) → **Render**

Both already have a GitHub remote configured (`freny24/fpv-webtool`). Push your
changes there first — both Vercel and Render deploy by connecting to a GitHub
repo.

```
git add -A
git commit -m "Add user contribution feature, prep for public deployment"
git push origin main
```

## 1. Backend on Render

1. In the Render dashboard: **New > Web Service**, connect the
   `freny24/fpv-webtool` repo.
2. **Root Directory**: `server`
3. **Build Command**: `npm install`
4. **Start Command**: `npm start` (runs `node index.js`)
5. **Environment variables** (Render dashboard → Environment):
   - `GEE_SERVICE_ACCOUNT_JSON` — paste the full contents of your
     `gee-service-account.json` as a single-line value. This file is
     gitignored on purpose (it's a secret), so it must be set here, not
     committed.
   - `ADMIN_KEY` — a long random string. This is the shared password used to
     access the submission review queue in the app's Admin panel. Generate
     one with `openssl rand -hex 24` or similar.
   - `ALLOWED_ORIGINS` — leave blank until you have your Vercel URL (step
     2), then come back and set it, e.g.
     `https://fpv-webtool.vercel.app,https://fpv-webtool-git-main-freny24.vercel.app`
   - `PORT` — you can leave this unset; Render sets it automatically and the
     server already reads `process.env.PORT`.
6. Deploy. Once live, note the service URL, e.g.
   `https://fpv-webtool-api.onrender.com`.

### Persisting community submissions

Submissions (from the "Contribute a Site" form) are stored in a JSON file
under `server/data/`. On Render's free tier the filesystem is **ephemeral**
— it resets on every redeploy/restart. For a prototype/demo this is often
fine, but if you need submissions to survive redeploys:

- Add a **Render Disk** (Render dashboard → your service → Disks → Add
  Disk), mount it at e.g. `/var/data`, and set the env var
  `DATA_DIR=/var/data` on the service. (Persistent disks require a paid
  instance type.)
- Or, later, swap the JSON file store in `server/submissions.js` for a
  hosted database (Postgres via Supabase/Neon/Render Postgres). The storage
  logic is isolated in that one file, so this is a contained change.

## 2. Frontend on Vercel

1. In the Vercel dashboard: **Add New > Project**, import
   `freny24/fpv-webtool`.
2. Framework preset: Vite (auto-detected). Root directory: `.` (the repo
   root — not `server`).
3. **Environment variable**:
   - `VITE_API_URL` = your Render backend URL from step 1, e.g.
     `https://fpv-webtool-api.onrender.com` (no trailing slash).
4. Deploy. Vercel gives you a URL like `https://fpv-webtool.vercel.app`.
5. Go back to Render and set `ALLOWED_ORIGINS` to include this Vercel URL
   (and any Vercel preview-deployment URLs you want to allow), then redeploy
   the backend so CORS picks it up.

## 3. Verify

- Load the Vercel URL — the map, FPV/waterbody tile layers, search, and
  environmental insights should all work (they call the Render backend).
- Click "+ Contribute a Site", submit a test entry.
- Click "Admin" (bottom right), enter the `ADMIN_KEY` you set on Render, and
  confirm the test submission shows up under "Pending". Approve it and
  confirm a green marker appears on the map.

## Notes / limitations for a public prototype

- The admin key is a simple shared secret (sent as a header, stored in the
  browser's localStorage after first entry) — adequate for an internal/RA
  prototype, but not a substitute for real authentication if this becomes a
  public-facing tool with sensitive review data.
- Render's free tier spins down after inactivity, so the first request after
  idle time can take ~30–60s (cold start) — this affects the initial map
  tile load.
- Custom domain: both Vercel and Render support attaching a custom domain
  under their respective dashboards, once you have DNS access.
