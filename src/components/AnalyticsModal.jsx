import "./AnalyticsModal.css";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function showNumber(value, digits = 2, suffix = "") {
  if (value === null || value === undefined || value === "") return "Not available";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return `${n.toFixed(digits)}${suffix}`;
}

function StatBox({ label, value }) {
  return (
    <div className="stat-box">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

export default function AnalyticsModal({ open, onClose, metrics }) {
  if (!open) return null;

  const isLoading = !metrics;
  const hasError = metrics?.error;

  const isNoData =
    metrics?.ndci?.message ||
    metrics?.chla?.message ||
    metrics?.wst?.message;

  const hasTooFewSeriesPoints =
    !isNoData &&
    ((metrics?.ndci_series?.length || 0) <= 1 ||
      (metrics?.wst_series?.length || 0) <= 1);

  const geometryNote =
    typeof metrics?.geometry_note === "object"
      ? `Sentinel-2: ${metrics?.geometry_note?.sentinel2 || "Not available"} | Landsat-8: ${
          metrics?.geometry_note?.landsat8 || "Not available"
        }`
      : metrics?.geometry_note || "Not available";

  return (
    <div className="analytics-backdrop">
      <div className="analytics-modal">
        <div className="analytics-header">
          <h2>Environmental Insights</h2>
          <button className="analytics-close" onClick={onClose}>
            ×
          </button>
        </div>

        {isLoading ? (
          <div style={{ color: "#94a3b8", padding: "24px" }}>
            Loading environmental metrics...
          </div>
        ) : hasError ? (
          <div style={{ color: "#f87171", padding: "24px" }}>
            Could not load environmental metrics: {metrics.error}
          </div>
        ) : (
          <>
            <div className="analytics-stats">
              <div className="analytics-stat-card">
                <span>Chl-a Mean</span>
                <strong>{showNumber(metrics?.chla?.mean, 2)}</strong>
              </div>
              <div className="analytics-stat-card">
                <span>Chl-a Median</span>
                <strong>{showNumber(metrics?.chla?.median, 2)}</strong>
              </div>
              <div className="analytics-stat-card">
                <span>WST Mean</span>
                <strong>{showNumber(metrics?.wst?.mean, 2, " °C")}</strong>
              </div>
              <div className="analytics-stat-card">
                <span>WST Median</span>
                <strong>{showNumber(metrics?.wst?.median, 2, " °C")}</strong>
              </div>
            </div>

            <div className="section-title">Environmental Metrics</div>

            <div
              style={{
                marginTop: "8px",
                padding: "12px",
                borderRadius: "12px",
                background: "rgba(15, 23, 42, 0.75)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  color: "#94a3b8",
                  marginBottom: "10px",
                }}
              >
                Based on cleaned waterbody geometry: FPV footprint removed +
                shoreline buffer.
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "10px",
                }}
              >
                <StatBox
                  label="WST Median"
                  value={showNumber(metrics?.wst?.median, 2, " °C")}
                />
                <StatBox
                  label="WST Mean"
                  value={showNumber(metrics?.wst?.mean, 2, " °C")}
                />
                <StatBox
                  label="WST Pixels"
                  value={showNumber(metrics?.wst?.count, 0)}
                />

                <StatBox
                  label="Chl-a Median"
                  value={showNumber(metrics?.chla?.median, 2)}
                />
                <StatBox
                  label="Chl-a Mean"
                  value={showNumber(metrics?.chla?.mean, 2)}
                />
                <StatBox
                  label="Chl-a Pixels"
                  value={showNumber(metrics?.chla?.count, 0)}
                />

                <StatBox
                  label="NDCI Median"
                  value={showNumber(metrics?.ndci?.median, 3)}
                />
                <StatBox
                  label="NDCI Mean"
                  value={showNumber(metrics?.ndci?.mean, 3)}
                />
                <StatBox
                  label="NDCI Pixels"
                  value={showNumber(metrics?.ndci?.count, 0)}
                />
              </div>

              <div
                style={{
                  marginTop: "12px",
                  fontSize: "12px",
                  color: "#94a3b8",
                }}
              >
                Geometry: {geometryNote}
              </div>

              <div
                style={{
                  marginTop: "12px",
                  padding: "10px",
                  borderRadius: "8px",
                  background: "rgba(250, 204, 21, 0.08)",
                  border: "1px solid rgba(250, 204, 21, 0.25)",
                  color: "#e5e7eb",
                  fontSize: "12px",
                }}
              >
                <strong style={{ color: "#facc15" }}>⚠ Data Note:</strong>{" "}
                Chlorophyll-a is an uncalibrated satellite proxy derived from
                NDCI. Use for relative trends only.
              </div>
            </div>

            {isNoData ? (
              <div
                style={{
                  marginTop: "16px",
                  padding: "14px",
                  borderRadius: "12px",
                  background: "rgba(248, 113, 113, 0.12)",
                  border: "1px solid rgba(248, 113, 113, 0.35)",
                  color: "#fecaca",
                  fontSize: "13px",
                  textAlign: "center",
                  fontWeight: 600,
                }}
              >
                ⚠ {isNoData}
              </div>
            ) : (
              <>
                {hasTooFewSeriesPoints && (
                  <div
                    style={{
                      color: "#facc15",
                      marginTop: "14px",
                      marginBottom: "10px",
                      fontSize: "13px",
                      padding: "10px",
                      borderRadius: "8px",
                      background: "rgba(250, 204, 21, 0.08)",
                      border: "1px solid rgba(250, 204, 21, 0.25)",
                    }}
                  >
                    ⚠ Not enough valid monthly data for a reliable time-series.
                    Increase the time window.
                  </div>
                )}

                <div className="chart-block">
                  <h3>Monthly Median NDCI</h3>
                  <div style={{ width: "100%", height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={metrics?.ndci_series || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" hide />
                        <YAxis tickFormatter={(v) => Number(v).toFixed(2)} />
                        <Tooltip formatter={(v) => Number(v).toFixed(2)} />
                        <Line type="monotone" dataKey="value" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="chart-block">
                  <h3>Monthly Median WST</h3>
                  <div style={{ width: "100%", height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={metrics?.wst_series || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" hide />
                        <YAxis tickFormatter={(v) => Number(v).toFixed(2)} />
                        <Tooltip formatter={(v) => Number(v).toFixed(2)} />
                        <Line type="monotone" dataKey="value" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}