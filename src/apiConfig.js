// Base URL for the backend API.
//   - Vercel/Render split: set VITE_API_URL to the deployed backend URL.
//   - Kubernetes (same-origin via nginx proxy): set VITE_API_URL="" so calls
//     go to a relative "/api/..." path and nginx forwards them to the backend.
//   - Local dev (VITE_API_URL unset): falls back to the local Express server.
// Uses ?? so an explicit empty string ("") is respected (only null/undefined
// falls back to localhost).
export const API_BASE =
  import.meta.env.VITE_API_URL ?? "http://localhost:3001";
