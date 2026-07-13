// Base URL for the backend API. In production (Vercel), set VITE_API_URL to
// the deployed Render backend URL, e.g. https://fpv-webtool-api.onrender.com
// In local dev it falls back to the local Express server.
export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";
