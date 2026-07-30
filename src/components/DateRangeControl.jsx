const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MIN_YEAR = 2013; // Landsat-8 era; Sentinel-2 from 2015
const pad2 = (n) => String(n).padStart(2, "0");
const lastDayOfMonth = (y, m) => new Date(y, m, 0).getDate(); // m = 1-12
const todayISO = () => new Date().toISOString().slice(0, 10);

function toISO(y, m, d) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

// Parse "YYYY-MM-DD" -> { y, m } (falls back gracefully).
function parse(iso) {
  const [y, m] = String(iso || "").split("-").map(Number);
  return { y: y || new Date().getFullYear(), m: m || 1 };
}

export default function DateRangeControl({
  startDate,
  endDate,
  setStartDate,
  setEndDate,
}) {
  const now = new Date();
  const currentYear = now.getFullYear();

  const years = [];
  for (let y = currentYear; y >= MIN_YEAR; y--) years.push(y);
  const chipYears = years.slice(0, 5); // current year + previous four

  const start = parse(startDate);
  const end = parse(endDate);
  const invalid =
    startDate && endDate && new Date(endDate) <= new Date(startDate);

  function setYearPreset(y) {
    setStartDate(toISO(y, 1, 1));
    setEndDate(y === currentYear ? todayISO() : toISO(y, 12, 31));
  }

  function setLast12Months() {
    const s = new Date(now);
    s.setFullYear(now.getFullYear() - 1);
    setStartDate(s.toISOString().slice(0, 10));
    setEndDate(todayISO());
  }

  function onStartChange(y, m) {
    setStartDate(toISO(y, m, 1));
  }

  function onEndChange(y, m) {
    // Last day of the chosen month, capped at today.
    const last = toISO(y, m, lastDayOfMonth(y, m));
    setEndDate(last > todayISO() ? todayISO() : last);
  }

  const isYearActive = (y) =>
    startDate === toISO(y, 1, 1) &&
    (endDate === toISO(y, 12, 31) ||
      (y === currentYear && endDate === todayISO()));

  const isLast12Active = (() => {
    const s = new Date(now);
    s.setFullYear(now.getFullYear() - 1);
    return startDate === s.toISOString().slice(0, 10) && endDate === todayISO();
  })();

  const selectStyle = {
    padding: "8px 9px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--surface-2)",
    color: "var(--text)",
    fontSize: 13,
    outline: "none",
    cursor: "pointer",
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.05)",
        padding: 12,
        borderRadius: 12,
      }}
    >
      <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 10 }}>
        Drives NDCI, Chlorophyll-a, WST analysis, and the Sentinel-2 imagery
        below.
      </div>

      {/* Quick presets */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        <button
          className={`seg-btn${isLast12Active ? " active" : ""}`}
          onClick={setLast12Months}
        >
          Last 12 mo
        </button>
        {chipYears.map((y) => (
          <button
            key={y}
            className={`seg-btn${isYearActive(y) ? " active" : ""}`}
            onClick={() => setYearPreset(y)}
          >
            {y}
          </button>
        ))}
      </div>

      {/* Month + year dropdowns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <div style={{ fontSize: 11.5, color: "var(--text-mut)", marginBottom: 6 }}>
            Start
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <select
              style={selectStyle}
              value={start.m}
              onChange={(e) => onStartChange(start.y, Number(e.target.value))}
              aria-label="Start month"
            >
              {MONTHS.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
            <select
              style={selectStyle}
              value={start.y}
              onChange={(e) => onStartChange(Number(e.target.value), start.m)}
              aria-label="Start year"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11.5, color: "var(--text-mut)", marginBottom: 6 }}>
            End
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <select
              style={selectStyle}
              value={end.m}
              onChange={(e) => onEndChange(end.y, Number(e.target.value))}
              aria-label="End month"
            >
              {MONTHS.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
            <select
              style={selectStyle}
              value={end.y}
              onChange={(e) => onEndChange(Number(e.target.value), end.m)}
              aria-label="End year"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-mut)", lineHeight: 1.4 }}>
        Current window: {startDate || "not set"} to {endDate || "not set"}
      </div>

      {invalid && (
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
  );
}
