/**
 * search.js — dependency-free intelligent search for the Global FPV Dashboard.
 *
 * Handles every query type the dashboard supports:
 *   - FPV ID            "FPV_USA_00142", "00142", "142"
 *   - Country / State / City / Waterbody name (fuzzy)
 *   - Climate zone      "Tropical", "Arid", "Temperate", "Cold", "Polar" (+ synonyms)
 *   - Latitude only     "41.08"
 *   - Longitude only    "-85.10"
 *   - Lat, Lon pair     "41.08,-85.10"
 *
 * It indexes the enriched /api/fpv-overview points (which now carry lake_name,
 * coverage and Köppen climate) so autocomplete is instant and offline — no
 * server round-trip per keystroke.
 */

// ---- Climate zones (mirror of server/climate.js) --------------------------
export const CLIMATE_ZONES = [
  { zone: "Tropical", color: "#22c55e", synonyms: ["tropical", "tropic", "equatorial", "rainforest", "monsoon", "humid"] },
  { zone: "Arid", color: "#f59e0b", synonyms: ["arid", "dry", "desert", "steppe", "semiarid", "semi-arid"] },
  { zone: "Temperate", color: "#38bdf8", synonyms: ["temperate", "mild", "mediterranean", "oceanic", "subtropical", "warm"] },
  { zone: "Cold", color: "#818cf8", synonyms: ["cold", "continental", "boreal", "snow", "subarctic"] },
  { zone: "Polar", color: "#e2e8f0", synonyms: ["polar", "tundra", "ice", "arctic", "frost"] },
];

export function zoneColor(zone) {
  const z = CLIMATE_ZONES.find((c) => c.zone === zone);
  return z ? z.color : "#94a3b8";
}

export function matchClimateZone(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return null;
  for (const z of CLIMATE_ZONES) {
    if (z.zone.toLowerCase() === q) return z.zone;
    if (z.synonyms.some((s) => s === q || (q.length >= 3 && s.startsWith(q)))) {
      return z.zone;
    }
  }
  return null;
}

// ---- Coordinate parsing ---------------------------------------------------
const NUM = /^-?\d+(\.\d+)?$/;

export function parseCoordinateQuery(query) {
  const q = String(query || "").trim();
  if (!q) return null;

  // "lat, lon" pair
  if (q.includes(",")) {
    const parts = q.split(",").map((s) => s.trim());
    if (parts.length === 2 && NUM.test(parts[0]) && NUM.test(parts[1])) {
      const lat = Number(parts[0]);
      const lon = Number(parts[1]);
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        return { kind: "latlon", lat, lon };
      }
    }
    return null;
  }

  // single number → ambiguous lat or lon (only treat as coord if plausible)
  if (NUM.test(q)) {
    const n = Number(q);
    if (Math.abs(n) <= 90) return { kind: "lat", value: n };
    if (Math.abs(n) <= 180) return { kind: "lon", value: n };
  }
  return null;
}

