import { useState } from "react";
import { CLIMATE_ZONES, zoneColor } from "../lib/search";

/**
 * ClimateLegend — a compact, collapsible key for the climate-zone marker
 * colours. Clicking a zone filters the map to that climate; clicking the active
 * zone (or "Show all") clears the filter.
 *
 * Props:
 *   activeZone    currently filtered zone name, or null
 *   onSelectZone  (zone) => filter the map to that climate
 *   onClear       () => clear the climate filter
 */
export default function ClimateLegend({ activeZone, onSelectZone, onClear }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className="ui-panel"
      style={{
        position: "absolute",
        bottom: 24,
        left: 20,
        zIndex: 1200,
        width: collapsed ? "auto" : 190,
        padding: collapsed ? "8px 12px" : 14,
      }}
    >
      <button
        onClick={() => setCollapsed((c) => !c)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          background: "transparent",
          border: "none",
          color: "var(--text)",
          cursor: "pointer",
          padding: 0,
        }}
        aria-expanded={!collapsed}
      >
        <span className="ui-eyebrow">Climate Zones</span>
        <span
          style={{
            color: "var(--text-mut)",
            fontSize: 12,
            transform: collapsed ? "rotate(180deg)" : "none",
            transition: "transform 0.2s ease",
          }}
        >
          ▾
        </span>
      </button>

      {!collapsed && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 2 }}>
          {CLIMATE_ZONES.map((z) => {
            const c = zoneColor(z.zone);
            const active = activeZone === z.zone;
            return (
              <button
                key={z.zone}
                onClick={() => (active ? onClear?.() : onSelectZone?.(z.zone))}
                title={`Show only ${z.zone} sites`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  textAlign: "left",
                  border: "1px solid transparent",
                  borderColor: active ? `${c}66` : "transparent",
                  background: active ? `${c}1f` : "transparent",
                  borderRadius: 8,
                  padding: "6px 8px",
                  cursor: "pointer",
                  color: "var(--text)",
                  transition: "background 0.14s ease, border-color 0.14s ease",
                }}
              >
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    flex: "0 0 auto",
                    background: c,
                    border: "2px solid #fff",
                    boxShadow: `0 0 8px ${c}88`,
                  }}
                />
                <span style={{ fontSize: 12.5, fontWeight: active ? 700 : 500 }}>
                  {z.zone}
                </span>
              </button>
            );
          })}

          {activeZone && (
            <button
              onClick={() => onClear?.()}
              style={{
                marginTop: 6,
                border: "none",
                background: "var(--surface-2)",
                color: "var(--text-dim)",
                borderRadius: 8,
                padding: "6px 8px",
                fontSize: 11.5,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Show all zones
            </button>
          )}

          <div style={{ fontSize: 10.5, color: "var(--text-mut)", marginTop: 8, lineHeight: 1.4 }}>
            Marker ring colour shows each site's climate.
          </div>
        </div>
      )}
    </div>
  );
}
