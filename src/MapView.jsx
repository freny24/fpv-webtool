import { useEffect, useMemo, useState } from "react";
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
import L from "leaflet";

function ClickIdentify({ onIdentify }) {
  useMapEvents({
    async click(e) {
      const { lat, lng } = e.latlng;

      try {
        const res = await fetch(
          `http://localhost:3001/api/fpv-identify?lat=${lat}&lng=${lng}`
        );

        if (!res.ok) throw new Error(`Identify failed: ${res.status}`);

        const data = await res.json();
        onIdentify(data);
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

function createCleanFPVIcon(isActive = false) {
  const size = isActive ? 22 : 14;

  return L.divIcon({
    className: "clean-fpv-marker",
    html: `
      <div style="
        width:${size}px;
        height:${size}px;
        border-radius:50%;
        background:${isActive ? "#38bdf8" : "#facc15"};
        border:3px solid white;
        box-shadow:0 3px 10px rgba(0,0,0,0.35);
      "></div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function OverviewMarkers({ points, onSelect, selectedFPV }) {
  return (
    <>
      {points.map((pt) => {
        const key = pt.fpv_new_id || pt.id || `${pt.lat}-${pt.lon}`;

        const isActive =
          selectedFPV?.fpv_new_id &&
          selectedFPV.fpv_new_id === pt.fpv_new_id;

        return (
          <Marker
            key={key}
            position={[pt.lat, pt.lon]}
            icon={createCleanFPVIcon(isActive)}
            eventHandlers={{
              click: () => onSelect(pt),
            }}
          >
            <Popup>
              <strong>{pt.fpv_new_id || pt.id || "FPV Site"}</strong>
              <br />
              {pt.city || "—"} • {pt.state || "—"} • {pt.country || "—"}
              <br />
              WB ID: {pt.wb_new_id || "—"}
              <br />
              FPV area:{" "}
              {pt.fpv_area_k ? `${Number(pt.fpv_area_k).toFixed(2)} km²` : "—"}
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

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
      style={{
        border: "none",
        borderRadius: 10,
        padding: "8px 12px",
        fontWeight: 700,
        cursor: "pointer",
        background: active ? "#facc15" : "rgba(255,255,255,0.08)",
        color: active ? "#111827" : "white",
      }}
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

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [flyTarget, setFlyTarget] = useState(null);


  useEffect(() => {
    async function loadTiles() {
      try {
        setLoading(true);

        const [fpvRes, wbRes] = await Promise.all([
          fetch("http://localhost:3001/api/fpv-tiles"),
          fetch("http://localhost:3001/api/waterbody-tiles"),
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
        const res = await fetch("http://localhost:3001/api/fpv-overview");

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

        const url = `http://localhost:3001/api/fpv-metrics?wb_new_id=${encodeURIComponent(
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

  async function handleSearch() {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setHighlightedCountry(null);
      return;
    }

    try {
      setSearching(true);

      const res = await fetch(
        `http://localhost:3001/api/fpv-search?q=${encodeURIComponent(
          searchQuery
        )}`
      );

      if (!res.ok) throw new Error(`Search failed: ${res.status}`);

      const data = await res.json();
      const results = data.results || [];

      setSearchResults(results);

      const exactCountry = countryGeoJson?.features?.find((f) => {
        const name =
          f.properties.ADMIN ||
          f.properties.NAME ||
          f.properties.name ||
          f.properties.NAME_EN ||
          "";
        return name.toLowerCase() === searchQuery.trim().toLowerCase();
      });

      if (exactCountry) {
        setHighlightedCountry(
          exactCountry.properties.ADMIN ||
            exactCountry.properties.NAME ||
            exactCountry.properties.name
        );
      } else if (results.length > 0 && results[0].country) {
        setHighlightedCountry(results[0].country);
      } else {
        setHighlightedCountry(null);
      }

      if (results.length === 1) {
        handleSelectSearchResult(results[0]);
      }
    } catch (err) {
      console.error("Search error:", err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function handleSelectSearchResult(item) {
    setSearchQuery(item.label || item.id || "");
    setSearchResults([]);

    if (item.country) {
      setHighlightedCountry(item.country);
    }

    if (item.lat && item.lon) {
      setFlyTarget({ lat: item.lat, lon: item.lon, zoom: 13 });
    }

    if (item.id === "custom-location") {
      setSelectedFPV({
        fpv_new_id: "Custom location",
        id: "custom-location",
        country: item.country || null,
        state: item.state || null,
        city: item.city || null,
        lat: item.lat,
        lon: item.lon,
      });
      setSelectedWaterbody(null);
      setMetrics(null);
      return;
    }

    try {
      const res = await fetch(
        `http://localhost:3001/api/fpv-identify?lat=${item.lat}&lng=${item.lon}`
      );

      if (!res.ok) throw new Error(`Identify failed: ${res.status}`);

      const data = await res.json();
      handleIdentifyResult(data);
    } catch (err) {
      console.error("Search select identify error:", err);
    }
  }

  async function handleSelectOverviewPoint(pt) {
    if (pt.country) {
      setHighlightedCountry(pt.country);
    }

    setFlyTarget({ lat: pt.lat, lon: pt.lon, zoom: 13 });

    try {
      const res = await fetch(
        `http://localhost:3001/api/fpv-identify?lat=${pt.lat}&lng=${pt.lon}`
      );

      const data = await res.json();
      handleIdentifyResult(data);
    } catch (err) {
      console.error("Overview point identify error:", err);
    }
  }

  function handleIdentifyResult(data) {
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
      `http://localhost:3001/api/fpv-download?id=${encodeURIComponent(fpvId)}`,
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
      const url = `http://localhost:3001/api/environmental-layer?wb_new_id=${encodeURIComponent(
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

  return (
    <div style={{ height: "100%", width: "100%", position: "relative" }}>
      <style>{`
        .clean-fpv-marker {
          background: transparent;
          border: none;
        }
      `}</style>

      {loading && (
        <div
          style={{
            position: "absolute",
            top: 20,
            left: 20,
            zIndex: 1200,
            background: "white",
            padding: "8px 12px",
            borderRadius: 10,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            fontSize: 14,
          }}
        >
          Loading layers...
        </div>
      )}

      <div
        style={{
          position: "absolute",
          top: 18,
          left: 20,
          zIndex: 1200,
          width: 390,
          background:
            "linear-gradient(135deg, rgba(7,15,30,0.92), rgba(20,34,56,0.88))",
          color: "white",
          padding: "14px 18px",
          borderRadius: 16,
          backdropFilter: "blur(8px)",
          boxShadow: "0 14px 35px rgba(0,0,0,0.28)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxSizing: "border-box",
        }}
      >
        <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>
          Global FPV Dashboard
        </div>
        <div
          style={{
            fontSize: "0.8rem",
            color: "#b9c6d8",
            marginTop: 4,
            lineHeight: 1.35,
          }}
        >
          Explore floating photovoltaic sites and environmental metrics
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: 108,
          left: 20,
          zIndex: 1200,
          width: 390,
          background:
            "linear-gradient(135deg, rgba(7,15,30,0.92), rgba(20,34,56,0.88))",
          color: "white",
          padding: 18,
          borderRadius: 18,
          backdropFilter: "blur(8px)",
          boxShadow: "0 16px 36px rgba(0,0,0,0.28)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxSizing: "border-box",
        }}
      >
        <div style={{ fontSize: 13, color: "#9fb0c3", marginBottom: 8 }}>
          Search by country, city, FPV ID, WB ID, or lat/lon
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            placeholder="e.g. India, FPV_IN_00044, 18.73, 79.46"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.06)",
              color: "white",
              outline: "none",
            }}
          />
          <button
            onClick={handleSearch}
            style={{
              border: "none",
              borderRadius: 10,
              padding: "10px 14px",
              fontWeight: 700,
              cursor: "pointer",
              background: "#2563eb",
              color: "white",
            }}
          >
            Search
          </button>
        </div>

        {(searching || searchResults.length > 0) && (
          <div
            style={{
              marginTop: 10,
              maxHeight: 180,
              overflowY: "auto",
              borderRadius: 12,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {searching ? (
              <div style={{ padding: 12, color: "#b9c6d8" }}>Searching...</div>
            ) : (
              searchResults.map((item) => (
                <button
                  key={`${item.id}-${item.lat}-${item.lon}`}
                  onClick={() => handleSelectSearchResult(item)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    background: "transparent",
                    color: "white",
                    padding: "12px 14px",
                    cursor: "pointer",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{item.id}</div>
                  <div style={{ fontSize: 12, color: "#b9c6d8", marginTop: 2 }}>
                    {item.city || "—"} • {item.state || "—"} •{" "}
                    {item.country || "—"}
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        <div style={{ marginTop: 18, marginBottom: 10, fontWeight: 700 }}>
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
    Current window: {startDate || "—"} → {endDate || "—"}
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

        <div style={{ marginTop: 18, marginBottom: 10, fontWeight: 700 }}>
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
          style={{
            border: "none",
            borderRadius: 12,
            padding: "12px 18px",
            fontWeight: 700,
            cursor: selectedFPV ? "pointer" : "not-allowed",
            background: selectedFPV ? "#facc15" : "#64748b",
            color: selectedFPV ? "#111827" : "white",
            boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
          }}
        >
          Download FPV
        </button>

        <button
          onClick={() => setShowAnalytics(true)}
          disabled={!selectedFPV}
          style={{
            border: "none",
            borderRadius: 12,
            padding: "12px 18px",
            fontWeight: 700,
            cursor: selectedFPV ? "pointer" : "not-allowed",
            background: selectedFPV ? "#2563eb" : "#64748b",
            color: "white",
            boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
          }}
        >
          Environmental Insights
        </button>
      </div>

      {showVizPanel && (
        <div
          style={{
            position: "absolute",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1300,
            width: 420,
            background: "rgba(15, 23, 42, 0.96)",
            color: "white",
            padding: 16,
            borderRadius: 18,
            boxShadow: "0 18px 45px rgba(0,0,0,0.35)",
            border: "1px solid rgba(255,255,255,0.12)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12 }}>
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

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button
              onClick={handleApplyVisualization}
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 10,
                border: "none",
                background: "#2563eb",
                color: "white",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Apply
            </button>

            <button
              onClick={() => setShowVizPanel(false)}
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 10,
                border: "none",
                background: "#374151",
                color: "white",
                fontWeight: 800,
                cursor: "pointer",
              }}
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
          points={overviewPoints}
          onSelect={handleSelectOverviewPoint}
          selectedFPV={selectedFPV}
        />

        <ClickIdentify onIdentify={handleIdentifyResult} />
        <FlyToSelection target={flyTarget} />
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
    </div>
  );
}