import { useEffect, useMemo, useState, useRef, useCallback, memo } from "react";
import {
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
  ZoomControl,
  Popup,
  Marker,
  GeoJSON,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import FPVInfoPanel from "./components/FPVInfoPanel";
import AnalyticsModal from "./components/AnalyticsModal";
import ContributeModal from "./components/ContributeModal";
import AdminPanel from "./components/AdminPanel";
import GlobalSearch from "./components/GlobalSearch";
import GuideModal from "./components/GuideModal";
import DownloadPanel from "./components/DownloadPanel";
import { zoneColor } from "./lib/search";
import L from "leaflet";
import { API_BASE } from "./apiConfig";

function ClickIdentify({ onIdentify }) {
  useMapEvents({
    async click(e) {
      const { lat, lng } = e.latlng;

      try {
        const res = await fetch(
          `${API_BASE}/api/fpv-identify?lat=${lat}&lng=${lng}`
        );

        if (!res.ok) throw new Error(`Identify failed: ${res.status}`);

        const data = await res.json();
        onIdentify(data, { lat, lng });
      } catch (err) {
        console.error("Identify error:", err);
      }
    },
  });

  return null;
}

function FlyToSelection({ target }) {
  const map = useMap();

  useEffect(() => {
    if (!target?.lat || !target?.lon) return;
    map.flyTo([target.lat, target.lon], target.zoom || 13, {
      duration: 1.2,
    });
  }, [target, map]);

  return null;
}

function FitToCountry({ feature }) {
  const map = useMap();

  useEffect(() => {
    if (!feature) return;

    try {
      const layer = L.geoJSON(feature);
      const bounds = layer.getBounds();

      if (bounds.isValid()) {
        map.flyToBounds(bounds, {
          padding: [40, 40],
          duration: 1.2,
        });
      }
    } catch (err) {
      console.error("Country fit bounds error:", err);
    }
  }, [feature, map]);

  return null;
}

function createCleanFPVIcon(isActive = false, climateColor = null) {
  const size = isActive ? 34 : 18;
  const ring = climateColor || "#38bdf8";
  const core = isActive ? "#38bdf8" : "#facc15";

  return L.divIcon({
    className: "clean-fpv-marker",
    html: `
      <div class="fpv-node ${isActive ? "active" : ""}" style="--ring:${ring}">
        <span class="fpv-node-pulse"></span>
        <span class="fpv-node-ring"></span>
        <span class="fpv-node-core" style="background:${core}"></span>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

// Fit the map to a set of points (used for country / climate group results).
function FitToPoints({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points || points.length === 0) return;
    const valid = points.filter(
      (p) => Number.isFinite(p[0]) && Number.isFinite(p[1])
    );
    if (valid.length === 0) return;

    try {
      const bounds = L.latLngBounds(valid);
      if (bounds.isValid()) {
        map.flyToBounds(bounds, { padding: [60, 60], duration: 1.2, maxZoom: 11 });
      }
    } catch (err) {
      console.error("Fit to points error:", err);
    }
  }, [points, map]);

  return null;
}

function createCommunityIcon() {
  return L.divIcon({
    className: "clean-fpv-marker",
    html: `
      <div style="
        width:14px;
        height:14px;
        border-radius:50%;
        background:#4ade80;
        border:3px solid white;
        box-shadow:0 3px 10px rgba(0,0,0,0.35);
      "></div>
    `,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function createReviewIcon(color = "#fbbf24") {
  return L.divIcon({
    className: "clean-fpv-marker",
    html: `
      <div class="review-pin" style="--pin:${color}">
        <span class="review-pin-pulse"></span>
        <span class="review-pin-core"></span>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -18],
  });
}

