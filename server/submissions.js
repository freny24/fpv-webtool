const path = require("path");
const fs = require("fs");
const express = require("express");

// ---- storage setup ----
// Plain JSON file store — no native dependencies, so it builds reliably on
// any host. NOTE: on most free hosting tiers (e.g. Render's free plan) the
// local filesystem is ephemeral and gets wiped on redeploy/restart. For a
// class prototype that's usually fine, but if you need submissions to
// survive redeploys, attach a Render persistent disk mounted at DATA_DIR
// (see DEPLOYMENT.md) or swap this out for a hosted DB later.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "submissions.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ nextId: 1, records: [] }, null, 2));
}

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch (err) {
    console.error("Failed to read submissions store, resetting:", err.message);
    return { nextId: 1, records: [] };
  }
}

function writeStore(store) {
  fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2));
}

// ---- helpers ----

const DUPLICATE_RADIUS_METERS = 300;

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function findDuplicates({ lat, lon, ee, FPV_ASSET, eeObjectToPromise }) {
  const notes = [];

  // 1. Check against already-submitted entries (pending or approved).
  const { records } = readStore();
  for (const row of records) {
    if (row.status === "rejected") continue;
    const dist = haversineMeters(lat, lon, row.lat, row.lon);
    if (dist <= DUPLICATE_RADIUS_METERS) {
      notes.push(
        `Within ${Math.round(dist)}m of submission #${row.id} (${row.status})`
      );
    }
  }

  // 2. Check against the existing verified FPV dataset in Earth Engine.
  try {
    const pt = ee.Geometry.Point([lon, lat]);
    const nearby = ee
      .FeatureCollection(FPV_ASSET)
      .filterBounds(pt.buffer(DUPLICATE_RADIUS_METERS));
    const count = await eeObjectToPromise(nearby.size());
    if (count > 0) {
      notes.push(
        `Within ${DUPLICATE_RADIUS_METERS}m of an existing verified FPV site in the dataset`
      );
    }
  } catch (err) {
    // Don't block a submission just because the live duplicate check
    // against Earth Engine failed — log it and rely on the local check.
    console.error("EE duplicate check failed:", err.message || err);
  }

  return notes;
}

function requireAdmin(req, res, next) {
  const adminKey = process.env.ADMIN_KEY;

  if (!adminKey) {
    return res
      .status(503)
      .json({ error: "Admin review is not configured (ADMIN_KEY not set)" });
  }

  if (req.get("x-admin-key") !== adminKey) {
    return res.status(401).json({ error: "Invalid or missing admin key" });
  }

  next();
}

// ---- router ----

function getSubmissionsRouter({ ee, FPV_ASSET, eeObjectToPromise }) {
  const router = express.Router();

  // Public: submit a new FPV site.
  router.post("/", async (req, res) => {
    try {
      const { lat, lon, name, country, source, notes, email } = req.body || {};

      const latNum = Number(lat);
      const lonNum = Number(lon);

      if (
        Number.isNaN(latNum) ||
        Number.isNaN(lonNum) ||
        latNum < -90 ||
        latNum > 90 ||
        lonNum < -180 ||
        lonNum > 180
      ) {
        return res.status(400).json({ error: "Valid lat/lon are required" });
      }

      if (!source || !String(source).trim()) {
        return res
          .status(400)
          .json({ error: "A source (how you know about this site) is required" });
      }

      const duplicateNotes = await findDuplicates({
        lat: latNum,
        lon: lonNum,
        ee,
        FPV_ASSET,
        eeObjectToPromise,
      });

      const store = readStore();

      // Optional contributor email (light validation — never blocks a submit).
      const emailClean =
        email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
          ? String(email).trim()
          : null;

      const record = {
        id: store.nextId,
        lat: latNum,
        lon: lonNum,
        name: name || null,
        country: country || null,
        source: String(source).trim(),
        notes: notes || null,
        email: emailClean,
        status: "pending",
        duplicate_flag: duplicateNotes.length > 0,
        duplicate_note: duplicateNotes.length > 0 ? duplicateNotes.join("; ") : null,
        review_note: null,
        created_at: new Date().toISOString(),
        reviewed_at: null,
      };

      store.records.push(record);
      store.nextId += 1;
      writeStore(store);

      res.status(201).json({ submission: record });
    } catch (err) {
      console.error("Create submission error:", err);
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  // Public: approved submissions, shown on the map as community-contributed sites.
  router.get("/approved", (req, res) => {
    const { records } = readStore();
    const approved = records
      .filter((r) => r.status === "approved")
      .sort((a, b) => (b.reviewed_at || "").localeCompare(a.reviewed_at || ""))
      .map(({ id, lat, lon, name, country, source, created_at, reviewed_at }) => ({
        id,
        lat,
        lon,
        name,
        country,
        source,
        created_at,
        reviewed_at,
      }));

    res.json({ submissions: approved });
  });

  // Admin: list submissions by status (default: pending).
  router.get("/", requireAdmin, (req, res) => {
    const status = String(req.query.status || "pending");
    const { records } = readStore();

    const rows = (
      status === "all" ? records : records.filter((r) => r.status === status)
    ).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

    res.json({ submissions: rows });
  });

  // Admin: approve a submission.
  router.post("/:id/approve", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const store = readStore();
    const record = store.records.find((r) => r.id === id);

    if (!record) {
      return res.status(404).json({ error: "Submission not found" });
    }

    record.status = "approved";
    record.reviewed_at = new Date().toISOString();
    record.review_note = req.body?.note || null;

    writeStore(store);
    res.json({ submission: record });
  });

  // Admin: reject a submission.
  router.post("/:id/reject", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const store = readStore();
    const record = store.records.find((r) => r.id === id);

    if (!record) {
      return res.status(404).json({ error: "Submission not found" });
    }

    record.status = "rejected";
    record.reviewed_at = new Date().toISOString();
    record.review_note = req.body?.reason || null;

    writeStore(store);
    res.json({ submission: record });
  });

  // Admin: permanently delete a submission (any status).
  router.delete("/:id", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const store = readStore();
    const idx = store.records.findIndex((r) => r.id === id);

    if (idx === -1) {
      return res.status(404).json({ error: "Submission not found" });
    }

    const [removed] = store.records.splice(idx, 1);
    writeStore(store);
    res.json({ deleted: removed });
  });

  return router;
}

module.exports = { getSubmissionsRouter };
