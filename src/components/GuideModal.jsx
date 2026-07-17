import { useState } from "react";

const STEPS = [
  {
    icon: "☀",
    color: "#fbbf24",
    title: "What is this?",
    body: "The world's first public dashboard for global Floating Photovoltaics (FPV). These are solar panels that float on lakes and reservoirs. Every yellow node on the map is a real floating-solar installation, mapped from satellite imagery.",
  },
  {
    icon: "🛰",
    color: "#38bdf8",
    title: "The dataset",
    body: "Each site links to its waterbody and carries hard numbers: panel area, how much of the water it covers, the reservoir's size, and satellite water-quality metrics (chlorophyll-a, NDCI, and water-surface temperature) tracked over time.",
  },
  {
    icon: "🌍",
    color: "#34d399",
    title: "Climate intelligence",
    body: "Every site is tagged with its Köppen climate zone (Tropical, Arid, Temperate, Cold, or Polar), sampled from a global climate raster. Search a zone to instantly see where floating solar is deployed across different climates.",
  },
  {
    icon: "🔍",
    color: "#a78bfa",
    title: "How to explore",
    body: "Use the search bar to jump to an FPV ID, country, city, waterbody, climate zone, or raw coordinates. Click any site for its full profile, or open Environmental Insights to see water-quality trends before and after the panels were installed.",
  },
  {
    icon: "🌱",
    color: "#4ade80",
    title: "Why it matters",
    body: "Floating solar generates clean energy without taking farmland, and can reduce evaporation and algal blooms. Researchers, NGOs, and planners use this to study its real environmental impact and find the best places to build next. You can also add sites we've missed using “Contribute a Site.”",
  },
];

export default function GuideModal({ open, onClose }) {
  const [step, setStep] = useState(0);
  if (!open) return null;

  const s = STEPS[step];
  const last = step === STEPS.length - 1;

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
          width: 520,
          maxWidth: "94vw",
          padding: 0,
          overflow: "hidden",
          animation: "analytics-rise 0.3s cubic-bezier(0.22,1,0.36,1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header band */}
        <div
          style={{
            padding: "20px 24px 16px",
            background:
              "radial-gradient(120% 140% at 0% 0%, rgba(56,189,248,0.16), transparent 60%), radial-gradient(120% 140% at 100% 0%, rgba(251,191,36,0.14), transparent 55%)",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <div className="ui-eyebrow" style={{ display: "block", marginBottom: 4 }}>
              Welcome
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>
              Global FPV Dashboard
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
            aria-label="Close guide"
          >
            ×
          </button>
        </div>

        {/* Step body */}
        <div style={{ padding: "24px 24px 8px", minHeight: 168 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div
              style={{
                flex: "0 0 auto",
                width: 52,
                height: 52,
                borderRadius: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                background: `${s.color}1f`,
                border: `1px solid ${s.color}55`,
                boxShadow: `0 0 22px ${s.color}33`,
              }}
            >
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>
                {s.title}
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-dim)" }}>
                {s.body}
              </div>
            </div>
          </div>
        </div>

        {/* Footer: dots + nav */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 24px 22px",
          }}
        >
          <div style={{ display: "flex", gap: 7 }}>
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                aria-label={`Go to step ${i + 1}`}
                style={{
                  width: i === step ? 22 : 8,
                  height: 8,
                  borderRadius: 999,
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  background: i === step ? "var(--accent)" : "rgba(255,255,255,0.18)",
                  transition: "all 0.2s ease",
                }}
              />
            ))}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            {step > 0 && (
              <button className="btn btn-ghost" onClick={() => setStep((n) => n - 1)}>
                Back
              </button>
            )}
            {last ? (
              <button className="btn btn-primary" onClick={onClose}>
                Start exploring
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => setStep((n) => n + 1)}>
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
