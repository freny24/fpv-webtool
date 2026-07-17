# 🌊 FADS Project: Global Floating Photovoltaic (FPV) Environmental Monitoring Web Tool

A research-driven geospatial web application for exploring the global distribution and environmental impacts of Floating Photovoltaic (FPV) installations using satellite remote sensing, climate classification, and interactive visualization.

This project integrates **Google Earth Engine (GEE)** as a geospatial processing backend and **React (Vite)** as a frontend interface to enable interactive analysis of chlorophyll-a concentration, water surface temperature (WST), and climate context across FPV-associated water bodies worldwide. It is designed as the first public, interactive dashboard for global floating solar.

🌐 **Live application:** https://fpv-webtool.vercel.app

---

## 📌 Project Motivation

Floating solar energy is expanding globally, yet its ecological impacts on aquatic systems remain under-studied.
This project aims to build a scalable analytical platform to:

* Monitor chlorophyll-a (water quality proxy)
* Analyze water surface temperature variations
* Explore FPV–waterbody spatial relationships
* Contextualize installations by climate zone
* Support sustainable floating solar deployment

---

## ✨ Key Features

* **Interactive global map** of FPV installations rendered from satellite-derived vector data
* **Intelligent search** across FPV ID, country, state, city, waterbody name, coordinates, and climate zone, with fuzzy autocomplete and keyboard navigation
* **Köppen–Geiger climate classification** for every waterbody (Tropical, Arid, Temperate, Cold, Polar)
* **Environmental insights** — NDCI/chlorophyll-a and WST time-series per site
* **Filtered data export** by climate zone and country, in CSV and GeoJSON
* **Community contribution system** with an admin review workflow for crowd-sourced site submissions
* **Publicly deployed** and accessible to researchers, agencies, and the public

---

## 🛰️ Data Sources

**Sentinel-2 MSI**

* Bands: B01–B12
* Used to compute NDCI (Normalized Difference Chlorophyll Index)
* Proxy estimation of chlorophyll-a concentration

NDCI Formula: `NDCI = (B5 - B4) / (B5 + B4)`

**Landsat-8 Collection 2 Level-2**

* Thermal band: ST_B10
* Used to estimate Water Surface Temperature (WST)

**Köppen–Geiger Climate Raster** (Beck et al., 2018, 1-km)

* Sampled at each waterbody centroid to derive its climate zone
* Enables climate-based search and analysis

**Vector Data**

* FPV installation polygons
* Waterbody shapefiles (with type classification)
* Spatial joins for FPV–waterbody association

---

## ⚙️ System Architecture

```
Frontend (React + Vite)  →  Node/Express API  →  Google Earth Engine (raster processing)
                                     ↓
                    Köppen climate raster sampling (local)
                                     ↓
             Satellite imagery processing + index computation
                                     ↓
                 Time-series + spatial + climate visualization
```

---

## 🧠 Methodology

**1. Preprocessing**

* Clip imagery to waterbody boundaries
* Apply cloud masking
* Generate median composites for the selected date range

**2. Chlorophyll-a Estimation**

* Compute NDCI using Sentinel-2 bands
* Aggregate median values per FPV polygon

**3. Water Surface Temperature (WST)**

* Extract the Landsat-8 thermal band
* Convert to surface temperature values
* Aggregate statistics per FPV installation

**4. Climate Classification**

* Sample the Beck et al. (2018) Köppen–Geiger raster at each waterbody centroid
* Map to the five major climate classes (A–E) for search and analysis

**5. Waterbody Classification**

* Integrate waterbody type (lake, reservoir, controlled) into the primary dataset
* Support type-aware interpretation of environmental metrics

**6. Time-Series Analysis**

* Dynamic start/end date selection
* Median-based aggregation
* FPV-level trend visualization

---

## 🛠️ Tech Stack

* Google Earth Engine (JavaScript API)
* React + Vite
* Node.js + Express (API backend)
* Leaflet (interactive mapping)
* GeoTIFF (Köppen raster sampling)
* Python (GeoPandas, pandas) for data preparation
* Tableau (exploratory visualization)
* Vercel + Render (deployment)
* Git & GitHub

---

## 📂 Repository Structure

