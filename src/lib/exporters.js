/**
 * exporters.js — client-side data export helpers (CSV / GeoJSON / text).
 * No dependencies; builds files in the browser and triggers a download.
 */

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  // Quote if it contains comma, quote, or newline.
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// rows: array of objects; columns: array of { key, label }
export function toCSV(rows, columns) {
  const header = columns.map((c) => csvCell(c.label)).join(",");
  const lines = rows.map((r) =>
    columns.map((c) => csvCell(r[c.key])).join(",")
  );
  return [header, ...lines].join("\n");
}

// points: array of objects with lat/lon + arbitrary properties
export function toGeoJSON(points, propKeys) {
  return JSON.stringify(
    {
      type: "FeatureCollection",
      features: points
        .filter((p) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon)))
        .map((p) => {
          const properties = {};
          for (const k of propKeys) properties[k] = p[k] ?? null;
          return {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [Number(p.lon), Number(p.lat)],
            },
            properties,
          };
        }),
    },
    null,
    2
  );
}

export function downloadText(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function timestamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}
