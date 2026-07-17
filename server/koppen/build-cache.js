/**
 * build-cache.js — One-time builder for the waterbody + Köppen climate cache.
 *
 * WHAT IT DOES
 *   1. Downloads the Beck et al. (2018) 1-km Köppen-Geiger GeoTIFF once (~18 MB).
 *   2. Pulls every waterbody centroid from the GEE WB_ASSET FeatureCollection.
 *   3. Samples the raster at each centroid to derive:
 *        koppen_code   (1..30)     e.g. 14
 *        koppen_label  (2-3 char)  e.g. "Cfa"
 *        koppen_5class (A..E)      e.g. "C_Temperate"
 *        climate_zone  (word)      e.g. "Temperate"
 *   4. Writes server/data/wb_cache.json keyed by wb_new_id, also carrying the
 *      waterbody name / location / coverage so the frontend search can render
 *      rich result cards and climate-zone filtering without extra GEE calls.
 *
 * This completely bypasses GEE for climate (raster is sampled locally), exactly
 * like the reference Colab pipeline. Run it once (and again whenever the
 * waterbody asset changes):
 *
 *     cd server && node koppen/build-cache.js
 *
 * The dev server reads the resulting JSON at startup; if it's missing the app
 * still runs (climate fields are simply null until the cache is built).
 */

require("dotenv").config();

const path = require("path");
const fs = require("fs");
const https = require("https");
const ee = require("@google/earthengine");

// ----------------------------------------------------------------------------
// Config (kept in sync with server/index.js)
// ----------------------------------------------------------------------------
const WB_ASSET = "projects/spheric-mesh-330606/assets/new_wb_data";
const DATA_DIR = path.join(__dirname, "..", "data");
const RASTER_PATH = path.join(DATA_DIR, "koppen_beck.tif");
const OUTPUT_PATH = path.join(DATA_DIR, "wb_cache.json");

// The raster may already be present under any of these names/locations (e.g.
// if the Beck_KG_V1 archive was extracted into server/data/). Use the first
// valid one we find before attempting a download.
const RASTER_CANDIDATES = [
  RASTER_PATH,
  path.join(DATA_DIR, "Beck_KG_V1_present_0p0083.tif"),
  path.join(DATA_DIR, "Beck_KG_V1", "Beck_KG_V1_present_0p0083.tif"),
];

function resolveExistingRaster() {
  for (const p of RASTER_CANDIDATES) {
    if (fs.existsSync(p) && fs.statSync(p).size > 1_000_000) return p;
  }
  return null;
}

// Beck_KG_V1_present_0p0083.tif — primary figshare mirror + fallbacks.
const RASTER_URLS = [
  "https://figshare.com/ndownloader/files/12407516",
  "https://storage.googleapis.com/hwrisk-data/koppen/Beck_KG_V1_present_0p0083.tif",
];

// ----------------------------------------------------------------------------
// Köppen code -> label + 5-class helpers (from Beck et al. 2018 legend)
// ----------------------------------------------------------------------------
const KOPPEN_CODE_LABELS = {
  1: "Af", 2: "Am", 3: "Aw",
  4: "BWh", 5: "BWk", 6: "BSh", 7: "BSk",
  8: "Csa", 9: "Csb", 10: "Csc",
  11: "Cwa", 12: "Cwb", 13: "Cwc",
  14: "Cfa", 15: "Cfb", 16: "Cfc",
  17: "Dsa", 18: "Dsb", 19: "Dsc", 20: "Dsd",
  21: "Dwa", 22: "Dwb", 23: "Dwc", 24: "Dwd",
  25: "Dfa", 26: "Dfb", 27: "Dfc", 28: "Dfd",
  29: "ET", 30: "EF",
};

// Maps the 5-class enum to the friendly single-word zone used in the UI/search.
const FIVE_CLASS_TO_ZONE = {
  A_Tropical: "Tropical",
  B_Arid: "Arid",
  C_Temperate: "Temperate",
  D_Cold: "Cold",
  E_Polar: "Polar",
};