```
/src                  → React (Vite) frontend
  /components         → UI components (search, map, panels, modals, admin)
  /lib                → search + data-export utilities
/server               → Node/Express API + Google Earth Engine backend
  /koppen             → Köppen climate raster sampling pipeline
  /data               → cached climate data + community submissions
/public               → static assets (country boundaries, etc.)
README.md
```

---

## 🚀 Getting Started (Local Development)

**Backend**

```
cd server
npm install
cp .env.example .env    # set ADMIN_KEY; set GEE_SERVICE_ACCOUNT_JSON
                        # or place gee-service-account.json in this folder
npm run build:koppen    # one-time: builds the Köppen climate cache
npm start
```

**Frontend** (in a separate terminal, from the repo root)

```
npm install
cp .env.example .env.local   # defaults to http://localhost:3001 for local dev
npm run dev
```

---

## 🌐 Live Deployment

* **Frontend:** React (Vite) build hosted on Vercel — https://fpv-webtool.vercel.app
* **Backend:** Node/Express + Google Earth Engine API hosted on Render
* **Climate data:** a pre-sampled Köppen cache is served by the API for instant, offline climate search

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full Vercel + Render walkthrough, including environment variables and the persistence caveat for the submissions store.

---

## 📷 Application Preview

*(Add screenshots here)*

---

## 👩‍💻 Individual Contributions

**Dr. Rafael M. Almeida** – Principal Investigator and Research Supervisor
*Assistant Professor, O'Neill School of Public and Environmental Affairs, Indiana University*

* Project supervision and strategic research direction
* Scientific guidance on aquatic ecosystems and energy systems sustainability
* Expertise in aquavoltaics and freshwater ecosystem impacts
* Oversight of research design and long-term project vision

**Aline Valerio** – Postdoctoral Research Associate

* Project coordination and weekly research meetings
* Remote sensing methodology guidance
* Environmental interpretation of chlorophyll and WST results
* Conceptual framework development
* Developed the waterbody classification (type) framework for the primary dataset

**Freny Reji** – Graduate DS Research Assistant

* Designed and implemented the Google Earth Engine raster processing pipeline
* Developed the chlorophyll-a (NDCI) computation workflow and built the dynamic WST time-series range composite logic
* Built the React (Vite) frontend interface and UI component system
* Architected the global intelligent search (fuzzy autocomplete across FPV ID, country, state, city, waterbody, coordinates, and climate zone, with keyboard navigation and match highlighting)
* Integrated Köppen–Geiger climate classification: built a raster-sampling pipeline (Beck et al., 2018) that tags every waterbody with its climate zone, enabling climate-based search and analysis
* Redesigned the full UI/UX into a premium scientific dashboard (design-token system, typography, dark theme, animated scientific markers, responsive layout)
* Designed and implemented the community contribution system: public submission form with live map preview, spatial duplicate detection, and a secure admin review queue (approve / reject / delete) with optional contributor email
* Built filtered dataset export (by climate zone and country; CSV and GeoJSON)
* Added an onboarding guide and performance optimizations (memoized map rendering)
* Deployed the application publicly (Vercel frontend + Render backend) and authored the hosting and cost analysis

**Sakshi Nair** – Graduate DS Research Assistant

* Performed metadata table cross-referencing and integrated waterbody type classification into the primary dataset
* Developing React frontend interface (Vite setup, UI components)

**Heeya Amin** – Graduate DS Research Assistant

* Implemented expandable dropdown components in the user interface
* Developing React frontend interface (Vite setup, UI components)

---

## 🔬 Future Work

* CNN-based image patch classification
* Automated global FPV detection
* Uncertainty quantification
* Persistent contribution storage and scalable public deployment

---

## 📈 Why This Project Matters

This project demonstrates:

* Geospatial analytics expertise
* Remote sensing knowledge
* Climate-aware environmental analysis
* Full-stack research tool development
* Scalable environmental monitoring design

---

## 👥 Contributors

* **Dr. Rafael M. Almeida** – Principal Investigator and Research Supervisor
* **Aline Valerio** – Postdoctoral Research Associate
* **Freny Reji** – MS Data Science
* **Sakshi Nair** – MS Data Science
* **Heeya Amin** – MS Data Science