function CommunityMarkers({ points }) {
  return (
    <>
      {points.map((pt) => (
        <Marker
          key={`community-${pt.id}`}
          position={[pt.lat, pt.lon]}
          icon={createCommunityIcon()}
        >
          <Popup>
            <strong>{pt.name || "Community-submitted site"}</strong>
            <br />
            {pt.country || "Unknown"}
            <br />
            Source: {pt.source || "Unknown"}
            <br />
            <em>Submitted by the community, approved by the FPV team.</em>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

const OverviewMarker = memo(function OverviewMarker({ pt, isActive, onSelect }) {
  const markerRef = useRef(null);

  // Auto-open the popup when this marker becomes the active selection.
  useEffect(() => {
    if (isActive && markerRef.current) {
      markerRef.current.openPopup();
    }
  }, [isActive]);

  const climateColor = pt.climate_zone ? zoneColor(pt.climate_zone) : null;

  return (
    <Marker
      ref={markerRef}
      position={[pt.lat, pt.lon]}
      icon={createCleanFPVIcon(isActive, climateColor)}
      zIndexOffset={isActive ? 1000 : 0}
      eventHandlers={{ click: () => onSelect(pt) }}
    >
      <Popup>
        <div className="fpv-popup">
          <strong>{pt.fpv_new_id || pt.id || "FPV Site"}</strong>
          <div className="fpv-popup-loc">
            {pt.city || "Unknown"} • {pt.state || "Unknown"} • {pt.country || "Unknown"}
          </div>
          {pt.lake_name && (
            <div className="fpv-popup-row">Waterbody: {pt.lake_name}</div>
          )}
          {pt.climate_zone && (
            <div className="fpv-popup-row">
              Climate:{" "}
              <span
                className="fpv-popup-climate"
                style={{ color: zoneColor(pt.climate_zone) }}
              >
                {pt.climate_zone}
                {pt.koppen_label ? ` (${pt.koppen_label})` : ""}
              </span>
            </div>
          )}
          <div className="fpv-popup-row">WB ID: {pt.wb_new_id || "Unknown"}</div>
          <div className="fpv-popup-row">
            FPV area:{" "}
            {pt.fpv_area_k ? `${Number(pt.fpv_area_k).toFixed(2)} km²` : "Not available"}
          </div>
        </div>
      </Popup>
    </Marker>
  );
});

const OverviewMarkers = memo(function OverviewMarkers({
  points,
  onSelect,
  selectedFPV,
}) {
  const activeId = selectedFPV?.fpv_new_id || selectedFPV?.id || null;
  return (
    <>
      {points.map((pt) => {
        const key = pt.fpv_new_id || pt.id || `${pt.lat}-${pt.lon}`;
        const isActive = Boolean(
          activeId &&
            (activeId === pt.fpv_new_id || activeId === pt.id)
        );

        return (
          <OverviewMarker
            key={key}
            pt={pt}
            isActive={isActive}
            onSelect={onSelect}
          />
        );
      })}
    </>
  );
});

function buildMonthOptions(start = "2018-01-01") {
  const result = [];
  const startDate = new Date(start);
  const endDate = new Date();

  let year = startDate.getFullYear();
  let month = startDate.getMonth();

  while (
    year < endDate.getFullYear() ||
    (year === endDate.getFullYear() && month <= endDate.getMonth())
  ) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const label = new Date(year, month, 1).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });

    result.push({ value: iso, label });

    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  return result;
}

function getWindowDates(monthStartIso, windowMonths) {
  const start = new Date(monthStartIso);
  const end = new Date(start);
  end.setMonth(end.getMonth() + windowMonths);
  end.setDate(0);

  const toIso = (d) => d.toISOString().slice(0, 10);

  return {
    start: toIso(start),
    end: toIso(end),
  };
}

function ToggleButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`seg-btn${active ? " active" : ""}`}
    >
      {children}
    </button>
  );
}

