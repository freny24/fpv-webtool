/**
 * climate.js — Runtime Köppen climate helper for the API server.
 *
 * Loads the pre-built waterbody cache (server/data/wb_cache.json, produced by
 * koppen/build-cache.js) and exposes:
 *   - getWbInfo(wbId)        -> cached waterbody record (name/climate/coverage)
 *   - enrichFpv(fpv)         -> fpv object with lake_name + climate fields merged
 *   - matchClimateZone(q)    -> canonical zone name if the query names a climate
 *   - CLIMATE_ZONES          -> list of { zone, code5, synonyms }
 *   - sampleClimateAt(lat,lon) -> live raster sample for arbitrary points (async)
 *
 * Everything degrades gracefully: if the cache or raster is absent, climate
 * fields are simply null and the rest of the app is unaffected.
 */

const path = require("path");
const fs = require("fs");

const DATA_DIR = path.join(__dirname, "data");
const CACHE_PATH = path.join(DATA_DIR, "wb_cache.json");

const RASTER_CANDIDATES = [
  path.join(DATA_DIR, "koppen_beck.tif"),
  path.join(DATA_DIR, "Beck_KG_V1_present_0p0083.tif"),
  path.join(DATA_DIR, "Beck_KG_V1", "Beck_KG_V1_present_0p0083.tif"),
];

function resolveRasterPath() {
  for (const p of RASTER_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// ---- Köppen legend (shared with build-cache.js) ---------------------------
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

const FIVE_CLASS_TO_ZONE = {
  A_Tropical: "Tropical",
  B_Arid: "Arid",
  C_Temperate: "Temperate",
  D_Cold: "Cold",
  E_Polar: "Polar",
};

// Zones plus the words a user might search for each one.
const CLIMATE_ZONES = [
  { zone: "Tropical", code5: "A_Tropical", synonyms: ["tropical", "tropic", "equatorial", "humid", "rainforest", "monsoon"] },
  { zone: "Arid", code5: "B_Arid", synonyms: ["arid", "dry", "desert", "steppe", "semiarid", "semi-arid"] },
  { zone: "Temperate", code5: "C_Temperate", synonyms: ["temperate", "mild", "mediterranean", "oceanic", "subtropical", "warm"] },
  { zone: "Cold", code5: "D_Cold", synonyms: ["cold", "continental", "boreal", "snow", "subarctic"] },
  { zone: "Polar", code5: "E_Polar", synonyms: ["polar", "tundra", "ice", "arctic", "frost"] },
];

function koppenTo5Class(code) {
  if (code === null || code === undefined || Number.isNaN(Number(code)))
    return null;
  const c = Number(code);
  if (c <= 0) return null;
  if (c <= 3) return "A_Tropical";
  if (c <= 7) return "B_Arid";
  if (c <= 16) return "C_Temperate";
  if (c <= 28) return "D_Cold";
  return "E_Polar";
}

function describeCode(code) {
  const fiveClass = koppenTo5Class(code);
  return {
    koppen_code: code && code > 0 ? Number(code) : null,
    koppen_label: KOPPEN_CODE_LABELS[code] ?? null,
    koppen_5class: fiveClass,
    climate_zone: fiveClass ? FIVE_CLASS_TO_ZONE[fiveClass] : null,
  };
}

// ---- Cache load ------------------------------------------------------------
let WB_CACHE = {};
let cacheLoaded = false;

function loadCache() {
  if (cacheLoaded) return;
  cacheLoaded = true;
  try {
    if (fs.existsSync(CACHE_PATH)) {
      WB_CACHE = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8")) || {};
      console.log(
        `[climate] loaded ${Object.keys(WB_CACHE).length} waterbody climate records`
      );
    } else {
      console.warn(
        `[climate] ${CACHE_PATH} not found — climate fields will be null. ` +
          "Run `node koppen/build-cache.js` to build it."
      );
    }
  } catch (err) {
    console.error("[climate] failed to load cache:", err.message);
    WB_CACHE = {};
  }
}
loadCache();

function getWbInfo(wbId) {
  if (!wbId) return null;
  return WB_CACHE[String(wbId)] || null;
}

// Merge cached climate + waterbody name + coverage into an FPV point/response.
function enrichFpv(fpv) {
  if (!fpv) return fpv;
  const info = getWbInfo(fpv.wb_new_id);
  if (!info) return fpv;
  return {
    ...fpv,
    lake_name: fpv.lake_name ?? info.lake_name ?? null,
    fpv_cov: fpv.fpv_cov ?? info.fpv_cov ?? null,
    koppen_code: fpv.koppen_code ?? info.koppen_code ?? null,
    koppen_label: fpv.koppen_label ?? info.koppen_label ?? null,
    koppen_5class: fpv.koppen_5class ?? info.koppen_5class ?? null,
    climate_zone: fpv.climate_zone ?? info.climate_zone ?? null,
  };
}

// Return the canonical zone name if the query names a climate zone.
function matchClimateZone(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return null;
  for (const z of CLIMATE_ZONES) {
    if (z.zone.toLowerCase() === q) return z.zone;
    if (z.synonyms.some((s) => s === q || q.includes(s))) return z.zone;
  }
  return null;
}

// ---- Live raster sampling for arbitrary points (custom locations) ----------
let _tiffPromise = null;
function _openTiff() {
  if (!_tiffPromise) {
    _tiffPromise = (async () => {
      const rasterPath = resolveRasterPath();
      if (!rasterPath) return null;
      const { fromFile } = await import("geotiff");
      const tiff = await fromFile(rasterPath);
      const image = await tiff.getImage();
      return {
        image,
        origin: image.getOrigin(),
        res: image.getResolution(),
        width: image.getWidth(),
        height: image.getHeight(),
      };
    })().catch((err) => {
      console.warn("[climate] raster open failed:", err.message);
      return null;
    });
  }
  return _tiffPromise;
}

async function sampleClimateAt(lat, lon) {
  try {
    const t = await _openTiff();
    if (!t) return describeCode(null);
    const [originX, originY] = t.origin;
    const [resX, resY] = t.res;
    let col = Math.floor((Number(lon) - originX) / resX);
    let row = Math.floor((Number(lat) - originY) / resY);
    col = Math.min(Math.max(col, 0), t.width - 1);
    row = Math.min(Math.max(row, 0), t.height - 1);
    const raster = await t.image.readRasters({
      window: [col, row, col + 1, row + 1],
      interleave: true,
    });
    return describeCode(Number(raster[0]));
  } catch (err) {
    console.warn("[climate] sample failed:", err.message);
    return describeCode(null);
  }
}

module.exports = {
  KOPPEN_CODE_LABELS,
  FIVE_CLASS_TO_ZONE,
  CLIMATE_ZONES,
  koppenTo5Class,
  describeCode,
  getWbInfo,
  enrichFpv,
  matchClimateZone,
  sampleClimateAt,
  hasCache: () => Object.keys(WB_CACHE).length > 0,
};
