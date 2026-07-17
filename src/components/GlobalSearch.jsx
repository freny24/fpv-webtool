import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import "./GlobalSearch.css";
import {
  searchPoints,
  highlightSegments,
  zoneColor,
  parseCoordinateQuery,
} from "../lib/search";

function Highlighted({ text, query }) {
  const segs = highlightSegments(text, query);
  return (
    <>
      {segs.map((s, i) =>
        s.hit ? <mark key={i}>{s.text}</mark> : <span key={i}>{s.text}</span>
      )}
    </>
  );
}

function SearchIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * GlobalSearch — intelligent, fuzzy, keyboard-navigable search.
 *
 * Props:
 *   points            enriched overview points (see /api/fpv-overview)
 *   onSelectSite      (point)            => fly + identify + open panel
 *   onSelectCoord     ({lat, lon})       => fly to custom coordinate
 *   onSelectClimate   (zone, points[])   => filter map to a climate zone
 *   onServerSearch    async (q) => item[]  optional deep-search fallback
 */
export default function GlobalSearch({
  points = [],
  onSelectSite,
  onSelectCoord,
  onSelectClimate,
  onServerSearch,
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [serverResults, setServerResults] = useState(null);
  const [serverLoading, setServerLoading] = useState(false);
  const rootRef = useRef(null);
  const debounceRef = useRef(null);

  // Instant, in-memory search over the enriched overview points.
  const local = useMemo(() => {
    if (!query.trim()) return { mode: "empty", results: [] };
    return searchPoints(query, points, 12);
  }, [query, points]);

  // Whether any climate data is actually loaded (i.e. the Köppen cache exists).
  const climateReady = useMemo(
    () => points.some((p) => p && p.climate_zone),
    [points]
  );

  // Deep server fallback only when the local index has nothing to offer.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setServerResults(null);

    const q = query.trim();
    const isCoord = !!parseCoordinateQuery(q);
    const needFallback =
      !!onServerSearch &&
      q.length >= 2 &&
      !isCoord &&
      local.mode === "text" &&
      local.results.length === 0;

    if (!needFallback) {
      setServerLoading(false);
      return;
    }

    setServerLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const items = await onServerSearch(q);
        setServerResults(Array.isArray(items) ? items : []);
      } catch {
        setServerResults([]);
      } finally {
        setServerLoading(false);
      }
    }, 320);

    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [query, local, onServerSearch]);

  // Flatten to a single list for keyboard navigation + rendering.
  const items = useMemo(() => {
    if (serverResults && serverResults.length > 0) {
      return serverResults.map((p) => ({ type: "site", ...p }));
    }
    // Climate zone was recognised but no climate data is loaded → show a hint
    // instead of an empty "0 sites" result.
    if (local.mode === "climate" && !climateReady) return [];
    return local.results;
  }, [local, serverResults, climateReady]);

  useEffect(() => setActiveIndex(items.length > 0 ? 0 : -1), [items]);

  // Close on outside click.
  useEffect(() => {
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const choose = useCallback(
    (item) => {
      if (!item) return;
      if (item.type === "coordinate") {
        onSelectCoord?.({ lat: item.lat, lon: item.lon });
      } else if (item.type === "climate") {
        onSelectClimate?.(item.zone, item.points || []);
      } else {
        onSelectSite?.(item);
      }
      setOpen(false);
      setQuery(
        item.type === "climate"
          ? `${item.zone} climate`
          : item.fpv_new_id || item.id || item.label || ""
      );
    },
    [onSelectSite, onSelectCoord, onSelectClimate]
  );

  function onKeyDown(e) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(items[activeIndex] || items[0]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showDropdown = open && query.trim().length > 0;
  const loading = serverLoading;

  return (
    <div className="gsearch" ref={rootRef}>
      <div className="gsearch-field">
        <span className="gsearch-icon">
          <SearchIcon />
        </span>
        <input
          className="gsearch-input"
          type="text"
          placeholder="Search FPV ID, country, city, waterbody, climate, or lat, lon"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          aria-label="Search the global FPV dataset"
          aria-expanded={showDropdown}
          role="combobox"
          aria-controls="gsearch-listbox"
          autoComplete="off"
          spellCheck="false"
        />
        {loading && <span className="gsearch-spinner" aria-hidden="true" />}
        {query && !loading && (
          <button
            className="gsearch-clear"
            onClick={() => {
              setQuery("");
              setOpen(false);
            }}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="gsearch-dropdown" id="gsearch-listbox" role="listbox">
          {points.length === 0 && !loading && (
            <div className="gsearch-hint">Loading dataset…</div>
          )}

          {local.mode === "climate" && !climateReady && points.length > 0 && (
            <div className="gsearch-hint">
              Climate data isn’t built yet, so climate-zone search is
              unavailable. In the <code>server</code> folder run{" "}
              <code>npm install</code> then <code>npm run build:koppen</code> to
              enable it.
            </div>
          )}

          {items.length === 0 &&
            !loading &&
            points.length > 0 &&
            !(local.mode === "climate" && !climateReady) && (
            <div className="gsearch-empty">
              No matches for “{query.trim()}”. Try an FPV ID, country, city,
              waterbody, climate zone, or “lat, lon”.
            </div>
          )}

          {items.map((item, idx) => (
            <ResultRow
              key={rowKey(item, idx)}
              item={item}
              query={query}
              active={idx === activeIndex}
              onMouseEnter={() => setActiveIndex(idx)}
              onClick={() => choose(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function rowKey(item, idx) {
  if (item.type === "coordinate") return "coord";
  if (item.type === "climate") return `climate-${item.zone}`;
  return `${item.fpv_new_id || item.id}-${item.lat}-${item.lon}-${idx}`;
}

function ResultRow({ item, query, active, onMouseEnter, onClick }) {
  if (item.type === "coordinate") {
    return (
      <button
        className={`gsearch-item${active ? " active" : ""}`}
        role="option"
        aria-selected={active}
        onMouseEnter={onMouseEnter}
        onClick={onClick}
      >
        <span className="gsearch-item-badge coordinate">📍</span>
        <span className="gsearch-item-body">
          <span className="gsearch-item-title">Go to coordinate</span>
          <span className="gsearch-item-sub">{item.label}</span>
        </span>
      </button>
    );
  }

  if (item.type === "climate") {
    const c = zoneColor(item.zone);
    return (
      <button
        className={`gsearch-item climate${active ? " active" : ""}`}
        role="option"
        aria-selected={active}
        onMouseEnter={onMouseEnter}
        onClick={onClick}
      >
        <span
          className="gsearch-item-badge"
          style={{
            background: `${c}22`,
            borderColor: `${c}55`,
            color: c,
          }}
        >
          {item.zone.charAt(0)}
        </span>
        <span className="gsearch-item-body">
          <span className="gsearch-item-title">All {item.zone} sites</span>
          <span className="gsearch-item-sub">
            {item.count} FPV site{item.count === 1 ? "" : "s"} in this climate
            zone
          </span>
        </span>
        <span className="gsearch-item-meta">
          <span
            className="gsearch-chip"
            style={{ background: `${c}22`, color: c, borderColor: `${c}55` }}
          >
            {item.zone}
          </span>
        </span>
      </button>
    );
  }

  // site
  const sub = [item.city, item.state, item.country, item.lake_name]
    .filter(Boolean)
    .join(" • ");
  const c = item.climate_zone ? zoneColor(item.climate_zone) : null;
  const cov =
    item.fpv_cov !== null && item.fpv_cov !== undefined && item.fpv_cov !== ""
      ? `${Number(item.fpv_cov).toFixed(1)}%`
      : null;

  return (
    <button
      className={`gsearch-item${active ? " active" : ""}`}
      role="option"
      aria-selected={active}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
    >
      <span className="gsearch-item-badge">☀</span>
      <span className="gsearch-item-body">
        <span className="gsearch-item-title">
          <Highlighted text={item.fpv_new_id || item.id || "FPV site"} query={query} />
        </span>
        <span className="gsearch-item-sub">
          <Highlighted text={sub || "Location unavailable"} query={query} />
        </span>
      </span>
      <span className="gsearch-item-meta">
        {c && (
          <span
            className="gsearch-chip"
            style={{ background: `${c}22`, color: c, borderColor: `${c}55` }}
          >
            {item.climate_zone}
          </span>
        )}
        {cov && <span className="gsearch-chip coverage">{cov}</span>}
      </span>
    </button>
  );
}
