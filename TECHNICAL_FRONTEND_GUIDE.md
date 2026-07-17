# Technical Frontend Guide - UI Components & Terms

## For Freny - Understanding the Code Changes

---

## **Core Frontend Concepts Explained**

### **Component**
A reusable piece of UI code. Think of it as a building block. Each component is a JavaScript function that returns HTML/UI elements.
- Example: `ContributeModal` is a component that shows the contribution form
- File location: `/src/components/ComponentName.jsx`

### **State**
Data that can change and trigger the UI to update when it changes.
- Example: `const [query, setQuery] = useState("")` - stores what user types in search box
- When state changes, React automatically updates the UI

### **Props**
Data passed FROM a parent component TO a child component (like function arguments).
- Example: `<ContributeModal open={showContribute} />` - passes `open` prop with value `showContribute`

### **Event Handler**
A function triggered when user interacts (clicks, types, etc.).
- Example: `onClick={() => setShowContribute(true)}` - runs when button clicked

### **JSX**
Mix of JavaScript and HTML-like syntax. It looks like HTML but it's JavaScript that creates UI.
```jsx
<button onClick={() => alert("Hi")}>Click me</button>
```

---

## **New UI Components We Added**

### **1. ContributeModal Component**
**File:** `/src/components/ContributeModal.jsx`

**What it does:** Shows a popup form for users to submit new FPV sites.

**Key elements:**
- **Modal** = popup overlay that appears over the map
- **Form** = the input fields (latitude, longitude, name, etc.)
- **State variables** stored:
  - `lat`, `lon` - coordinates
  - `name`, `country` - site details
  - `source` - dropdown showing 6 options (Field visit, News, Satellite imagery, etc.)
  - `notes` - text area for additional info
  - `submitting` - boolean (true/false) to show loading state
  - `result` - feedback message after submission
  - `error` - error message if something goes wrong

**How it opens/closes:**
- Opens when user clicks "Contribute a Site" button
- Prop `open={showContribute}` controls visibility
- Callback `onClose()` closes it
- Prop `initialLat` and `initialLon` pre-fill coordinates (if user clicked map first)

**Duplicate Detection:**
- After submission, if a duplicate is detected, shows warning message
- But submission still gets approved/reviewed

**Styling:**
- Dark gradient background (blue/dark tones)
- Rounded corners (borderRadius: 18)
- Input fields have semi-transparent styling
- Yellow submit button, gray cancel button

---

### **2. CommunityMarkers Component**
**File:** `/src/MapView.jsx` (lines 144-166)

**What it does:** Renders green markers on the map for community-submitted (approved) sites.

**Key parts:**
- `createCommunityIcon()` function creates a small green circle marker
- Maps through `communityPoints` array and creates a `<Marker>` for each one
- Shows popup when clicked with site info: name, country, source, "Submitted by community"

**Styling:**
- Green color: `#4ade80`
- 14x14 pixel size
- White 3px border
- Box shadow for depth

---

### **3. Climate Zones in Markers**
**File:** `/src/MapView.jsx` (lines 82-100, 168-217)

**What changed:** FPV site markers now show climate zone colors

**Key changes:**
- `createCleanFPVIcon()` function now accepts `climateColor` parameter
- `zoneColor()` function (from `/src/lib/search.js`) converts climate zone name to a color
- Example: "Tropical" → orange, "Temperate" → blue, etc.

**Visual effect:**
- Ring around each marker changes color based on climate
- Active (selected) marker pulses and grows
- Uses CSS animations for the pulse effect (2.4s cycle)

**Code structure:**
```jsx
const climateColor = pt.climate_zone ? zoneColor(pt.climate_zone) : null;
<Marker
  icon={createCleanFPVIcon(isActive, climateColor)}
  // ... other props
/>
```

---

## **UI Components Glossary**

### **Marker**
A pin/icon on the map. Each FPV site is a marker.
- Regular markers: yellow with blue ring (shows climate color ring now)
- Active marker: larger, glowing, bounces with animation
- Community markers: green dots

### **Popup**
Information bubble that appears when you click a marker.
- Shows site details: name, location, climate, waterbody ID, FPV area

### **Modal / Overlay**
A dialog box that appears over the entire screen.
- Dark background dims the map
- Form or content in the middle
- Close button (X) to dismiss

### **Leaflet**
The map library we use (open-source).
- `MapContainer` = the map display area
- `TileLayer` = background map imagery (satellite, OpenStreetMap)
- `Marker` = pin on the map
- `GeoJSON` = country borders/shapes
- `ZoomControl` = +/- buttons to zoom

### **TileLayer**
Background map images split into tiles.
- Satellite tiles: real satellite imagery
- OSM tiles: OpenStreetMap (street/terrain)
- Environment tiles: visualization overlays (NDCI, Chlorophyll, etc.)

---

## **State Flow - How Features Connect**

### **Contribution Flow:**
1. User clicks "Contribute a Site" button
2. `setShowContribute(true)` → opens modal
3. Modal pre-fills with location if user clicked map: `initialLat={pickedLocation?.lat}`
4. User fills form and clicks "Submit for review"
5. Form submits to backend API: `POST /api/submissions`
6. After successful submission: `onSubmitted()` callback → `loadCommunityPoints()` refreshes green markers
7. New approved submissions appear as green dots on map next time page loads

