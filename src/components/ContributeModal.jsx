import { useEffect, useState } from "react";
import { API_BASE } from "../apiConfig";

const SOURCE_OPTIONS = [
  "Field visit",
  "News or article",
  "Satellite imagery",
  "Local knowledge",
  "Company/operator website",
  "Other",
];

const inputStyle = {
  width: "100%",
  padding: "9px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  outline: "none",
  boxSizing: "border-box",
  fontSize: 13,
};

const labelStyle = {
  fontSize: 12,
  color: "#9fb0c3",
  marginBottom: 6,
  display: "block",
};

export default function ContributeModal({ open, onClose, initialLat, initialLon, onSubmitted }) {
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [source, setSource] = useState(SOURCE_OPTIONS[0]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { ok, message, duplicate }
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setLat(initialLat != null ? String(initialLat) : "");
    setLon(initialLon != null ? String(initialLon) : "");
    setName("");
    setCountry("");
    setSource(SOURCE_OPTIONS[0]);
    setNotes("");
    setResult(null);
    setError(null);
  }, [open, initialLat, initialLon]);

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const latNum = Number(lat);
    const lonNum = Number(lon);

    if (Number.isNaN(latNum) || Number.isNaN(lonNum) || latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
      setError("Enter a valid latitude (-90 to 90) and longitude (-180 to 180).");
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch(`${API_BASE}/api/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: latNum,
          lon: lonNum,
          name: name.trim() || null,
          country: country.trim() || null,
          source,
          notes: notes.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || `Submission failed (${res.status})`);
      }

      setResult({
        ok: true,
        duplicate: data.submission?.duplicate_flag,
        duplicateNote: data.submission?.duplicate_note,
      });

      onSubmitted?.(data.submission);
    } catch (err) {
      setError(err.message || "Something went wrong submitting this site.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 440,
          maxWidth: "90vw",
          maxHeight: "85vh",
          overflowY: "auto",
          background: "linear-gradient(135deg, rgba(7,15,30,0.97), rgba(20,34,56,0.95))",
          color: "white",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 20px 50px rgba(0,0,0,0.4)",
          padding: 22,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Contribute an FPV Site</div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: "white", fontSize: 22, cursor: "pointer", lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <div style={{ fontSize: 13, color: "#b9c6d8", marginBottom: 18 }}>
          Know a floating solar site that's missing from the map? Submit it below.
          Every submission is reviewed by the team before it appears publicly.
        </div>

        {result?.ok ? (
          <div>
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 12,
                background: "rgba(74, 222, 128, 0.12)",
                border: "1px solid rgba(74, 222, 128, 0.35)",
                color: "#bbf7d0",
                fontSize: 13,
                marginBottom: 14,
              }}
            >
              Thanks — your submission was received and is pending review.
            </div>

            {result.duplicate && (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "rgba(250, 204, 21, 0.1)",
                  border: "1px solid rgba(250, 204, 21, 0.3)",
                  color: "#fde68a",
                  fontSize: 12,
                  marginBottom: 14,
                }}
              >
                Heads up: this looks close to an existing site or submission
                ({result.duplicateNote}). It's still been submitted for review.
              </div>
            )}

            <button
              onClick={onClose}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "none",
                background: "#2563eb",
                color: "white",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Latitude *</label>
                <input
                  style={inputStyle}
                  type="number"
                  step="any"
                  required
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="e.g. 18.73"
                />
              </div>
              <div>
                <label style={labelStyle}>Longitude *</label>
                <input
                  style={inputStyle}
                  type="number"
                  step="any"
                  required
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                  placeholder="e.g. 79.46"
                />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Site name (optional)</label>
              <input style={inputStyle} type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ramagundam FPV" />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Country (optional)</label>
              <input style={inputStyle} type="text" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. India" />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Source *</label>
              <select style={inputStyle} value={source} onChange={(e) => setSource(e.target.value)} required>
                {SOURCE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Notes (optional)</label>
              <textarea
                style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything else that helps us verify this site"
              />
            </div>

            {error && (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "rgba(248,113,113,0.12)",
                  border: "1px solid rgba(248,113,113,0.3)",
                  color: "#fecaca",
                  fontSize: 12,
                  marginBottom: 14,
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "none",
                  background: submitting ? "#64748b" : "#facc15",
                  color: "#111827",
                  fontWeight: 800,
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
              >
                {submitting ? "Submitting..." : "Submit for review"}
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "none",
                  background: "#374151",
                  color: "white",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
