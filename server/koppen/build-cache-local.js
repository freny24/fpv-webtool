/**
 * build-cache-local.js — build the Köppen climate cache from a LOCAL waterbody
 * GeoJSON file, without Google Earth Engine.
 *
 * Use this when the dataset is updated: point it at the new WB GeoJSON and it
 * regenerates server/data/wb_cache.json (keyed by wb_id) by sampling the Beck
 * raster at each waterbody's lat/lon.
 *
 *   node koppen/build-cache-local.js /path/to/WB.geojson
 *
 * The raster (koppen_beck.tif) must be present in server/data/ (or the extracted
 * Beck_KG_V1 folder). The GeoJSON must carry wb_id, lat, lon and the v8 fields.
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const OUTPUT_PATH = path.join(DATA_DIR, "wb_cache.json");
const RASTER_CANDIDATES = [
  path.join(DATA_DIR, "koppen_beck.tif"),
  path.join(DATA_DIR, "Beck_KG_V1_present_0p0083.tif"),
  path.join(DATA_DIR, "Beck_KG_V1", "Beck_KG_V1_present_0p0083.tif"),
];

const KOPPEN_CODE_LABELS = {
  1: "Af", 2: "Am", 3: "Aw", 4: "BWh", 5: "BWk", 6: "BSh", 7: "BSk",
  8: "Csa", 9: "Csb", 10: "Csc", 11: "Cwa", 12: "Cwb", 13: "Cwc",
  14: "Cfa", 15: "Cfb", 16: "Cfc", 17: "Dsa", 18: "Dsb", 19: "Dsc", 20: "Dsd",
  21: "Dwa", 22: "Dwb", 23: "Dwc", 24: "Dwd", 25: "Dfa", 26: "Dfb", 27: "Dfc",
  28: "Dfd", 29: "ET", 30: "EF",
};
const FIVE_TO_ZONE = {
  A_Tropical: "Tropical", B_Arid: "Arid", C_Temperate: "Temperate",
  D_Cold: "Cold", E_Polar: "Polar",
};
function to5(code) {
  const c = Number(code);
  if (!c || c <= 0) return null;
  if (c <= 3) return "A_Tropical";
  if (c <= 7) return "B_Arid";
  if (c <= 16) return "C_Temperate";
  if (c <= 28) return "D_Cold";
  return "E_Polar";
}
function resolveRaster() {
  for (const p of RASTER_CANDIDATES) if (fs.existsSync(p)) return p;
  throw new Error(`Köppen raster not found in ${DATA_DIR}`);
}

async function main() {
  const geojsonPath = process.argv[2];
  if (!geojsonPath) {
    console.error("Usage: node koppen/build-cache-local.js /path/to/WB.geojson");
    process.exit(1);
  }

  const { fromFile } = await import("geotiff");
  const wb = JSON.parse(fs.readFileSync(geojsonPath, "utf8"));
  const tiff = await fromFile(resolveRaster());
  const image = await tiff.getImage();
  const [ox, oy] = image.getOrigin();
  const [rx, ry] = image.getResolution();
  const W = image.getWidth();
  const H = image.getHeight();

  // Read the whole band once (uint8), then index in-memory — far faster than
  // thousands of windowed reads.
  const band = (await image.readRasters({ interleave: true }));

  const out = {};
  let sampled = 0;
  const hist = {};
  for (const f of wb.features || []) {
    const p = f.properties || {};
    const id = p.wb_id != null ? String(p.wb_id) : null;
    if (!id) continue;
    const lat = Number(p.lat);
    const lon = Number(p.lon);
    let code = null;
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      let col = Math.min(Math.max(Math.floor((lon - ox) / rx), 0), W - 1);
      let row = Math.min(Math.max(Math.floor((lat - oy) / ry), 0), H - 1);
      code = Number(band[row * W + col]);
      sampled += 1;
    }
    const fc = to5(code);
    const zone = fc ? FIVE_TO_ZONE[fc] : null;
    hist[zone || "Unknown"] = (hist[zone || "Unknown"] || 0) + 1;
    out[id] = {
      wb_new_id: id,
      lake_name: p.lake_name ?? null,
      country: p.country ?? null,
      state: p.state ?? null,
      city: p.city ?? null,
      fpv_cov: p.aqpv_coverage_pct ?? null,
      wb_area: p.wb_area_km2 ?? null,
      n_fpv: p.n_installations ?? null,
      water_type: p.base_water_body_classification ?? null,
      functional_use: p.functional_use_classification ?? null,
      lat: Number.isFinite(lat) ? lat : null,
      lon: Number.isFinite(lon) ? lon : null,
      koppen_code: code && code > 0 ? code : null,
      koppen_label: KOPPEN_CODE_LABELS[code] ?? null,
      koppen_5class: fc,
      climate_zone: zone,
    };
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(out));
  console.log(`Wrote ${Object.keys(out).length} records to ${OUTPUT_PATH} (sampled ${sampled}).`);
  console.log("Climate zone distribution:", hist);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