export default function MapView({
  startDate,
  endDate,
  setStartDate,
  setEndDate,
}) {
  const [fpvTileUrl, setFpvTileUrl] = useState(null);
  const [waterbodyTileUrl, setWaterbodyTileUrl] = useState(null);
  const [overviewPoints, setOverviewPoints] = useState([]);

  const [selectedFPV, setSelectedFPV] = useState(null);
  const [selectedWaterbody, setSelectedWaterbody] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const [showFPVLayer, setShowFPVLayer] = useState(true);
  const [showWaterbodyLayer, setShowWaterbodyLayer] = useState(true);
  const [baseMap, setBaseMap] = useState("satellite");

  const [showVizPanel, setShowVizPanel] = useState(false);
  const [vizLayer, setVizLayer] = useState("ndci");
  const [vizMin, setVizMin] = useState(-0.05);
  const [vizMax, setVizMax] = useState(0.2);
  const [vizOpacity, setVizOpacity] = useState(0.75);
  const [environmentTileUrl, setEnvironmentTileUrl] = useState(null);

  const [countryGeoJson, setCountryGeoJson] = useState(null);
  const [highlightedCountry, setHighlightedCountry] = useState(null);

  const [flyTarget, setFlyTarget] = useState(null);
  const [climateFilter, setClimateFilter] = useState(null); // { zone, ids:Set }
  const [fitPoints, setFitPoints] = useState(null);

  const [pickedLocation, setPickedLocation] = useState(null);
  const [showContribute, setShowContribute] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [communityPoints, setCommunityPoints] = useState([]);
  const [reviewPin, setReviewPin] = useState(null);
  const [previewPin, setPreviewPin] = useState(null);

  const [showGuide, setShowGuide] = useState(
    () => !localStorage.getItem("fpv_guide_seen")
  );
  const [showDownloadPanel, setShowDownloadPanel] = useState(false);

  function closeGuide() {
    setShowGuide(false);
    try {
      localStorage.setItem("fpv_guide_seen", "1");
    } catch {
      // ignore storage errors (private mode)
    }
  }

  // Fly the map to a submission the admin is reviewing and drop a temp pin.
  function handleLocateSubmission(sub) {
    if (!sub || sub.lat == null || sub.lon == null) return;
    setReviewPin(sub);
    setFlyTarget({ lat: Number(sub.lat), lon: Number(sub.lon), zoom: 14 });
  }

  // Live preview: fly to the coordinates a contributor is typing so they can
  // visually confirm the location before submitting.
  const handlePreviewLocation = useCallback((coord) => {
    if (!coord || coord.lat == null || coord.lon == null) return;
    setPreviewPin({ lat: Number(coord.lat), lon: Number(coord.lon) });
    setFlyTarget({ lat: Number(coord.lat), lon: Number(coord.lon), zoom: 14 });
  }, []);

  // Approval feedback: fly to the site, flash a green "approved" pin, and
  // refresh the community markers so the permanent green marker appears.
  function handleApprovedSubmission(sub) {
    if (!sub || sub.lat == null || sub.lon == null) return;
    setReviewPin({ ...sub, approved: true });
    setFlyTarget({ lat: Number(sub.lat), lon: Number(sub.lon), zoom: 14 });
    loadCommunityPoints();
  }

  async function loadCommunityPoints() {
    try {
      const res = await fetch(`${API_BASE}/api/submissions/approved`);
      if (!res.ok) return;
      const data = await res.json();
      setCommunityPoints(data.submissions || []);
    } catch (err) {
      console.error("Community points load error:", err);
    }
  }

  useEffect(() => {
    loadCommunityPoints();
  }, []);

  useEffect(() => {
    async function loadTiles() {
      try {
        setLoading(true);

        const [fpvRes, wbRes] = await Promise.all([
          fetch(`${API_BASE}/api/fpv-tiles`),
          fetch(`${API_BASE}/api/waterbody-tiles`),
        ]);

        if (!fpvRes.ok) throw new Error(`FPV tiles failed: ${fpvRes.status}`);
        if (!wbRes.ok)
          throw new Error(`Waterbody tiles failed: ${wbRes.status}`);

        const fpvData = await fpvRes.json();
        const wbData = await wbRes.json();

        setFpvTileUrl(fpvData.tileUrl);
        setWaterbodyTileUrl(wbData.tileUrl);
      } catch (err) {
        console.error("Error loading tile layers:", err);
      } finally {
        setLoading(false);
      }
    }

    loadTiles();
  }, []);

  useEffect(() => {
    fetch("/countries.geojson")
      .then((res) => res.json())
      .then((data) => setCountryGeoJson(data))
      .catch((err) => console.error("Country GeoJSON load error:", err));
  }, []);

  useEffect(() => {
    async function loadOverviewPoints() {
      try {
        const res = await fetch(`${API_BASE}/api/fpv-overview`);

        if (!res.ok) {
          throw new Error(`Overview points failed: ${res.status}`);
        }

        const data = await res.json();
        setOverviewPoints(data.points || []);
      } catch (err) {
        console.error("Overview points error:", err);
      }
    }

    loadOverviewPoints();
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadMetrics() {
      const wbId = selectedWaterbody?.wb_new_id || selectedFPV?.wb_new_id;

      if (!wbId) {
        setMetrics(null);
        return;
      }
      if (!startDate || !endDate || new Date(endDate) <= new Date(startDate)) {
  setMetrics(null);
  return;
}

      try {
        setMetrics(null);

        const url = `${API_BASE}/api/fpv-metrics?wb_new_id=${encodeURIComponent(
          wbId
        )}&start=${startDate}&end=${endDate}`;

        const res = await fetch(url);

        if (!res.ok) {
          throw new Error(`Metrics request failed: ${res.status}`);
        }

        const data = await res.json();

        if (!ignore) {
          setMetrics(data);
        }
      } catch (err) {
        if (!ignore) {
          console.error("Metrics load error:", err);
          setMetrics({ error: err.message });
        }
      }
    }

    loadMetrics();

    return () => {
      ignore = true;
    };
  }, [selectedFPV, selectedWaterbody, startDate, endDate]);

  const displayedPoints = useMemo(() => {
    if (!climateFilter) return overviewPoints;
    return overviewPoints.filter((p) =>
      climateFilter.ids.has(String(p.fpv_new_id || p.id))
    );
  }, [overviewPoints, climateFilter]);

  const highlightedCountryFeature = useMemo(() => {
    if (!countryGeoJson || !highlightedCountry) return null;

    const q = highlightedCountry.toLowerCase();

    return countryGeoJson.features.find((f) => {
      const name =
        f.properties.ADMIN ||
        f.properties.NAME ||
        f.properties.name ||
        f.properties.NAME_EN ||
        "";

      return name.toLowerCase() === q;
    });
  }, [countryGeoJson, highlightedCountry]);

  // Deep server-side fallback for queries not covered by the local index.
  async function serverSearch(q) {
    try {
      const res = await fetch(
        `${API_BASE}/api/fpv-search?q=${encodeURIComponent(q)}`
      );
      if (!res.ok) throw new Error(`Search failed: ${res.status}`);
      const data = await res.json();
      return data.results || [];
    } catch (err) {
      console.error("Server search error:", err);
      return [];
    }
  }

  // Selecting a site: fly + bounce marker + open popup + highlight + side panel.
  async function handleSelectSite(item) {
    setClimateFilter(null);
    setFitPoints(null);

    if (item.country) setHighlightedCountry(item.country);
    if (item.lat && item.lon) {
      setFlyTarget({ lat: item.lat, lon: item.lon, zoom: 13 });
    }

    try {
      const res = await fetch(
        `${API_BASE}/api/fpv-identify?lat=${item.lat}&lng=${item.lon}`
      );
      if (!res.ok) throw new Error(`Identify failed: ${res.status}`);
      const data = await res.json();
      handleIdentifyResult(data, { lat: item.lat, lng: item.lon });
    } catch (err) {
      console.error("Search select identify error:", err);
      // Still open a minimal panel from the search payload.
      setSelectedFPV(item);
      setSelectedWaterbody(null);
      setMetrics(null);
    }
  }

  // Selecting a raw coordinate.
  async function handleSelectCoord({ lat, lon }) {
    setClimateFilter(null);
    setFitPoints(null);
    setFlyTarget({ lat, lon, zoom: 13 });

    try {
      const res = await fetch(
        `${API_BASE}/api/fpv-identify?lat=${lat}&lng=${lon}`
      );
      const data = await res.json();
      if (data?.found) {
        handleIdentifyResult(data, { lat, lng: lon });
        return;
      }
    } catch (err) {
      console.error("Coordinate identify error:", err);
    }

    setSelectedFPV({
      fpv_new_id: "Custom location",
      id: "custom-location",
      lat,
      lon,
    });
    setSelectedWaterbody(null);
    setMetrics(null);
  }

  // Selecting a climate zone: filter map to that class and fit bounds.
  function handleSelectClimate(zone, pts) {
    setHighlightedCountry(null);
    setSelectedFPV(null);
    setSelectedWaterbody(null);
    setMetrics(null);

    const ids = new Set(
      pts.map((p) => String(p.fpv_new_id || p.id)).filter(Boolean)
    );
    setClimateFilter({ zone, ids });

    const coords = pts
      .map((p) => [Number(p.lat), Number(p.lon)])
      .filter((c) => Number.isFinite(c[0]) && Number.isFinite(c[1]));
    setFitPoints(coords.length ? coords : null);
  }

  async function handleSelectOverviewPoint(pt) {
    if (pt.country) {
      setHighlightedCountry(pt.country);
    }

    setFlyTarget({ lat: pt.lat, lon: pt.lon, zoom: 13 });

    try {
      const res = await fetch(
        `${API_BASE}/api/fpv-identify?lat=${pt.lat}&lng=${pt.lon}`
      );

      const data = await res.json();
      handleIdentifyResult(data, { lat: pt.lat, lng: pt.lon });
    } catch (err) {
      console.error("Overview point identify error:", err);
    }
  }

  function handleIdentifyResult(data, latlng) {
    if (latlng) {
      setPickedLocation(latlng);
    }

    if (data?.found) {
      setSelectedFPV(data.fpv || null);
      setSelectedWaterbody(data.waterbody || null);
      setMetrics(null);

      const country = data.fpv?.country || data.waterbody?.country;
      if (country) setHighlightedCountry(country);
    } else {
      setSelectedFPV(null);
      setSelectedWaterbody(null);
      setMetrics(null);
      setShowAnalytics(false);
    }
  }

  function handleDownload() {
    const fpvId =
      selectedFPV?.fpv_new_id ?? selectedFPV?.fpv_id ?? selectedFPV?.id;

    if (!fpvId) return;

    window.open(
      `${API_BASE}/api/fpv-download?id=${encodeURIComponent(fpvId)}`,
      "_blank"
    );
  }

  async function handleApplyVisualization() {
    const wbId = selectedWaterbody?.wb_new_id || selectedFPV?.wb_new_id;

    if (!wbId) {
      alert("Please click/select an FPV site first.");
      return;
    }
    if (!startDate || !endDate || new Date(endDate) <= new Date(startDate)) {
  alert("Please select a valid start and end date.");
  return;
}

    try {
      const url = `${API_BASE}/api/environmental-layer?wb_new_id=${encodeURIComponent(
        wbId
      )}&layer=${vizLayer}&min=${vizMin}&max=${vizMax}&start=${startDate}&end=${endDate}`;

      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`Environmental layer failed: ${res.status}`);
      }

      const data = await res.json();
      setEnvironmentTileUrl(data.tileUrl);
    } catch (err) {
      console.error("Environmental visualization error:", err);
      alert("Could not load environmental layer.");
    }
  }

  // Stable marker-click handler so memoized markers don't re-render when the
  // handler identity would otherwise change on every parent render.
  const selectPointRef = useRef(null);
  selectPointRef.current = handleSelectOverviewPoint;
  const stableSelectPoint = useCallback(
    (pt) => selectPointRef.current && selectPointRef.current(pt),
    []
  );

  return (
    <div style={{ height: "100%", width: "100%", position: "relative" }}>
      <style>{`
        .clean-fpv-marker { background: transparent; border: none; }

        /* Scientific FPV energy node --------------------------------------- */
        .fpv-node {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .fpv-node-core {
          position: relative;
          z-index: 3;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          border: 2px solid #fff;
          box-shadow: 0 2px 6px rgba(0,0,0,0.45);
        }
        .fpv-node-ring {
          position: absolute;
          z-index: 2;
          inset: 0;
          border-radius: 50%;
          border: 2px solid var(--ring, #38bdf8);
          opacity: 0.85;
        }
        .fpv-node-pulse {
          position: absolute;
          z-index: 1;
          inset: 0;
          border-radius: 50%;
          background: var(--ring, #38bdf8);
          opacity: 0;
        }
        .fpv-node.active .fpv-node-core {
          width: 12px; height: 12px;
          box-shadow: 0 0 0 4px rgba(56,189,248,0.25), 0 4px 14px rgba(0,0,0,0.5);
        }
        .fpv-node.active .fpv-node-ring {
          border-color: #38bdf8;
          box-shadow: 0 0 14px 2px rgba(56,189,248,0.6);
        }
        .fpv-node.active .fpv-node-pulse {
          background: #38bdf8;
          opacity: 0.5;
          animation: fpv-pulse 1.4s ease-out infinite;
        }
        .fpv-node.active { animation: fpv-bounce 0.6s ease; }
        @keyframes fpv-pulse {
          0%   { transform: scale(0.6); opacity: 0.5; }
          70%  { transform: scale(1.9); opacity: 0; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        @keyframes fpv-bounce {
          0% { transform: translateY(-10px); }
          40% { transform: translateY(0); }
          60% { transform: translateY(-4px); }
          100% { transform: translateY(0); }
        }

        /* Admin review pin ------------------------------------------------- */
        .review-pin {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .review-pin-core {
          position: relative;
          z-index: 3;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--pin, #fbbf24);
          border: 3px solid #fff;
          box-shadow: 0 0 0 3px rgba(255,255,255,0.15), 0 4px 12px rgba(0,0,0,0.5);
        }
        .review-pin-pulse {
          position: absolute;
          z-index: 1;
          inset: 4px;
          border-radius: 50%;
          background: var(--pin, #fbbf24);
          opacity: 0.55;
          animation: fpv-pulse 1.5s ease-out infinite;
        }

        /* Popup polish ----------------------------------------------------- */
        .fpv-popup { font-size: 12.5px; line-height: 1.5; min-width: 170px; }
        .fpv-popup strong { font-size: 13.5px; }
        .fpv-popup-loc { color: #475569; margin: 3px 0 6px; }
        .fpv-popup-row { color: #334155; }
        .fpv-popup-climate { font-weight: 700; }
        .leaflet-popup-content-wrapper {
          border-radius: 12px;
          box-shadow: 0 12px 32px rgba(0,0,0,0.25);
        }

        /* Climate filter banner ------------------------------------------- */
        .climate-banner {
          position: absolute;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 1250;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 9px 16px;
          border-radius: 999px;
          background: rgba(9,16,30,0.92);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 12px 30px rgba(0,0,0,0.35);
          backdrop-filter: blur(10px);
          color: #fff;
          font-size: 13px;
          animation: gsearch-pop 0.2s ease-out;
        }
        .climate-banner button {
          border: none;
          background: rgba(255,255,255,0.12);
          color: #fff;
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .climate-banner button:hover { background: rgba(255,255,255,0.22); }
        @keyframes gsearch-pop {
          from { opacity: 0; transform: translate(-50%, -6px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>

      {loading && (
        <div
          className="ui-panel"
          style={{
            position: "absolute",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1400,
            padding: "9px 16px",
            fontSize: 13,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "var(--text-dim)",
          }}
        >
          <span className="gsearch-spinner" aria-hidden="true" />
          Loading map layers…
        </div>
      )}

      {climateFilter && (
        <div className="climate-banner">
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: zoneColor(climateFilter.zone),
              boxShadow: `0 0 10px ${zoneColor(climateFilter.zone)}`,
            }}
          />
          <span>
            Showing <strong>{displayedPoints.length}</strong>{" "}
            <strong>{climateFilter.zone}</strong> FPV sites
          </span>
          <button
            onClick={() => {
              setClimateFilter(null);
              setFitPoints(null);
            }}
          >
            Clear
          </button>
        </div>
      )}

      <div
        className="ui-panel"
        style={{
          position: "absolute",
          top: 18,
          left: 20,
          zIndex: 1200,
          width: 390,
          padding: "16px 18px",
        }}
      >
        <button
          onClick={() => setShowGuide(true)}
          title="How to use this dashboard"
          aria-label="Open guide"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: "1px solid var(--border)",
            background: "var(--surface-2)",
            color: "var(--text-dim)",
            fontSize: 14,
            fontWeight: 800,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ?
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background:
                "radial-gradient(circle at 30% 30%, rgba(56,189,248,0.35), rgba(251,191,36,0.25))",
              border: "1px solid rgba(56,189,248,0.35)",
              boxShadow: "0 0 18px rgba(56,189,248,0.25)",
              flex: "0 0 auto",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="4" fill="#fbbf24" />
              <g stroke="#38bdf8" strokeWidth="1.6" strokeLinecap="round">
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
              </g>
            </svg>
          </div>
          <div>
            <div
              style={{
                fontSize: "1.12rem",
                fontWeight: 800,
                letterSpacing: "-0.01em",
                lineHeight: 1.1,
              }}
            >
              Global FPV Dashboard
            </div>
            <div
              style={{
                fontSize: "0.72rem",
                color: "var(--text-mut)",
                marginTop: 3,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Floating Photovoltaic Observatory
            </div>
          </div>
        </div>
        <div
          style={{
            fontSize: "0.8rem",
            color: "var(--text-dim)",
            marginTop: 10,
            lineHeight: 1.4,
          }}
        >
          Explore floating solar installations, waterbody metrics, and climate
          zones worldwide.
        </div>
      </div>

      <div
        className="ui-panel"
        style={{
          position: "absolute",
          top: 150,
          left: 20,
          zIndex: 1200,
          width: 390,
          padding: 18,
        }}
      >
        <div
          className="ui-eyebrow"
          style={{ marginBottom: 10, display: "block" }}
        >
          Intelligent Search
        </div>

        <GlobalSearch
          points={overviewPoints}
          onSelectSite={handleSelectSite}
          onSelectCoord={handleSelectCoord}
          onSelectClimate={handleSelectClimate}
          onServerSearch={serverSearch}
        />

        <div
          className="ui-eyebrow"
          style={{ display: "block", marginTop: 20, marginBottom: 10 }}
        >
          Analysis Time Window
        </div>

<div
  style={{
    background: "rgba(255,255,255,0.05)",
    padding: 12,
    borderRadius: 12,
  }}
>
  <div style={{ fontSize: 13, color: "#b9c6d8", marginBottom: 10 }}>
    Select start and end dates for NDCI, Chlorophyll-a, and WST analysis.
  </div>

  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
    <div>
      <div style={{ fontSize: 12, color: "#9fb0c3", marginBottom: 6 }}>
        Start Date
      </div>
      <input
        type="date"
        value={startDate}
        min="2013-01-01"
        max={endDate || undefined}
        onChange={(e) => setStartDate(e.target.value)}
        style={{
          width: "100%",
          padding: "9px 10px",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.08)",
          color: "white",
          boxSizing: "border-box",
        }}
      />
    </div>

    <div>
      <div style={{ fontSize: 12, color: "#9fb0c3", marginBottom: 6 }}>
        End Date
      </div>
      <input
        type="date"
        value={endDate}
        min={startDate || "2013-01-01"}
        max={new Date().toISOString().slice(0, 10)}
        onChange={(e) => setEndDate(e.target.value)}
        style={{
          width: "100%",
          padding: "9px 10px",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.08)",
          color: "white",
          boxSizing: "border-box",
        }}
      />
    </div>
  </div>

  <div
    style={{
      marginTop: 10,
      fontSize: 12,
      color: "#9fb0c3",
      lineHeight: 1.4,
    }}
  >
    Current window: {startDate || "not set"} to {endDate || "not set"}
  </div>

  {startDate && endDate && new Date(endDate) <= new Date(startDate) && (
    <div
      style={{
        marginTop: 10,
        padding: "8px 10px",
        borderRadius: 8,
        background: "rgba(248,113,113,0.12)",
        border: "1px solid rgba(248,113,113,0.3)",
        color: "#fecaca",
        fontSize: 12,
      }}
    >
      End date must be after start date.
    </div>
  )}
</div>

        <div
          className="ui-eyebrow"
          style={{ display: "block", marginTop: 20, marginBottom: 10 }}
        >
          Layer Controls
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <ToggleButton
            active={baseMap === "satellite"}
            onClick={() => setBaseMap("satellite")}
          >
            Satellite
          </ToggleButton>

          <ToggleButton
            active={baseMap === "osm"}
            onClick={() => setBaseMap("osm")}
          >
            OpenStreetMap
          </ToggleButton>

          <ToggleButton
            active={showFPVLayer}
            onClick={() => setShowFPVLayer((v) => !v)}
          >
            FPV
          </ToggleButton>

          <ToggleButton
            active={showWaterbodyLayer}
            onClick={() => setShowWaterbodyLayer((v) => !v)}
          >
            Waterbody
          </ToggleButton>

          <ToggleButton
            active={showVizPanel}
            onClick={() => setShowVizPanel((v) => !v)}
          >
            Metric Viz
          </ToggleButton>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: 20,
          right: 170,
          zIndex: 1200,
          display: "flex",
          gap: 10,
        }}
      >
        <button
          onClick={handleDownload}
          disabled={!selectedFPV}
          className="btn btn-ghost"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Download
        </button>

        <button
          onClick={() => setShowAnalytics(true)}
          disabled={!selectedFPV}
          className="btn btn-primary"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 19V5m0 14h16M8 15l3-4 3 2 4-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Environmental Insights
        </button>

        <button
          onClick={() => {
            setShowVizPanel(false);
            setShowDownloadPanel((v) => !v);
          }}
          className="btn btn-ghost"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M7 11l5 5 5-5M12 4v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Export Data
        </button>

        <button
          onClick={() => setShowContribute(true)}
          className="btn btn-solar"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Contribute a Site
        </button>
      </div>

      <button
        onClick={() => setShowAdmin(true)}
        className="seg-btn"
        style={{
          position: "absolute",
          bottom: 20,
          right: 20,
          zIndex: 1200,
          backdropFilter: "blur(8px)",
        }}
      >
        Admin
      </button>

      {showVizPanel && (
        <div
          className="ui-panel"
          style={{
            position: "absolute",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1300,
            width: 420,
            padding: 18,
          }}
        >
          <div className="ui-eyebrow" style={{ display: "block", marginBottom: 4 }}>
            Environmental Layer
          </div>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 14 }}>
            Visualization Parameters
          </div>

          <div style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 6 }}>
            Metric
          </div>

          <select
            value={vizLayer}
            onChange={(e) => {
              const value = e.target.value;
              setVizLayer(value);

              if (value === "ndci") {
                setVizMin(-0.05);
                setVizMax(0.2);
              } else if (value === "chla") {
                setVizMin(0);
                setVizMax(80);
              } else if (value === "wst") {
                setVizMin(10);
                setVizMax(35);
              }
            }}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.18)",
              marginBottom: 12,
            }}
          >
            <option value="ndci">NDCI</option>
            <option value="chla">Chlorophyll-a</option>
            <option value="wst">Water Surface Temperature</option>
          </select>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            <input
              type="number"
              step="0.01"
              value={vizMin}
              onChange={(e) => setVizMin(Number(e.target.value))}
              style={{
                padding: "8px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            />

            <input
              type="number"
              step="0.01"
              value={vizMax}
              onChange={(e) => setVizMax(Number(e.target.value))}
              style={{
                padding: "8px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            />
          </div>

          <div style={{ marginTop: 12, fontSize: 12, color: "#cbd5e1" }}>
            Opacity: {vizOpacity.toFixed(2)}
          </div>

          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={vizOpacity}
            onChange={(e) => setVizOpacity(Number(e.target.value))}
            style={{ width: "100%", marginTop: 6 }}
          />

          <div style={{ marginTop: 12, fontSize: 12, color: "#cbd5e1" }}>
            Color scale
          </div>

          <div
            style={{
              marginTop: 6,
              height: 18,
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.35)",
              background:
                "linear-gradient(90deg, #2166ac, #67a9cf, #d1e5f0, #fddbc7, #ef8a62, #b2182b)",
            }}
          />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 11,
              color: "#cbd5e1",
              marginTop: 4,
            }}
          >
            <span>{vizMin}</span>
            <span>{vizMax}</span>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              onClick={handleApplyVisualization}
              className="btn btn-primary"
              style={{ flex: 1, justifyContent: "center" }}
            >
              Apply
            </button>

            <button
              onClick={() => setShowVizPanel(false)}
              className="btn btn-ghost"
              style={{ flex: 1, justifyContent: "center" }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <MapContainer
        center={[20, 0]}
        zoom={2}
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <ZoomControl position="bottomright" />

        {baseMap === "osm" ? (
          <TileLayer
            attribution="© OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        ) : (
          <TileLayer
            attribution="Tiles © Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        )}

        {highlightedCountryFeature && (
          <>
            <GeoJSON
              key={highlightedCountry}
              data={highlightedCountryFeature}
              style={{
                color: "#facc15",
                weight: 3,
                fillColor: "#facc15",
                fillOpacity: 0.12,
              }}
            />
            <FitToCountry feature={highlightedCountryFeature} />
          </>
        )}

        {environmentTileUrl && (
          <TileLayer url={environmentTileUrl} opacity={vizOpacity} />
        )}

        {showWaterbodyLayer && waterbodyTileUrl && (
          <TileLayer url={waterbodyTileUrl} opacity={0.95} />
        )}

        {showFPVLayer && fpvTileUrl && (
          <TileLayer url={fpvTileUrl} opacity={0.95} />
        )}

        <OverviewMarkers
          points={displayedPoints}
          onSelect={stableSelectPoint}
          selectedFPV={selectedFPV}
        />

        <CommunityMarkers points={communityPoints} />

        {reviewPin && reviewPin.lat != null && reviewPin.lon != null && (
          <Marker
            position={[Number(reviewPin.lat), Number(reviewPin.lon)]}
            icon={createReviewIcon(reviewPin.approved ? "#34d399" : "#fbbf24")}
            zIndexOffset={2000}
          >
            <Popup>
              <div className="fpv-popup">
                <strong>
                  {reviewPin.name || "Submitted site"}{" "}
                  <span style={{ color: "#64748b" }}>#{reviewPin.id}</span>
                </strong>
                <div className="fpv-popup-loc">
                  {Number(reviewPin.lat).toFixed(4)},{" "}
                  {Number(reviewPin.lon).toFixed(4)}
                </div>
                {reviewPin.country && (
                  <div className="fpv-popup-row">{reviewPin.country}</div>
                )}
                {reviewPin.source && (
                  <div className="fpv-popup-row">Source: {reviewPin.source}</div>
                )}
                <div
                  className="fpv-popup-row"
                  style={{
                    color: reviewPin.approved ? "#34d399" : "#fbbf24",
                    fontWeight: 700,
                  }}
                >
                  {reviewPin.approved
                    ? "✓ Approved, now a community site"
                    : "Pending review"}
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {previewPin && (
          <Marker
            position={[previewPin.lat, previewPin.lon]}
            icon={createReviewIcon("#38bdf8")}
            zIndexOffset={2000}
          >
            <Popup>
              <div className="fpv-popup">
                <strong>Your submission location</strong>
                <div className="fpv-popup-loc">
                  {previewPin.lat.toFixed(4)}, {previewPin.lon.toFixed(4)}
                </div>
                <div className="fpv-popup-row" style={{ color: "#38bdf8" }}>
                  Check this is the right spot, then submit.
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        <ClickIdentify onIdentify={handleIdentifyResult} />
        <FlyToSelection target={flyTarget} />
        <FitToPoints points={fitPoints} />
      </MapContainer>

      <FPVInfoPanel
        fpv={selectedFPV}
        waterbody={selectedWaterbody}
        onClose={() => {
          setSelectedFPV(null);
          setSelectedWaterbody(null);
          setMetrics(null);
          setShowAnalytics(false);
        }}
      />

      <AnalyticsModal
        open={showAnalytics}
        onClose={() => setShowAnalytics(false)}
        metrics={metrics}
      />

      <ContributeModal
        open={showContribute}
        onClose={() => {
          setShowContribute(false);
          setPreviewPin(null);
        }}
        initialLat={pickedLocation?.lat}
        initialLon={pickedLocation?.lng}
        onPreview={handlePreviewLocation}
        onSubmitted={() => loadCommunityPoints()}
      />

      <GuideModal open={showGuide} onClose={closeGuide} />

      <DownloadPanel
        open={showDownloadPanel}
        onClose={() => setShowDownloadPanel(false)}
        points={overviewPoints}
      />

      <AdminPanel
        open={showAdmin}
        onClose={() => {
          setShowAdmin(false);
          setReviewPin(null);
        }}
        onLocate={handleLocateSubmission}
        onApproved={handleApprovedSubmission}
        onReviewed={() => loadCommunityPoints()}
      />
    </div>
  );
}