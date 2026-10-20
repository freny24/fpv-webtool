require("dotenv").config();

// Route outbound HTTPS (e.g. Google Earth Engine) through a data-center proxy
// when one is configured. AppKube sets HTTP_PROXY / HTTPS_PROXY for deployments;
// global-agent patches Node's http/https so outbound calls use the proxy.
if (process.env.HTTP_PROXY || process.env.HTTPS_PROXY) {
  process.env.GLOBAL_AGENT_HTTP_PROXY =
    process.env.GLOBAL_AGENT_HTTP_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.HTTPS_PROXY;
  process.env.GLOBAL_AGENT_HTTPS_PROXY =
    process.env.GLOBAL_AGENT_HTTPS_PROXY ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY;
  if (process.env.NO_PROXY) {
    process.env.GLOBAL_AGENT_NO_PROXY =
      process.env.GLOBAL_AGENT_NO_PROXY || process.env.NO_PROXY;
  }
  try {
    require("global-agent/bootstrap");
    console.log("Outbound proxy enabled via global-agent");
  } catch (err) {
    console.warn("global-agent not installed; proxy not applied:", err.message);
  }
}

const path = require("path");
const fs = require("fs");

function safeValue(v, fallback = null) {
  return v === undefined || v === null ? fallback : v;
}

function firstNonEmpty(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return null;
}

const express = require("express");
const cors = require("cors");
const ee = require("@google/earthengine");
const { getSubmissionsRouter } = require("./submissions");
const climate = require("./climate");

// GEE credentials: prefer an env var (used in production/Render), fall back
// to a local key file for local development.
let privateKey;
if (process.env.GEE_SERVICE_ACCOUNT_JSON) {
  privateKey = JSON.parse(process.env.GEE_SERVICE_ACCOUNT_JSON);
} else {
  const keyPath = path.join(__dirname, "gee-service-account.json");
  if (fs.existsSync(keyPath)) {
    privateKey = JSON.parse(fs.readFileSync(keyPath, "utf8"));
  } else {
    throw new Error(
      "Missing Earth Engine credentials: set GEE_SERVICE_ACCOUNT_JSON or provide server/gee-service-account.json"
    );
  }
}

const app = express();

// CORS: restrict to known origins in production via ALLOWED_ORIGINS
// (comma-separated). Falls back to "allow all" for local dev.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors(
    allowedOrigins.length > 0
      ? {
          origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
              callback(null, true);
            } else {
              callback(new Error("Not allowed by CORS"));
            }
          },
        }
      : {}
  )
);
app.use(express.json());

const PORT = process.env.PORT || 3001;

// v8 "Aquatic Solar" (AqPV) assets. Fields: arrays use aqpv_id/aqpv_area_km2/
// wb_id/structural_classification/install_date; waterbodies use wb_id/
// wb_area_km2/aqpv_coverage_pct/n_installations/lake_name/functional_use_*.
const FPV_ASSET = "projects/spheric-mesh-330606/assets/AqPV_for_gee";
const WB_ASSET = "projects/spheric-mesh-330606/assets/WB_for_gee";

const MIN_S2_AREA_KM2 = 0.1;
const MIN_L8_AREA_KM2 = 0.15;

const S2_INNER_BUFFER_M = -20;
const L8_INNER_BUFFER_M = -100;

const MIN_VALID_PIXELS = 10;

const SMALL_LAKE_MESSAGE =
  "Data unavailable — this lake is too small for reliable satellite measurements";

