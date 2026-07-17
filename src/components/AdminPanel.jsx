import { useEffect, useState } from "react";
import { API_BASE } from "../apiConfig";
import { toCSV, downloadText, timestamp } from "../lib/exporters";

const EXPORT_COLUMNS = [
  { key: "id", label: "id" },
  { key: "status", label: "status" },
  { key: "name", label: "name" },
  { key: "lat", label: "latitude" },
  { key: "lon", label: "longitude" },
  { key: "country", label: "country" },
  { key: "source", label: "source" },
  { key: "email", label: "email" },
  { key: "notes", label: "notes" },
  { key: "duplicate_flag", label: "duplicate_flag" },
  { key: "duplicate_note", label: "duplicate_note" },
  { key: "created_at", label: "created_at" },
  { key: "reviewed_at", label: "reviewed_at" },
  { key: "review_note", label: "review_note" },
];

const STORAGE_KEY = "fpv_admin_key";

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

const TABS = ["pending", "approved", "rejected", "all"];

function StatusBadge({ status }) {
  const colors = {
    pending: { bg: "rgba(250,204,21,0.15)", border: "rgba(250,204,21,0.4)", color: "#fde68a" },
    approved: { bg: "rgba(74,222,128,0.15)", border: "rgba(74,222,128,0.4)", color: "#bbf7d0" },
    rejected: { bg: "rgba(248,113,113,0.15)", border: "rgba(248,113,113,0.4)", color: "#fecaca" },
  };
  const c = colors[status] || colors.pending;

  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: "3px 9px",
        borderRadius: 999,
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.color,
        textTransform: "uppercase",
        letterSpacing: 0.4,
      }}
    >
      {status}
    </span>
  );
}

