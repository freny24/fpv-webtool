// Base URL for the backend API.
//   - Explicit VITE_API_URL: used as-is (e.g. a separate backend host).
//   - Production build with no VITE_API_URL: "" => relative "/api/..." calls,
//     i.e. the same server serves the frontend and the API (AppKube single-app,
//     or an nginx same-origin proxy).
//   - Local dev: falls back to the local Express server.
export const API_BASE =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.PROD ? "" : "http://localhost:3001");
