// In local dev: VITE_API_BASE is empty "" so Vite proxies /api/* → localhost:3001
// In production: set VITE_API_BASE=https://api.acet-sports.favoflex.com in your deployment env
export const API_BASE = import.meta.env.VITE_API_BASE || "";