function koppenTo5Class(code) {
  if (code === null || code === undefined || Number.isNaN(Number(code)))
    return null;
  const c = Number(code);
  if (c <= 0) return null; // 0 = ocean / no data
  if (c <= 3) return "A_Tropical";
  if (c <= 7) return "B_Arid";
  if (c <= 16) return "C_Temperate";
  if (c <= 28) return "D_Cold";
  return "E_Polar";
}

// ----------------------------------------------------------------------------
// Credentials (reuse the server's service account)
// ----------------------------------------------------------------------------
function loadPrivateKey() {
  if (process.env.GEE_SERVICE_ACCOUNT_JSON)
    return JSON.parse(process.env.GEE_SERVICE_ACCOUNT_JSON);
  const keyPath = path.join(__dirname, "..", "gee-service-account.json");
  if (fs.existsSync(keyPath))
    return JSON.parse(fs.readFileSync(keyPath, "utf8"));
  throw new Error(
    "Missing Earth Engine credentials: set GEE_SERVICE_ACCOUNT_JSON or provide server/gee-service-account.json"
  );
}

function initEarthEngine(privateKey) {
  return new Promise((resolve, reject) => {
    ee.data.authenticateViaPrivateKey(
      privateKey,
      () =>
        ee.initialize(
          null,
          null,
          () => resolve(),
          (err) => reject(err)
        ),
      (err) => reject(err)
    );
  });
}

function eeToPromise(obj) {
  return new Promise((resolve, reject) =>
    obj.evaluate((result, error) =>
      error ? reject(error) : resolve(result)
    )
  );
}

// ----------------------------------------------------------------------------
// Raster download (Node-native, follows redirects — figshare redirects to S3)
// ----------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function download(url, dest, redirectsLeft = 6) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, { timeout: 180000 }, (res) => {
        // Redirect (figshare -> S3, etc.)
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          res.resume();
          file.close();
          fs.unlink(dest, () => {});
          if (redirectsLeft <= 0) return reject(new Error("Too many redirects"));
          return resolve(download(res.headers.location, dest, redirectsLeft - 1));
        }
        // 202 Accepted: figshare is still preparing the file — signal a retry.
        if (res.statusCode === 202) {
          res.resume();
          file.close();
          fs.unlink(dest, () => {});
          return reject(Object.assign(new Error("HTTP 202 (preparing)"), { retry: true }));
        }
        if (res.statusCode !== 200) {
          res.resume();
          file.close();
          fs.unlink(dest, () => {});
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve(true)));
      })
      .on("error", (err) => {
        file.close();
        fs.unlink(dest, () => {});
        reject(err);
      });
  });
}

async function ensureRaster() {
  // 1) Use an already-present raster if we can find one.
  const existing = resolveExistingRaster();
  if (existing) {
    console.log(`Raster already present: ${existing}`);
    return existing;
  }

  // 2) Otherwise try to download it (retrying figshare's 202 "preparing").
  for (const url of RASTER_URLS) {
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        console.log(`Downloading Köppen raster from: ${url} (attempt ${attempt})`);
        await download(url, RASTER_PATH);
        if (fs.statSync(RASTER_PATH).size > 1_000_000) {
          console.log(`  ✓ Saved to ${RASTER_PATH}`);
          return RASTER_PATH;
        }
      } catch (err) {
        console.warn(`  ✗ ${err.message}`);
        if (fs.existsSync(RASTER_PATH)) fs.unlinkSync(RASTER_PATH);
        if (err.retry) {
          await sleep(5000); // figshare needs a moment; poll again
          continue;
        }
        break; // non-retryable error → try next URL
      }
    }
  }

  throw new Error(
    "Could not download the Köppen raster. Download Beck_KG_V1_present_0p0083.tif " +
      "manually from https://figshare.com/articles/dataset/Present_Beck_KG_V1/6396959 " +
      `and place it at ${RASTER_PATH} (or leave the extracted Beck_KG_V1 folder in ${DATA_DIR}).`
  );
}

