// src/config.js

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

// FINAL CLEAN LOGIC
export const API_BASE = BASE_URL
  ? `${BASE_URL}/api/v1`
  : "/api/v1";

export default BASE_URL;