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

export default function ContributeModal({ open, onClose, initialLat, initialLon, onSubmitted, onPreview }) {
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [email, setEmail] = useState("");
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
    setEmail("");
    setSource(SOURCE_OPTIONS[0]);
    setNotes("");
    setResult(null);
    setError(null);
  }, [open, initialLat, initialLon]);

  // Live-preview the typed coordinates on the map (debounced) so the
  // contributor can confirm the pin is on the right waterbody before submitting.
  useEffect(() => {
    if (!open) return;
    const latNum = Number(lat);
    const lonNum = Number(lon);
    if (
      lat === "" ||
      lon === "" ||
      Number.isNaN(latNum) ||
      Number.isNaN(lonNum) ||
      Math.abs(latNum) > 90 ||
      Math.abs(lonNum) > 180
    ) {
      return;
    }
    const t = setTimeout(() => onPreview?.({ lat: latNum, lon: lonNum }), 500);
    return () => clearTimeout(t);
  }, [lat, lon, open, onPreview]);

  if (!open) return null;

  const latNumLive = Number(lat);
  const lonNumLive = Number(lon);
  const coordsValid =
    lat !== "" &&
    lon !== "" &&
    !Number.isNaN(latNumLive) &&
    !Number.isNaN(lonNumLive) &&
    Math.abs(latNumLive) <= 90 &&
    Math.abs(lonNumLive) <= 180;

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
          email: email.trim() || null,
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
        top: 0,
        right: 0,
        bottom: 0,
        width: 440,
        maxWidth: "94vw",
        zIndex: 2000,
        overflowY: "auto",
        background: "linear-gradient(160deg, rgba(14,23,41,0.97), rgba(9,16,30,0.96))",
        color: "white",
        borderLeft: "1px solid rgba(148,163,184,0.16)",
        boxShadow: "-24px 0 60px rgba(2,6,16,0.55)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        padding: 22,
        boxSizing: "border-box",
      }}
    >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.01em" }}>Contribute an FPV Site</div>
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
              Thanks! Your submission was received and is pending review.
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
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

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                marginBottom: 14,
              }}
            >
              <span style={{ fontSize: 11.5, color: "#8798ad" }}>
                {coordsValid
                  ? "Pin shown on the map. Check it's the right waterbody."
                  : "Enter coordinates to preview the spot on the map."}
              </span>
              <button
                type="button"
                disabled={!coordsValid}
                onClick={() =>
                  onPreview?.({ lat: Number(lat), lon: Number(lon) })
                }
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  border: "1px solid rgba(56,189,248,0.4)",
                  background: coordsValid
                    ? "rgba(56,189,248,0.14)"
                    : "rgba(255,255,255,0.05)",
                  color: coordsValid ? "#7dd3fc" : "#64748b",
                  borderRadius: 8,
                  padding: "6px 11px",
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: coordsValid ? "pointer" : "not-allowed",
                  whiteSpace: "nowrap",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
                </svg>
                Preview on map
              </button>
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
              <label style={labelStyle}>Your email (optional)</label>
              <input
                style={inputStyle}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="So the team can thank you or follow up"
              />
              <div style={{ fontSize: 11, color: "#7c8ba1", marginTop: 5 }}>
                Only used to credit or contact you about this submission, and never shown publicly.
              </div>
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
  );
}