### **Climate Zone Filter Flow:**
1. User searches "tropical" in search bar
2. `GlobalSearch` component recognizes it as climate zone query
3. Calls `onSelectClimate(zone, points)` callback
4. `handleSelectClimate()` function:
   - Creates Set of FPV IDs matching that climate
   - Stores in `climateFilter` state
   - Calls `setFitPoints()` to zoom map to those coordinates
5. Displays banner at top showing filtered climate and count
6. `displayedPoints` filter in useMemo shows only matching sites
7. Markers render only for filtered sites

---

## **Marker Names / Types Explained**

### **FPV Markers (Overview Markers)**
Located in: `/src/MapView.jsx` - `createCleanFPVIcon()` and `OverviewMarker` component

**Two states:**
1. **Normal state:**
   - Yellow core (8px dot)
   - Ring with color (climate zone color or default sky blue)
   - Pulsing glow around it
   - Size: 18x18 pixels

2. **Active state (selected):**
   - Larger (34x34 pixels)
   - Core grows to 12px
   - Ring glows brighter
   - Faster pulse animation (1.4s instead of 2.4s)
   - Bounces when clicked (keyframe animation)
   - Has shadow effect

### **Community Markers**
Located in: `/src/MapView.jsx` - `createCommunityIcon()` and `CommunityMarkers` component

- **Appearance:** Small green circle (14x14px)
- **Style:** White border, box shadow
- **Distinction:** Clearly different from FPV markers so users know they're community-submitted

### **Marker Animation Names:**
- **fpv-pulse:** The expanding ring effect (2.4s cycle)
- **fpv-bounce:** The up-down bounce when selected (0.6s)
- Located in CSS at MapView.jsx lines 703-713

---

## **Component File Structure**

```
src/
├── components/
│   ├── ContributeModal.jsx          ← User contribution form
│   ├── GlobalSearch.jsx             ← Search with climate zones
│   ├── FPVInfoPanel.jsx             ← Right sidebar showing details
│   ├── AnalyticsModal.jsx           ← Environmental data charts
│   ├── AdminPanel.jsx               ← Admin review submissions
│   ├── FpvMap.jsx                   ← Lower-level map component
│   └── GlobalSearch.css             ← Search styling
├── lib/
│   └── search.js                    ← Climate zone colors, search logic
├── MapView.jsx                      ← Main map view (all markers, logic)
├── App.jsx                          ← Entry point
└── apiConfig.js                     ← API endpoint config
```

---

## **Key Functions Related to New Features**

### **In MapView.jsx:**

**`loadCommunityPoints()`** (lines 337-346)
- Fetches approved community submissions from backend
- Updates `communityPoints` state
- Renders green markers on map

**`createCleanFPVIcon(isActive, climateColor)`** (lines 82-100)
- Creates marker icon with climate zone color
- `isActive` = boolean for selected state
- `climateColor` = hex color from climate zone
- Returns Leaflet divIcon with HTML/CSS

**`handleSelectClimate(zone, pts)`** (lines 550-565)
- Triggered when user clicks climate zone result
- Stores climate filter in state
- Calculates bounds and zooms to show all matching sites

### **In GlobalSearch.jsx:**

**`zoneColor(climateZone)`** (imported from search.js)
- Maps climate zone name to color hex code
- Example: "Tropical Wet" → "#FF6B6B" (red)

**Climate search detection** (lines 56-59, 101-110)
- Local search over in-memory points
- Recognizes climate zone queries
- Returns grouped results by climate

---

## **UI Styling Terms**

### **Common CSS Properties Used:**
- **`borderRadius`** = how rounded corners are (e.g., `borderRadius: 12` = moderately rounded)
- **`background`** = color or gradient fill
- **`opacity`** = transparency (0 = invisible, 1 = solid)
- **`zIndex`** = stacking order (higher number = on top)
- **`boxShadow`** = shadow effect for depth
- **`position: absolute`** = fixed position on screen (not relative to page scroll)
- **`transform`** = rotate, scale, or move elements
- **`animation`** = keyframe animations (like bounce, pulse)

### **Color Scheme:**
- **Primary (Active):** `#38bdf8` = sky blue (FPV active state)
- **Accent:** `#facc15` = yellow (normal markers, buttons)
- **Community:** `#4ade80` = green (user submissions)
- **Backgrounds:** Dark blue/gray with transparency (`rgba(7,15,30,0.97)`)

---

## **Quick Reference: What Changed**

| Feature | File | Component | Change Type |
|---------|------|-----------|------------|
| User contributions | ContributeModal.jsx | ContributeModal | NEW |
| Green community markers | MapView.jsx | CommunityMarkers | NEW |
| Climate zone colors | MapView.jsx, GlobalSearch.jsx | Marker styling, search | MODIFIED |
| Climate zone search | GlobalSearch.jsx | Search logic | MODIFIED |
| Climate filter banner | MapView.jsx | Overlay UI | NEW |
| Marker click identify | MapView.jsx | ClickIdentify | EXISTING |

---

## **For Testing/Demo on Wednesday:**

Show Aline:
1. Click "Contribute a Site" button → explain form
2. Search "tropical" in search → show climate filter
3. Click a climate result → show map zooms and highlights
4. Show green markers as community contributions
5. Explain color rings around markers represent different climates