function eeObjectToPromise(obj) {
  return new Promise((resolve, reject) => {
    obj.evaluate((result, error) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

// -------------------- USER CONTRIBUTIONS --------------------

app.use(
  "/api/submissions",
  getSubmissionsRouter({ ee, FPV_ASSET, eeObjectToPromise })
);

function initializeEarthEngine() {
  return new Promise((resolve, reject) => {
    ee.data.authenticateViaPrivateKey(
      privateKey,
      () => {
        ee.initialize(
          null,
          null,
          () => {
            console.log("Earth Engine initialized successfully");
            resolve();
          },
          (initErr) => reject(initErr)
        );
      },
      (authErr) => reject(authErr)
    );
  });
}

// -------------------- TILE ROUTES --------------------

app.get("/api/fpv-tiles", async (req, res) => {
  try {
    const fpvFc = ee.FeatureCollection(FPV_ASSET);

    const fpvImage = ee.Image().byte().paint({
      featureCollection: fpvFc,
      color: 1,
      width: 2,
    });

    fpvImage.getMap(
      {
        palette: ["#ffd400"],
        opacity: 0.95,
      },
      (mapInfo, err) => {
        if (err) {
          console.error("FPV tiles error:", err);
          return res.status(500).json({ error: err.message || String(err) });
        }

        res.json({ tileUrl: mapInfo.urlFormat });
      }
    );
  } catch (err) {
    console.error("FPV tile route error:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.get("/api/waterbody-tiles", async (req, res) => {
  try {
    const wbFc = ee.FeatureCollection(WB_ASSET);

    const wbImage = ee.Image().byte().paint({
      featureCollection: wbFc,
      color: 1,
      width: 2,
    });

    wbImage.getMap(
      {
        palette: ["#2e9bff"],
        opacity: 0.95,
      },
      (mapInfo, err) => {
        if (err) {
          console.error("Waterbody tiles error:", err);
          return res.status(500).json({ error: err.message || String(err) });
        }

        res.json({ tileUrl: mapInfo.urlFormat });
      }
    );
  } catch (err) {
    console.error("Waterbody tile route error:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// -------------------- IDENTIFY --------------------

app.get("/api/fpv-identify", async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: "Invalid lat/lng" });
    }

    const fpv = ee.FeatureCollection(FPV_ASSET);
    const wb = ee.FeatureCollection(WB_ASSET);

    const pt = ee.Geometry.Point([lng, lat]);

    // Small buffer makes clicking easier on web map.
    const hit = fpv.filterBounds(pt.buffer(150)).first();

    hit.evaluate(async (f, err) => {
      if (err) {
        console.error("FPV identify error:", err);
        return res.status(500).json({ error: err.message || String(err) });
      }

      if (!f) {
        return res.json({ found: false });
      }

      const p = f.properties || {};

      const wbRaw = firstNonEmpty(p.wb_id, p.wb_ids);
      const wbId = wbRaw ? String(wbRaw).split(",")[0].trim() : null;

      let fpvResponse = {
        fpv_new_id: safeValue(p.aqpv_id),
        fpv_id: safeValue(p.aqpv_id),
        id: safeValue(p.aqpv_id),
        wb_new_id: safeValue(wbId),
        country: safeValue(p.country),
        state: safeValue(p.state),
        city: safeValue(p.city),
        lat: safeValue(p.lat),
        lon: safeValue(p.lon),
        fpv_area_k: safeValue(p.aqpv_area_km2),
        wb_interse: safeValue(p.aqpv_area_inside_km2),
        structural_classification: safeValue(p.structural_classification),
        install_date: safeValue(p.install_date),
        install_date_confidence: safeValue(p.install_date_confidence),
      };

      // Merge cached climate + waterbody name via the FPV's waterbody id.
      fpvResponse = climate.enrichFpv(fpvResponse);

      if (!wbId) {
        // No waterbody link: sample the Köppen raster directly at the point so
        // the climate zone is still available in the panel / search.
        const latN = Number(p.lat != null ? p.lat : lat);
        const lonN = Number(p.lon != null ? p.lon : lng);
        const clim = await climate.sampleClimateAt(latN, lonN);
        return res.json({
          found: true,
          fpv: { ...fpvResponse, ...clim },
          waterbody: null,
        });
      }

      const wbHit = wb.filter(ee.Filter.eq("wb_id", wbId)).limit(1).first();

      wbHit.evaluate((wbf, wbErr) => {
        if (wbErr) {
          console.error("WB identify error:", wbErr);
          return res.status(500).json({ error: wbErr.message || String(wbErr) });
        }

        const wbp = (wbf && wbf.properties) || null;

        const wbClimate = climate.getWbInfo(wbId) || {};

        const waterbodyResponse = wbp
          ? {
              wb_new_id: safeValue(wbp.wb_id),
              lake_name: safeValue(wbp.lake_name),
              country: safeValue(wbp.country),
              state: safeValue(wbp.state),
              city: safeValue(wbp.city),
              lat: safeValue(wbp.lat),
              lon: safeValue(wbp.lon),
              wb_area: safeValue(wbp.wb_area_km2),
              wb_area_af: safeValue(wbp.open_water_area_km2),
              fpv_area: safeValue(wbp.aqpv_area_inside_km2),
              fpv_cov: safeValue(wbp.aqpv_coverage_pct),
              n_fpv: safeValue(wbp.n_installations),
              fpv_ids: safeValue(wbp.aqpv_ids),
              hylak_id: safeValue(wbp.hylak_id),
              depth_avg: safeValue(wbp.depth_avg),
              depth_avg_reliable: safeValue(wbp.depth_avg_reliable),
              lake_type: safeValue(wbp.lake_type),
              water_type: safeValue(wbp.base_water_body_classification),
              functional_use: safeValue(wbp.functional_use_classification),
              koppen_code: safeValue(wbClimate.koppen_code),
              koppen_label: safeValue(wbClimate.koppen_label),
              koppen_5class: safeValue(wbClimate.koppen_5class),
              climate_zone: safeValue(wbClimate.climate_zone),
            }
          : null;

        return res.json({
          found: true,
          fpv: fpvResponse,
          waterbody: waterbodyResponse,
        });
      });
    });
  } catch (err) {
    console.error("Identify route failed:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// -------------------- SEARCH --------------------

app.get("/api/fpv-search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().toLowerCase();

    if (!q) return res.json({ results: [] });

    const isLatLon = q.includes(",") && q.split(",").length === 2;

    if (isLatLon) {
      const [latStr, lonStr] = q.split(",");
      const lat = Number(latStr.trim());
      const lon = Number(lonStr.trim());

      if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
        return res.json({
          results: [
            {
              id: "custom-location",
              lat,
              lon,
              label: `📍 ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
            },
          ],
        });
      }
    }

    const fpvFc = ee.FeatureCollection(FPV_ASSET).limit(5000);
    const info = await eeObjectToPromise(fpvFc);

    // If the query names a climate zone (e.g. "tropical", "arid"), match on the
    // cached Köppen zone instead of the text haystack.
    const zoneQuery = climate.matchClimateZone(q);

    const results = (info?.features || [])
      .map((f) => f.properties || {})
      .filter((p) => {
        const wbInfo = climate.getWbInfo(p.wb_id) || {};

        if (zoneQuery) {
          return wbInfo.climate_zone === zoneQuery;
        }

        const haystack = [
          p.aqpv_id,
          p.country,
          p.state,
          p.city,
          p.wb_id,
          p.structural_classification,
          wbInfo.lake_name,
          wbInfo.koppen_label,
          wbInfo.climate_zone,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(q);
      })
      .slice(0, 12)
      .map((p) => {
        const wbInfo = climate.getWbInfo(p.wb_id) || {};
        return {
          id: p.aqpv_id,
          fpv_new_id: p.aqpv_id || null,
          wb_new_id: p.wb_id || null,
          lat: p.lat,
          lon: p.lon,
          country: p.country,
          state: p.state,
          city: p.city,
          lake_name: wbInfo.lake_name || null,
          fpv_cov: wbInfo.fpv_cov ?? null,
          structural_classification: p.structural_classification || null,
          koppen_label: wbInfo.koppen_label || null,
          climate_zone: wbInfo.climate_zone || null,
          label: `${p.aqpv_id || "AqPV"} • ${p.city || ""}, ${
            p.state || ""
          }, ${p.country || ""}`.trim(),
        };
      });

    res.json({ results, zone: zoneQuery || null });
  } catch (err) {
    console.error("fpv-search error:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// -------------------- OVERVIEW --------------------

app.get("/api/fpv-overview", async (req, res) => {
  try {
    const fc = ee.FeatureCollection(FPV_ASSET);

    // Use the stored representative point (lat/lon) to avoid a costly centroid
    // computation over 3,000+ polygons; fall back to centroid only if missing.
    const points = fc.map((f) => {
      const centroid = f.geometry().centroid(1);
      return ee.Feature(centroid, {
        fpv_new_id: f.get("aqpv_id"),
        id: f.get("aqpv_id"),
        wb_new_id: f.get("wb_id"),
        country: f.get("country"),
        state: f.get("state"),
        city: f.get("city"),
        lat: f.get("lat"),
        lon: f.get("lon"),
        fpv_area_k: f.get("aqpv_area_km2"),
        structural_classification: f.get("structural_classification"),
      });
    });

    const result = await eeObjectToPromise(points.limit(6000));

    // Attach cached waterbody name + coverage + classifications + Köppen climate
    // so the frontend can run instant search + filters without extra calls.
    res.json({
      points: (result.features || []).map((f) => {
        const p = f.properties || {};
        const wbInfo = climate.getWbInfo(p.wb_new_id) || {};
        return {
          ...p,
          lake_name: wbInfo.lake_name || null,
          fpv_cov: wbInfo.fpv_cov ?? null,
          water_type: wbInfo.water_type || null,
          functional_use: wbInfo.functional_use || null,
          koppen_code: wbInfo.koppen_code ?? null,
          koppen_label: wbInfo.koppen_label || null,
          koppen_5class: wbInfo.koppen_5class || null,
          climate_zone: wbInfo.climate_zone || null,
        };
      }),
    });
  } catch (err) {
    console.error("fpv-overview error:", err);
    res.status(500).json({ error: err.message });
  }
});
function buildCleanGeometry(wbFeature, fpvFc, bufferMeters) {
  const rawGeom = wbFeature.geometry();

  const panelsHere = fpvFc.filterBounds(rawGeom);
  const panelsUnion = panelsHere.geometry();

  let geomNoFpv = rawGeom.difference(panelsUnion, 1);
  const fpvSubtractOk = geomNoFpv.area(1).gt(0);

  geomNoFpv = ee.Geometry(
    ee.Algorithms.If(fpvSubtractOk, geomNoFpv, rawGeom)
  );

  const buffered = geomNoFpv.buffer(bufferMeters, 1);
  const bufferOk = buffered.area(1).gt(500);

  const cleanGeom = ee.Geometry(
    ee.Algorithms.If(bufferOk, buffered, geomNoFpv)
  );

  const geomFlag = ee.String(
    ee.Algorithms.If(
      fpvSubtractOk.and(bufferOk),
      "ok",
      ee.Algorithms.If(
        fpvSubtractOk.not().and(bufferOk.not()),
        "fpv_and_buffer_failed",
        ee.Algorithms.If(
          fpvSubtractOk.not(),
          "fpv_subtract_failed",
          "buffer_failed"
        )
      )
    )
  );

  return { cleanGeom, geomFlag };
}

// -------------------- ENVIRONMENTAL METRICS --------------------

app.get("/api/fpv-metrics", async (req, res) => {
  try {
    console.log("NEW METRICS ROUTE ACTIVE");
    const wbId = String(req.query.wb_new_id || "").trim();
    const start = req.query.start || "2023-07-01";
    const end = req.query.end || "2023-08-01";

    if (!wbId) {
      return res.status(400).json({ error: "wb_new_id is required" });
    }

    const fpvFc = ee.FeatureCollection(FPV_ASSET);
    const wbFc = ee.FeatureCollection(WB_ASSET);

    const wbFeature = ee.Feature(
      wbFc.filter(ee.Filter.eq("wb_id", wbId)).first()
    );

  const wbInfo = await eeObjectToPromise(wbFeature);
const wbProps = wbInfo?.properties || {};

const wbAreaAf = Number(wbProps.open_water_area_km2 ?? wbProps.wb_area_km2 ?? 0);

const s2Allowed = wbAreaAf > MIN_S2_AREA_KM2;
const l8Allowed = wbAreaAf > MIN_L8_AREA_KM2;

const s2GeomObj = buildCleanGeometry(wbFeature, fpvFc, S2_INNER_BUFFER_M);
const l8GeomObj = buildCleanGeometry(wbFeature, fpvFc, L8_INNER_BUFFER_M);

const s2CleanGeom = s2GeomObj.cleanGeom;
const l8CleanGeom = l8GeomObj.cleanGeom;

const s2GeomFlag = s2GeomObj.geomFlag;
const l8GeomFlag = l8GeomObj.geomFlag;

    const statReducer = ee.Reducer.median()
      .combine(ee.Reducer.mean(), "", true)
      .combine(ee.Reducer.min(), "", true)
      .combine(ee.Reducer.max(), "", true)
      .combine(ee.Reducer.count(), "", true);

    function prepS2(img) {
      const scl = img.select("SCL");

      const valid = scl
        .remap(
          [3, 4, 5, 6, 7, 8, 9, 10, 11],
          [0, 1, 1, 1, 1, 0, 0, 0, 0]
        )
        .eq(1);

      img = img.updateMask(valid);

      const mndwi = img
        .select("B3")
        .subtract(img.select("B11"))
        .divide(img.select("B3").add(img.select("B11")).add(1e-6));

      const waterMask = mndwi.gt(0.0);

      const ndci = img.normalizedDifference(["B5", "B4"]).rename("ndci");

      const chla = ndci
        .expression("13.55 + 87.99 * ndci + 212.609 * ndci * ndci", {
          ndci,
        })
        .rename("chla");

      return ee.Image([
        ndci.updateMask(waterMask),
        chla.updateMask(waterMask),
      ]).copyProperties(img, ["system:time_start"]);
    }

    function prepL8(img) {
      const qa = img.select("QA_PIXEL");

      const clear = qa
        .bitwiseAnd(1 << 1)
        .eq(0)
        .and(qa.bitwiseAnd(1 << 2).eq(0))
        .and(qa.bitwiseAnd(1 << 3).eq(0))
        .and(qa.bitwiseAnd(1 << 4).eq(0))
        .and(qa.bitwiseAnd(1 << 5).eq(0))
        .and(qa.rightShift(8).bitwiseAnd(3).lt(2))
        .and(qa.rightShift(10).bitwiseAnd(3).lt(2))
        .and(qa.rightShift(12).bitwiseAnd(3).lt(2))
        .and(qa.rightShift(14).bitwiseAnd(3).lt(2));

      const green = img.select("SR_B3").multiply(0.0000275).add(-0.2);
      const swir1 = img.select("SR_B6").multiply(0.0000275).add(-0.2);

      const mndwi = green.subtract(swir1).divide(green.add(swir1).add(1e-6));
      const water = mndwi.gt(0.0);

      const wst = img
        .select("ST_B10")
        .multiply(0.00341802)
        .add(149.0)
        .subtract(273.15)
        .rename("WST");

      return wst
        .updateMask(clear)
        .updateMask(water)
        .copyProperties(img, ["system:time_start"]);
    }

    function getS2Stats(rangeStart, rangeEnd) {
      const s2Col = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(s2CleanGeom)
        .filterDate(rangeStart, rangeEnd)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 60))
        .map(prepS2)
        .select(["ndci", "chla"]);

      const img = ee.Image(
        ee.Algorithms.If(
          s2Col.size().gt(0),
          s2Col.median(),
          ee.Image.constant([0, 0])
            .rename(["ndci", "chla"])
            .updateMask(ee.Image.constant(0))
        )
      );

      return img.reduceRegion({
        reducer: statReducer,
        geometry: s2CleanGeom,
        scale: 20,
        bestEffort: true,
        maxPixels: 1e13,
      });
    }

    function getWstStats(rangeStart, rangeEnd) {
      const l8Col = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
        .filterBounds(l8CleanGeom)
        .filterDate(rangeStart, rangeEnd)
        .map(prepL8)
        .select("WST");

      const img = ee.Image(
        ee.Algorithms.If(
          l8Col.size().gt(0),
          l8Col.median().rename("WST"),
          ee.Image.constant(-9999)
            .rename("WST")
            .updateMask(ee.Image.constant(0))
        )
      );

      return img.reduceRegion({
        reducer: statReducer,
        geometry: l8CleanGeom,
        scale: 30,
        bestEffort: true,
        maxPixels: 1e13,
      });
    }

    const startDate = ee.Date(start);
    const rawEndDate = ee.Date(end);

    const endDate = ee.Date(
      ee.Algorithms.If(
        rawEndDate.millis().lte(startDate.millis()),
        startDate.advance(1, "month"),
        rawEndDate
      )
    );

    const s2Stats = getS2Stats(startDate, endDate);
    const wstStats = getWstStats(startDate, endDate);

    const nMonths = ee.Number(endDate.difference(startDate, "month"))
      .ceil()
      .max(1)
      .min(24);

    const months = ee.List.sequence(0, nMonths.subtract(1));

    const monthlyFc = ee.FeatureCollection(
      months.map(function (m) {
        m = ee.Number(m);
        const mStart = startDate.advance(m, "month");
        const mEnd = mStart.advance(1, "month");

        const s2 = getS2Stats(mStart, mEnd);
        const wst = getWstStats(mStart, mEnd);

        return ee.Feature(null, {
          date: mStart.format("YYYY-MM"),
          ndci: s2.get("ndci_median"),
          chla: s2.get("chla_median"),
          wst: wst.get("WST_median"),
        });
      })
    );

    const [s2Info, wstInfo, seriesInfo, s2GeomFlagInfo, l8GeomFlagInfo] =
  await Promise.all([
    eeObjectToPromise(s2Stats),
    eeObjectToPromise(wstStats),
    eeObjectToPromise(monthlyFc),
    eeObjectToPromise(s2GeomFlag),
    eeObjectToPromise(l8GeomFlag),
  ]);
  const rows = (seriesInfo?.features || []).map((f) => f.properties || {});

  const s2PixelCount = Number(s2Info?.ndci_count ?? 0);
  const l8PixelCount = Number(wstInfo?.WST_count ?? 0);

  const useS2 = s2Allowed && s2PixelCount >= MIN_VALID_PIXELS;
  const useL8 = l8Allowed && l8PixelCount >= MIN_VALID_PIXELS;
   
    res.json({
  geometry_note: {
    sentinel2: useS2 ? s2GeomFlagInfo : SMALL_LAKE_MESSAGE,
    landsat8: useL8 ? l8GeomFlagInfo : SMALL_LAKE_MESSAGE,
  },

  warning:
    "Chlorophyll-a is an uncalibrated satellite proxy derived from NDCI. Use for relative comparison only.",

  ndci: useS2
    ? {
        median: s2Info?.ndci_median ?? null,
        mean: s2Info?.ndci_mean ?? null,
        min: s2Info?.ndci_min ?? null,
        max: s2Info?.ndci_max ?? null,
        count: s2Info?.ndci_count ?? null,
      }
    : {
        median: null,
        mean: null,
        min: null,
        max: null,
        count: s2PixelCount,
        message: SMALL_LAKE_MESSAGE,
      },

  chla: useS2
    ? {
        median: s2Info?.chla_median ?? null,
        mean: s2Info?.chla_mean ?? null,
        min: s2Info?.chla_min ?? null,
        max: s2Info?.chla_max ?? null,
        count: s2Info?.chla_count ?? null,
      }
    : {
        median: null,
        mean: null,
        min: null,
        max: null,
        count: s2PixelCount,
        message: SMALL_LAKE_MESSAGE,
      },

  wst: useL8
    ? {
        median: wstInfo?.WST_median ?? null,
        mean: wstInfo?.WST_mean ?? null,
        min: wstInfo?.WST_min ?? null,
        max: wstInfo?.WST_max ?? null,
        count: wstInfo?.WST_count ?? null,
      }
    : {
        median: null,
        mean: null,
        min: null,
        max: null,
        count: l8PixelCount,
        message: SMALL_LAKE_MESSAGE,
      },

  ndci_series: useS2
    ? rows
        .filter((r) => r.ndci !== null && r.ndci !== undefined)
        .map((r) => ({ date: r.date, value: r.ndci }))
    : [],

  chla_series: useS2
    ? rows
        .filter((r) => r.chla !== null && r.chla !== undefined)
        .map((r) => ({ date: r.date, value: r.chla }))
    : [],

  wst_series: useL8
    ? rows
        .filter((r) => r.wst !== null && r.wst !== undefined)
        .map((r) => ({ date: r.date, value: r.wst }))
    : [],
});
  } catch (err) {
    console.error("fpv-metrics error:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});
app.get("/api/environmental-layer", async (req, res) => {
  try {
    const wbId = String(req.query.wb_new_id || "").trim();
    const layer = String(req.query.layer || "ndci");
    const min = Number(req.query.min);
    const max = Number(req.query.max);

    if (!wbId) {
      return res.status(400).json({ error: "wb_new_id is required" });
    }

    const start = req.query.start || "2023-07-01";
    const end = req.query.end || "2023-08-01";

    const fpvFc = ee.FeatureCollection(FPV_ASSET);
    const wbFc = ee.FeatureCollection(WB_ASSET);

    const wbFeature = ee.Feature(
      wbFc.filter(ee.Filter.eq("wb_id", wbId)).first()
    );

  const wbInfo = await eeObjectToPromise(wbFeature);
const wbProps = wbInfo?.properties || {};
const wbAreaAf = Number(wbProps.wb_area_af ?? wbProps.wb_area ?? 0);

if ((layer === "ndci" || layer === "chla") && wbAreaAf <= MIN_S2_AREA_KM2) {
  return res.status(400).json({ error: SMALL_LAKE_MESSAGE });
}

if (layer === "wst" && wbAreaAf <= MIN_L8_AREA_KM2) {
  return res.status(400).json({ error: SMALL_LAKE_MESSAGE });
}

const bufferMeters =
  layer === "wst" ? L8_INNER_BUFFER_M : S2_INNER_BUFFER_M;

const { cleanGeom } = buildCleanGeometry(wbFeature, fpvFc, bufferMeters);

    function prepS2(img) {
      const scl = img.select("SCL");

      const valid = scl
        .remap(
          [3, 4, 5, 6, 7, 8, 9, 10, 11],
          [0, 1, 1, 1, 1, 0, 0, 0, 0]
        )
        .eq(1);

      img = img.updateMask(valid);

      const mndwi = img
        .select("B3")
        .subtract(img.select("B11"))
        .divide(img.select("B3").add(img.select("B11")).add(1e-6));

      const waterMask = mndwi.gt(0.0);

      const ndci = img.normalizedDifference(["B5", "B4"]).rename("ndci");

      const chla = ndci
        .expression("13.55 + 87.99 * ndci + 212.609 * ndci * ndci", {
          ndci,
        })
        .rename("chla");

      return ee.Image([
        ndci.updateMask(waterMask),
        chla.updateMask(waterMask),
      ]);
    }

    function prepL8(img) {
      const qa = img.select("QA_PIXEL");

      const clear = qa
        .bitwiseAnd(1 << 1)
        .eq(0)
        .and(qa.bitwiseAnd(1 << 2).eq(0))
        .and(qa.bitwiseAnd(1 << 3).eq(0))
        .and(qa.bitwiseAnd(1 << 4).eq(0))
        .and(qa.bitwiseAnd(1 << 5).eq(0));

      const green = img.select("SR_B3").multiply(0.0000275).add(-0.2);
      const swir1 = img.select("SR_B6").multiply(0.0000275).add(-0.2);
      const mndwi = green.subtract(swir1).divide(green.add(swir1).add(1e-6));
      const water = mndwi.gt(0.0);

      const wst = img
        .select("ST_B10")
        .multiply(0.00341802)
        .add(149.0)
        .subtract(273.15)
        .rename("wst");

      return wst.updateMask(clear).updateMask(water);
    }

    let image;

    if (layer === "wst") {
      image = ee
        .ImageCollection("LANDSAT/LC08/C02/T1_L2")
        .filterBounds(cleanGeom)
        .filterDate(start, end)
        .map(prepL8)
        .median()
        .clip(cleanGeom);
    } else {
      const s2 = ee
        .ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(cleanGeom)
        .filterDate(start, end)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 60))
        .map(prepS2)
        .median()
        .clip(cleanGeom);

      image = layer === "chla" ? s2.select("chla") : s2.select("ndci");
    }

    const visParams = {
      min: Number.isNaN(min) ? -0.05 : min,
      max: Number.isNaN(max) ? 0.2 : max,
      palette: ["2166ac", "67a9cf", "d1e5f0", "fddbc7", "ef8a62", "b2182b"],
    };

    image.getMap(visParams, (mapInfo, err) => {
      if (err) {
        console.error("environmental-layer error:", err);
        return res.status(500).json({ error: err.message || String(err) });
      }

      res.json({ tileUrl: mapInfo.urlFormat });
    });
  } catch (err) {
    console.error("environmental-layer route failed:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});
// -------------------- DOWNLOAD --------------------

app.get("/api/fpv-download", async (req, res) => {
  try {
    const id = req.query.id;

    if (!id) return res.status(400).json({ error: "id is required" });

    const fpvFc = ee.FeatureCollection(FPV_ASSET);

    const feature = fpvFc.filter(ee.Filter.eq("aqpv_id", id)).limit(1).first();

    const info = await eeObjectToPromise(feature);

    if (!info || !info.properties) {
      return res.status(404).json({ error: "AqPV not found" });
    }

    const downloadName = info.properties.aqpv_id || id;

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${downloadName}.json"`
    );
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(info.properties, null, 2));
  } catch (err) {
    console.error("fpv-download error:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// -------------------- SENTINEL-2 IMAGERY --------------------

app.get("/api/sentinel-layer", async (req, res) => {
  try {
    const start = req.query.start;
    const end = req.query.end;
    const mode = String(req.query.mode || "truecolor");

    if (!start || !end) {
      return res.status(400).json({ error: "start and end are required" });
    }

    // Per-pixel cloud/shadow/cirrus mask using the Scene Classification band
    // (SCL). Removing bad pixels *before* compositing is what turns the muddy
    // blur into a clean image.
    const maskS2 = (img) => {
      const scl = img.select("SCL");
      const clear = scl
        .neq(3) // cloud shadow
        .and(scl.neq(8)) // cloud, medium probability
        .and(scl.neq(9)) // cloud, high probability
        .and(scl.neq(10)); // thin cirrus
      return img.updateMask(clear).copyProperties(img, ["system:time_start"]);
    };

    const col = ee
      .ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
      .filterDate(start, end)
      .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 60))
      .map(maskS2);

    // Median of the cloud-masked stack = a clean, cloud-free composite for the
    // selected window.
    const composite = col.median();

    // True colour: B4/B3/B2. SWIR false colour: B11/B12/B8A (panels stand out).
    const visParams =
      mode === "swir"
        ? { bands: ["B11", "B12", "B8A"], min: 100, max: 3500 }
        : { bands: ["B4", "B3", "B2"], min: 0, max: 3000 };

    composite.getMap(visParams, (mapInfo, err) => {
      if (err) {
        console.error("sentinel-layer error:", err);
        return res.status(500).json({ error: err.message || String(err) });
      }
      res.json({ tileUrl: mapInfo.urlFormat });
    });
  } catch (err) {
    console.error("sentinel-layer route failed:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// -------------------- SERVE FRONTEND (single-app deploy) --------------------
// When the built frontend (dist/) is present, this same server serves the
// website plus the API (AppKube runs one app). Any non-/api GET falls back to
// index.html so client-side routing works. Harmless when dist/ is absent
// (e.g. the split frontend/backend container setup).

const DIST_DIR = path.join(__dirname, "..", "dist");
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      return res.sendFile(path.join(DIST_DIR, "index.html"));
    }
    next();
  });
  console.log(`Serving frontend from ${DIST_DIR}`);
}

// -------------------- START SERVER --------------------

initializeEarthEngine()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start server because EE auth failed:", err);
    process.exit(1);
  });