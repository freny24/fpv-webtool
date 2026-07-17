import { useMemo, useState } from "react";
import { CLIMATE_ZONES, zoneColor } from "../lib/search";
import { toCSV, toGeoJSON, downloadText, timestamp } from "../lib/exporters";

// Columns exported for each FPV site (order matters in the CSV).
const COLUMNS = [
  { key: "fpv_new_id", label: "fpv_id" },
  { key: "id", label: "legacy_id" },
  { key: "wb_new_id", label: "waterbody_id" },
  { key: "lake_name", label: "waterbody_name" },
  { key: "country", label: "country" },
  { key: "state", label: "state" },
  { key: "city", label: "city" },
  { key: "lat", label: "latitude" },
  { key: "lon", label: "longitude" },
  { key: "fpv_area_k", label: "fpv_area_km2" },
  { key: "fpv_cov", label: "coverage_pct" },
  { key: "climate_zone", label: "climate_zone" },
  { key: "koppen_label", label: "koppen_code" },
];
const PROP_KEYS = COLUMNS.map((c) => c.key);

export default function DownloadPanel({ open, onClose, points = [] }) {
  const [zones, setZones] = useState(() => new Set()); // empty = all zones
  const [country, setCountry] = useState("all");
  const [format, setFormat] = useState("csv");

  const countries = useMemo(() => {
    const set = new Set();
    points.forEach((p) => p.country && set.add(p.country));
    return Array.from(set).sort();
  }, [points]);

  const filtered = useMemo(() => {
    return points.filter((p) => {
      if (zones.size > 0 && !zones.has(p.climate_zone)) return false;
      if (country !== "all" && p.country !== country) return false;
      return true;
    });
  }, [points, zones, country]);

  const zoneCounts = useMemo(() => {
    const m = {};
    points.forEach((p) => {
      if (p.climate_zone) m[p.climate_zone] = (m[p.climate_zone] || 0) + 1;
    });
    return m;
  }, [points]);

  if (!open) return null;

  function toggleZone(zone) {
    setZones((prev) => {
      const next = new Set(prev);
      if (next.has(zone)) next.delete(zone);
      else next.add(zone);
      return next;
    });
  }

  function handleDownload() {
    if (filtered.length === 0) return;
    const scope =
      zones.size > 0
        ? Array.from(zones).join("-")
        : country !== "all"
        ? country.replace(/\s+/g, "_")
        : "all";
    const base = `fpv-sites_${scope}_${timestamp()}`;

    if (format === "csv") {
      downloadText(`${base}.csv`, toCSV(filtered, COLUMNS), "text/csv");
    } else {
      downloadText(
        `${base}.geojson`,
        toGeoJSON(filtered, PROP_KEYS),
        "application/geo+json"
      );
    }
  }

  return (
    <div
      className="ui-panel"
      style={{
        position: "absolute",
        bottom: 28,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1300,
        width: 460,
        maxWidth: "94vw",
        padding: 18,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div className="ui-eyebrow" style={{ display: "block", marginBottom: 4 }}>
            Export Dataset
          </div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Download FPV Data</div>
        </div>
        <button
          onClick={onClose}
          style={{ background: "transparent", border: "none", color: "#fff", fontSize: 22, cursor: "pointer", lineHeight: 1 }}
          aria-label="Close download panel"
        >
          ×
        </button>
      </div>

      <div style={{ fontSize: 12, color: "var(--text-mut)", marginBottom: 8 }}>
        Climate zone (none selected = all zones)
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {CLIMATE_ZONES.map((z) => {
          const active = zones.has(z.zone);
          const c = zoneColor(z.zone);
          return (
            <button
              key={z.zone}
              onClick={() => toggleZone(z.zone)}
              className="seg-btn"
              style={
                active
                  ? {
                      background: `${c}22`,
                      color: c,
                      borderColor: `${c}66`,
                      boxShadow: `inset 0 0 0 1px ${c}44`,
                    }
                  : undefined
              }
            >
              {z.zone}
              <span style={{ opacity: 0.6, marginLeft: 6 }}>
                {zoneCounts[z.zone] || 0}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-mut)", marginBottom: 6 }}>Country</div>
          <select
            className="ui-input"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            <option value="all">All countries</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-mut)", marginBottom: 6 }}>Format</div>
          <select
            className="ui-input"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
          >
            <option value="csv">CSV (spreadsheet)</option>
            <option value="geojson">GeoJSON (GIS)</option>
          </select>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
          <strong style={{ color: "#fff", fontFamily: "var(--font-mono)" }}>
            {filtered.length}
          </strong>{" "}
          of {points.length} sites match
        </div>
        <button
          className="btn btn-primary"
          onClick={handleDownload}
          disabled={filtered.length === 0}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Download {format === "csv" ? "CSV" : "GeoJSON"}
        </button>
      </div>
    </div>
  );
}