// ---- Fuzzy scoring --------------------------------------------------------
// Normalize: lowercase, strip punctuation to spaces, collapse whitespace.
function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[_\-.,/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Subsequence test: are all chars of `q` present in order within `text`?
function isSubsequence(q, text) {
  let i = 0;
  for (let j = 0; j < text.length && i < q.length; j++) {
    if (text[j] === q[i]) i++;
  }
  return i === q.length;
}

/**
 * Score a single field against the query. Higher is better; 0 = no match.
 * Rewards exact > prefix > word-boundary > substring > subsequence.
 */
function scoreField(query, field, weight) {
  if (!field) return 0;
  const q = norm(query);
  const f = norm(field);
  if (!q || !f) return 0;

  if (f === q) return 100 * weight;
  if (f.startsWith(q)) return 80 * weight;

  // word-boundary prefix (any token starts with q)
  const tokens = f.split(" ");
  if (tokens.some((t) => t.startsWith(q))) return 65 * weight;

  const idx = f.indexOf(q);
  if (idx >= 0) return (55 - Math.min(idx, 20)) * weight;

  // compact match ignoring spaces (e.g. "fpvusa142" vs "fpv usa 142")
  const compactF = f.replace(/ /g, "");
  const compactQ = q.replace(/ /g, "");
  if (compactF.includes(compactQ)) return 45 * weight;

  // fuzzy subsequence, only for queries long enough to be meaningful
  if (q.length >= 3 && isSubsequence(compactQ, compactF)) {
    return 25 * weight * (compactQ.length / compactF.length);
  }
  return 0;
}

// Field weights: IDs and names rank highest.
const FIELDS = [
  ["fpv_new_id", 1.0],
  ["id", 0.9],
  ["lake_name", 0.85],
  ["city", 0.8],
  ["state", 0.7],
  ["country", 0.75],
  ["wb_new_id", 0.6],
  ["koppen_label", 0.4],
  ["climate_zone", 0.5],
];

// Digits-only ID matching, e.g. "142" or "00142" -> FPV_USA_00142
function idNumberScore(query, point) {
  const digits = String(query).replace(/\D/g, "");
  if (!digits) return 0;
  const idStr = String(point.fpv_new_id || point.id || "");
  const idDigits = idStr.replace(/\D/g, "");
  if (!idDigits) return 0;
  if (idDigits === digits) return 95;
  if (idDigits === digits.replace(/^0+/, "")) return 90;
  if (idDigits.endsWith(digits) && digits.length >= 2) return 70;
  return 0;
}

/**
 * Main search over the in-memory overview points.
 * Returns { mode, zone, results } where mode is:
 *   "latlon" | "lat" | "lon" | "climate" | "text"
 */
export function searchPoints(query, points, limit = 12) {
  const q = String(query || "").trim();
  if (!q) return { mode: "empty", results: [] };

  // 1) coordinates
  const coord = parseCoordinateQuery(q);
  if (coord?.kind === "latlon") {
    return {
      mode: "latlon",
      results: [
        {
          type: "coordinate",
          id: "custom-location",
          lat: coord.lat,
          lon: coord.lon,
          label: `${coord.lat.toFixed(4)}, ${coord.lon.toFixed(4)}`,
        },
      ],
    };
  }

  // 2) climate zone → group result + matching sites
  const zone = matchClimateZone(q);
  if (zone) {
    const inZone = points.filter((p) => p.climate_zone === zone);
    return {
      mode: "climate",
      zone,
      results: [
        {
          type: "climate",
          id: `climate-${zone}`,
          zone,
          count: inZone.length,
          label: `${zone} climate`,
          points: inZone,
        },
        ...rankTextResults(q, inZone, limit - 1),
      ],
    };
  }

  // 3) text / id / fuzzy
  return { mode: "text", results: rankTextResults(q, points, limit) };
}

function rankTextResults(query, points, limit) {
  const scored = [];
  for (const p of points) {
    let best = idNumberScore(query, p);
    for (const [field, weight] of FIELDS) {
      const s = scoreField(query, p[field], weight);
      if (s > best) best = s;
    }
    if (best > 0) scored.push({ point: p, score: best });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ point, score }) => ({
    type: "site",
    score,
    ...point,
  }));
}

// ---- Match highlighting ---------------------------------------------------
// Returns [{ text, hit }] segments so the UI can bold matched substrings.
export function highlightSegments(text, query) {
  const src = String(text ?? "");
  const q = norm(query);
  if (!q || !src) return [{ text: src, hit: false }];

  const lower = norm(src);
  // map normalized index back is complex; do a simple case-insensitive
  // substring highlight on the raw string using the raw query token.
  const rawQ = String(query).trim().toLowerCase().replace(/[,]/g, "");
  const rawLower = src.toLowerCase();
  const idx = rawLower.indexOf(rawQ);
  if (idx >= 0 && rawQ) {
    return [
      { text: src.slice(0, idx), hit: false },
      { text: src.slice(idx, idx + rawQ.length), hit: true },
      { text: src.slice(idx + rawQ.length), hit: false },
    ].filter((seg) => seg.text.length > 0);
  }
  // token prefix highlight
  if (lower.startsWith(q)) {
    return [
      { text: src.slice(0, q.length), hit: true },
      { text: src.slice(q.length), hit: false },
    ].filter((seg) => seg.text.length > 0);
  }
  return [{ text: src, hit: false }];
}
