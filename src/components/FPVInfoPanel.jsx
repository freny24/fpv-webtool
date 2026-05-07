import "./FPVInfoPanel.css";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function showValue(value, fallback = "—") {
  return value === null || value === undefined || value === ""
    ? fallback
    : String(value);
}

function showNumber(value, digits = 2, suffix = "") {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return `${n.toFixed(digits)}${suffix}`;
}

function lakeTypeLabel(value) {
  const v = Number(value);
  if (Number.isNaN(v)) return showValue(value);

  const mapping = {
    1: "Lake",
    2: "Reservoir",
    3: "Lake with control",
  };

  return mapping[v] || `Type ${v}`;
}

function StatBox({ label, value }) {
  return (
    <div className="stat-box">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}

export default function FPVInfoPanel({ fpv, waterbody, onClose }) {
  if (!fpv) return null;

  const title =
    fpv.fpv_new_id ||
    fpv.Nobre_Name ||
    fpv.name ||
    fpv.id ||
    "FPV Site";

  const subtitle = [fpv.country, fpv.state, fpv.city].filter(Boolean).join(" • ");

  function downloadJson() {
    const blob = new Blob(
      [JSON.stringify({ fpv, waterbody }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fpv.fpv_new_id || fpv.id || "fpv-feature"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const fpvArea =
    fpv?.fpv_area_k ?? fpv?.fpv_area ?? null;

  const waterbodyArea =
    waterbody?.wb_area ?? waterbody?.wb_area_km ?? waterbody?.wb_area_af ?? null;

  const coverage =
  waterbody?.fpv_cov ??
  waterbody?.fpv_covera ??
  fpv?.fpv_cov ??
  fpv?.fpv_covera ??
  null;

  const wbName =
    waterbody?.lake_name ?? waterbody?.Lake_name ?? null;

  const wbType =
    waterbody?.Lake_type ?? waterbody?.lake_type ?? null;

  return (
    <div className="fpv-panel">
      <div className="fpv-panel-header">
        <div>
          <div className="fpv-panel-title">{showValue(title)}</div>
          <div className="fpv-panel-subtitle">
            {showValue(subtitle, "Location unavailable")}
          </div>
        </div>
        <button className="fpv-close-btn" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="badge-row">
        <span className="badge badge-yellow">FPV</span>
        <span className="badge badge-blue">
          {showValue(lakeTypeLabel(wbType), "Waterbody")}
        </span>
      </div>

      <div className="section-title">Quick Summary</div>
      <div className="stats-grid">
        <StatBox
          label="FPV Area"
          value={showNumber(fpvArea, 2, " km²")}
        />
        <StatBox
          label="Waterbody Area"
          value={showNumber(waterbodyArea, 2, " km²")}
        />
        <StatBox
          label="Coverage"
          value={showNumber(coverage, 2, "%")}
        />
        <StatBox
          label="FPV Count in WB"
          value={showValue(waterbody?.n_fpv)}
        />
      </div>

      <div className="section-title">Location Details</div>
      <div className="details-grid">
        <DetailRow label="Country" value={showValue(fpv.country || waterbody?.country)} />
        <DetailRow label="State" value={showValue(fpv.state || waterbody?.state)} />
        <DetailRow label="City" value={showValue(fpv.city || waterbody?.city)} />
        <DetailRow label="Latitude" value={showValue(fpv.lat)} />
        <DetailRow label="Longitude" value={showValue(fpv.lon)} />
        <DetailRow label="Lake Name" value={showValue(wbName, "Not available")} />
      </div>

      <div className="section-title">Feature IDs</div>
      <div className="details-grid">
        <DetailRow label="FPV ID" value={showValue(fpv.fpv_new_id)} />
        <DetailRow label="Legacy FPV ID" value={showValue(fpv.fpv_id || fpv.id)} />
        <DetailRow
          label="Waterbody ID"
          value={showValue(fpv.wb_new_id || waterbody?.wb_new_id)}
        />
      </div>

      {waterbody && (
        <>
          <div className="section-title">Waterbody Attributes</div>
          <div className="details-grid">
            <DetailRow label="WB ID" value={showValue(waterbody.wb_new_id)} />
            <DetailRow label="WB Name" value={showValue(wbName, "Not available")} />
            <DetailRow label="WB Type" value={showValue(lakeTypeLabel(wbType))} />
            <DetailRow label="WB Area (km²)" value={showNumber(waterbody.wb_area, 2)} />
            <DetailRow label="No-panel Area" value={showNumber(waterbody.wb_area_af, 2, " km²")} />
            <DetailRow label="FPV Coverage" value={showNumber(coverage, 2, "%")} />
            <DetailRow label="Depth Avg" value={showNumber(waterbody.depth_avg || waterbody.Depth_avg, 2)} />
            <DetailRow label="HydroLAKES ID" value={showValue(waterbody.hylak_id || waterbody.Hylak_id)} />
            <DetailRow label="WB Latitude" value={showValue(waterbody.lat)} />
            <DetailRow label="WB Longitude" value={showValue(waterbody.lon)} />
            <DetailRow label="FPV Count in WB" value={showValue(waterbody.n_fpv)} />
            <DetailRow label="FPV IDs in WB" value={showValue(waterbody.fpv_ids)} />
          </div>
        </>
      )}

      <div className="panel-actions">
        <button className="download-btn" onClick={downloadJson}>
          Download JSON
        </button>
      </div>
    </div>
  );
}