export default function AdminPanel({ open, onClose, onReviewed, onLocate, onApproved }) {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem(STORAGE_KEY) || "");
  const [keyInput, setKeyInput] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [tab, setTab] = useState("pending");
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actingId, setActingId] = useState(null);
  const [locatedId, setLocatedId] = useState(null);

  function locate(s) {
    if (s?.lat == null || s?.lon == null) return;
    setLocatedId(s.id);
    onLocate?.(s);
  }

  function handleExport() {
    if (submissions.length === 0) return;
    const csv = toCSV(submissions, EXPORT_COLUMNS);
    downloadText(
      `fpv-submissions_${tab}_${timestamp()}.csv`,
      csv,
      "text/csv"
    );
  }

  useEffect(() => {
    if (!open) return;
    if (adminKey) {
      setUnlocked(true);
    }
  }, [open, adminKey]);

  useEffect(() => {
    if (!open || !unlocked) return;
    loadSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, unlocked, tab]);

  async function loadSubmissions() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE}/api/submissions?status=${tab}`, {
        headers: { "x-admin-key": adminKey },
      });

      if (res.status === 401) {
        setUnlocked(false);
        localStorage.removeItem(STORAGE_KEY);
        setError("That admin key was rejected. Please re-enter it.");
        return;
      }

      if (res.status === 503) {
        setError("Admin review isn't configured on the server yet (ADMIN_KEY missing).");
        return;
      }

      if (!res.ok) {
        throw new Error(`Failed to load submissions (${res.status})`);
      }

      const data = await res.json();
      setSubmissions(data.submissions || []);
    } catch (err) {
      setError(err.message || "Failed to load submissions.");
    } finally {
      setLoading(false);
    }
  }

  function handleUnlock(e) {
    e.preventDefault();
    if (!keyInput.trim()) return;
    localStorage.setItem(STORAGE_KEY, keyInput.trim());
    setAdminKey(keyInput.trim());
    setUnlocked(true);
    setKeyInput("");
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE_KEY);
    setAdminKey("");
    setUnlocked(false);
    setSubmissions([]);
  }

  async function handleAction(id, action) {
    try {
      setActingId(id);

      const body = action === "reject" ? { reason: "Rejected by admin" } : { note: "Approved by admin" };
      const target = submissions.find((s) => s.id === id);

      const res = await fetch(`${API_BASE}/api/submissions/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Action failed (${res.status})`);
      }

      if (action === "approve" && target) onApproved?.(target);

      await loadSubmissions();
      onReviewed?.();
    } catch (err) {
      setError(err.message || "Action failed.");
    } finally {
      setActingId(null);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm(`Permanently delete submission #${id}? This cannot be undone.`)) {
      return;
    }
    try {
      setActingId(id);
      const res = await fetch(`${API_BASE}/api/submissions/${id}`, {
        method: "DELETE",
        headers: { "x-admin-key": adminKey },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Delete failed (${res.status})`);
      }
      if (locatedId === id) setLocatedId(null);
      await loadSubmissions();
      onReviewed?.();
    } catch (err) {
      setError(err.message || "Delete failed.");
    } finally {
      setActingId(null);
    }
  }

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: 460,
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
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.01em" }}>
              Submission Review Queue
            </div>
            {unlocked && (
              <div style={{ fontSize: 11.5, color: "#8798ad", marginTop: 3 }}>
                Click a submission to locate it on the map
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: "white", fontSize: 22, cursor: "pointer", lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {!unlocked ? (
          <form onSubmit={handleUnlock} style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, color: "#b9c6d8", marginBottom: 12 }}>
              Enter the admin key to review community submissions.
            </div>
            <input
              style={inputStyle}
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Admin key"
              autoFocus
            />
            {error && <div style={{ color: "#fecaca", fontSize: 12, marginTop: 10 }}>{error}</div>}
            <button
              type="submit"
              style={{
                marginTop: 14,
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
              Unlock
            </button>
          </form>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 8 }}>
                {TABS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    style={{
                      border: "none",
                      borderRadius: 8,
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      background: tab === t ? "#facc15" : "rgba(255,255,255,0.08)",
                      color: tab === t ? "#111827" : "white",
                      textTransform: "capitalize",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  onClick={handleExport}
                  disabled={submissions.length === 0}
                  title="Download the current list as a CSV file"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    border: "1px solid rgba(56,189,248,0.4)",
                    background: submissions.length ? "rgba(56,189,248,0.14)" : "rgba(255,255,255,0.05)",
                    color: submissions.length ? "#7dd3fc" : "#64748b",
                    borderRadius: 8,
                    padding: "5px 10px",
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: submissions.length ? "pointer" : "not-allowed",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Export file
                </button>
                <button
                  onClick={handleLogout}
                  style={{ background: "transparent", border: "none", color: "#9fb0c3", fontSize: 12, cursor: "pointer" }}
                >
                  Log out
                </button>
              </div>
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

            {loading ? (
              <div style={{ color: "#94a3b8", padding: "20px 0" }}>Loading...</div>
            ) : submissions.length === 0 ? (
              <div style={{ color: "#94a3b8", padding: "20px 0" }}>No {tab} submissions.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {submissions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => locate(s)}
                    title="Click to locate on the map"
                    style={{
                      background:
                        locatedId === s.id
                          ? "rgba(251,191,36,0.1)"
                          : "rgba(255,255,255,0.05)",
                      border:
                        locatedId === s.id
                          ? "1px solid rgba(251,191,36,0.5)"
                          : "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 12,
                      padding: 14,
                      cursor: "pointer",
                      transition: "border-color 0.16s ease, background 0.16s ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>
                          {s.name || "Unnamed site"} <span style={{ color: "#9fb0c3", fontWeight: 400 }}>#{s.id}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "#b9c6d8", marginTop: 2, fontFamily: "var(--font-mono)" }}>
                          {s.lat?.toFixed(4)}, {s.lon?.toFixed(4)}
                          <span style={{ fontFamily: "var(--font-ui)" }}>
                            {" • "}
                            {s.country || "Unknown country"} • {s.source}
                          </span>
                        </div>
                      </div>
                      <StatusBadge status={s.status} />
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        locate(s);
                      }}
                      style={{
                        marginTop: 10,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        border: "1px solid rgba(56,189,248,0.4)",
                        background: "rgba(56,189,248,0.14)",
                        color: "#7dd3fc",
                        borderRadius: 8,
                        padding: "5px 10px",
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                        <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
                      </svg>
                      Locate on map
                    </button>

                    {s.email && (
                      <div style={{ fontSize: 12, marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ color: "#9fb0c3" }}>Contact:</span>
                        <a
                          href={`mailto:${s.email}?subject=${encodeURIComponent(
                            "Thank you for your FPV Dashboard contribution"
                          )}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{ color: "#7dd3fc", fontFamily: "var(--font-mono)", fontSize: 11.5 }}
                        >
                          {s.email}
                        </a>
                      </div>
                    )}

                    {s.notes && (
                      <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 8 }}>{s.notes}</div>
                    )}

                    {s.duplicate_flag ? (
                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 11,
                          color: "#fde68a",
                          background: "rgba(250,204,21,0.08)",
                          border: "1px solid rgba(250,204,21,0.25)",
                          borderRadius: 8,
                          padding: "6px 8px",
                        }}
                      >
                        ⚠ Possible duplicate: {s.duplicate_note}
                      </div>
                    ) : null}

                    <div style={{ fontSize: 11, color: "#7c8ba1", marginTop: 8 }}>
                      Submitted {new Date(s.created_at).toLocaleString()}
                      {s.reviewed_at ? ` • Reviewed ${new Date(s.reviewed_at).toLocaleString()}` : ""}
                    </div>

                    {s.status === "pending" && (
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <button
                          disabled={actingId === s.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction(s.id, "approve");
                          }}
                          style={{
                            flex: 1,
                            border: "none",
                            borderRadius: 8,
                            padding: "8px 10px",
                            fontWeight: 700,
                            fontSize: 12,
                            cursor: actingId === s.id ? "not-allowed" : "pointer",
                            background: "#22c55e",
                            color: "#052e16",
                          }}
                        >
                          Approve
                        </button>
                        <button
                          disabled={actingId === s.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction(s.id, "reject");
                          }}
                          style={{
                            flex: 1,
                            border: "none",
                            borderRadius: 8,
                            padding: "8px 10px",
                            fontWeight: 700,
                            fontSize: 12,
                            cursor: actingId === s.id ? "not-allowed" : "pointer",
                            background: "#ef4444",
                            color: "white",
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                      <button
                        disabled={actingId === s.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(s.id);
                        }}
                        style={{
                          border: "1px solid rgba(248,113,113,0.35)",
                          background: "transparent",
                          color: "#fca5a5",
                          borderRadius: 8,
                          padding: "5px 10px",
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: actingId === s.id ? "not-allowed" : "pointer",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
    </div>
  );
}