// ----------------------------------------------------------------------------
// Waterbody centroids from GEE
// ----------------------------------------------------------------------------
async function fetchWaterbodies() {
  const wb = ee.FeatureCollection(WB_ASSET);

  // Compute a centroid per waterbody, carry the attributes the UI needs.
  const withCentroids = wb.map((f) => {
    const c = f.geometry().centroid(1);
    return ee.Feature(c, {
      wb_new_id: f.get("wb_new_id"),
      lake_name: f.get("Lake_name"),
      country: f.get("country"),
      state: f.get("state"),
      city: f.get("city"),
      fpv_cov: f.get("fpv_cov"),
      wb_area: f.get("wb_area"),
      n_fpv: f.get("n_fpv"),
      lat: c.coordinates().get(1),
      lon: c.coordinates().get(0),
    });
  });

  const info = await eeToPromise(withCentroids.limit(20000));
  return (info.features || []).map((f) => f.properties || {});
}

// ----------------------------------------------------------------------------
// Raster sampling with geotiff.js (windowed 1x1 reads — cheap + memory safe)
// ----------------------------------------------------------------------------
async function sampleAll(waterbodies, rasterPath) {
  const { fromFile } = await import("geotiff");
  const tiff = await fromFile(rasterPath);
  const image = await tiff.getImage();

  const [originX, originY] = image.getOrigin();      // top-left corner
  const [resX, resY] = image.getResolution();        // resY is negative
  const width = image.getWidth();
  const height = image.getHeight();

  console.log(
    `Raster: ${width}x${height}, origin (${originX.toFixed(3)}, ${originY.toFixed(
      3
    )}), res (${resX}, ${resY})`
  );

  const out = {};
  let sampled = 0;
  let skipped = 0;

  for (const wbf of waterbodies) {
    const wbId = wbf.wb_new_id != null ? String(wbf.wb_new_id) : null;
    const lat = Number(wbf.lat);
    const lon = Number(wbf.lon);

    let koppen_code = null;
    if (wbId && Number.isFinite(lat) && Number.isFinite(lon)) {
      let col = Math.floor((lon - originX) / resX);
      let row = Math.floor((lat - originY) / resY);
      col = Math.min(Math.max(col, 0), width - 1);
      row = Math.min(Math.max(row, 0), height - 1);

      const raster = await image.readRasters({
        window: [col, row, col + 1, row + 1],
        interleave: true,
      });
      koppen_code = Number(raster[0]);
      sampled += 1;
    } else {
      skipped += 1;
    }

    const fiveClass = koppenTo5Class(koppen_code);
    if (wbId) {
      out[wbId] = {
        wb_new_id: wbId,
        lake_name: wbf.lake_name ?? null,
        country: wbf.country ?? null,
        state: wbf.state ?? null,
        city: wbf.city ?? null,
        fpv_cov: wbf.fpv_cov ?? null,
        wb_area: wbf.wb_area ?? null,
        n_fpv: wbf.n_fpv ?? null,
        lat: Number.isFinite(lat) ? lat : null,
        lon: Number.isFinite(lon) ? lon : null,
        koppen_code: koppen_code && koppen_code > 0 ? koppen_code : null,
        koppen_label: KOPPEN_CODE_LABELS[koppen_code] ?? null,
        koppen_5class: fiveClass,
        climate_zone: fiveClass ? FIVE_CLASS_TO_ZONE[fiveClass] : null,
      };
    }
  }

  console.log(`Sampled ${sampled} waterbodies (${skipped} skipped, no centroid).`);
  return out;
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------
async function main() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  console.log("Authenticating with Earth Engine...");
  await initEarthEngine(loadPrivateKey());
  console.log("  ✓ Earth Engine ready");

  const rasterPath = await ensureRaster();

  console.log("Fetching waterbody centroids from GEE...");
  const waterbodies = await fetchWaterbodies();
  console.log(`  ✓ ${waterbodies.length} waterbodies`);

  console.log("Sampling Köppen raster...");
  const cache = await sampleAll(waterbodies, rasterPath);

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(cache));
  console.log(`\nDone. Wrote ${Object.keys(cache).length} entries to ${OUTPUT_PATH}`);

  // Small climate-zone histogram for a sanity check.
  const hist = {};
  for (const v of Object.values(cache)) {
    const z = v.climate_zone || "Unknown";
    hist[z] = (hist[z] || 0) + 1;
  }
  console.log("Climate zone distribution:", hist);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error("\nBuild failed:", err.message || err);
    process.exit(1);
  }
);
