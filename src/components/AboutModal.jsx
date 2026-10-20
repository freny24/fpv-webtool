// Logos: drop oneill-logo.png and luddy-logo.png into /public. If absent, the
// image hides itself and the text affiliation still shows.
const TEAM = [
  {
    name: "Dr. Rafael M. Almeida",
    role: "Principal Investigator & Research Supervisor",
    org: "O'Neill School, Indiana University",
  },
  {
    name: "Aline Valerio",
    role: "Postdoctoral Research Associate",
    org: "O'Neill School, Indiana University",
  },
  {
    name: "Freny Reji",
    role: "Graduate Data Science Research Assistant",
    org: "Luddy School, Indiana University",
  },
  {
    name: "Sakshi Nair",
    role: "Graduate Data Science Research Assistant",
    org: "Luddy School, Indiana University",
  },
  {
    name: "Heeya Amin",
    role: "Graduate Data Science Research Assistant",
    org: "Luddy School, Indiana University",
  },
];

function hideOnError(e) {
  e.currentTarget.style.display = "none";
}

export default function AboutModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2100,
        background: "rgba(3,7,16,0.62)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        className="ui-panel"
        style={{
          width: 560,
          maxWidth: "94vw",
          maxHeight: "88vh",
          overflowY: "auto",
          padding: 0,
          animation: "analytics-rise 0.3s cubic-bezier(0.22,1,0.36,1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <div className="ui-eyebrow" style={{ display: "block", marginBottom: 4 }}>
              About this Dashboard
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>
              Aquatic Solar (AqPV)
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "none",
              color: "#cbd5e1",
              width: 30,
              height: 30,
              borderRadius: "50%",
              fontSize: 18,
              lineHeight: 1,
              cursor: "pointer",
            }}
            aria-label="Close about"
          >
            ×
          </button>
        </div>

        <div style={{ padding: "20px 24px 24px" }}>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-dim)", margin: "0 0 18px" }}>
            The first public, interactive dashboard for global aquatic
            photovoltaic (AqPV) installations — floating and pile-mounted solar
            on lakes, reservoirs, and aquaculture ponds. It maps thousands of
            installations and their host waterbodies, with satellite-derived
            environmental metrics and climate classification computed through
            Google Earth Engine. Developed as a research project of Indiana
            University, supporting an accompanying dataset publication.
          </p>

          <div className="ui-eyebrow" style={{ display: "block", marginBottom: 12 }}>
            The Team
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
            {TEAM.map((m) => (
              <div
                key={m.name}
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                  padding: "11px 13px",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700 }}>{m.name}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 2 }}>
                  {m.role}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-mut)", marginTop: 1 }}>
                  {m.org}
                </div>
              </div>
            ))}
          </div>

          {/* Affiliations */}
          <div className="ui-eyebrow" style={{ display: "block", marginBottom: 12 }}>
            Affiliations
          </div>
          <div
            style={{
              background: "#fff",
              borderRadius: "var(--r-md)",
              padding: "16px 18px",
              display: "flex",
              alignItems: "center",
              gap: 22,
              flexWrap: "wrap",
            }}
          >
            <img
              src="/oneill-logo.png"
              alt="O'Neill School of Public and Environmental Affairs"
              onError={hideOnError}
              style={{ height: 44, objectFit: "contain" }}
            />
            <img
              src="/luddy-logo.jpg"
              alt="Luddy School of Informatics, Computing, and Engineering"
              onError={hideOnError}
              style={{ height: 44, objectFit: "contain" }}
            />
          </div>
          <div style={{ fontSize: 12, color: "var(--text-mut)", marginTop: 10, lineHeight: 1.5 }}>
            Indiana University · O'Neill School of Public and Environmental
            Affairs · Luddy School of Informatics, Computing, and Engineering
          </div>

          <div style={{ fontSize: 11.5, color: "var(--text-mut)", marginTop: 16 }}>
            Dataset: Valerio, A.M., et al. (2026). Aquatic Solar. Zenodo.
          </div>
        </div>
      </div>
    </div>
  );
}
