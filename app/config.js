/**
 * LifeguideAssist - Standalone Application Configuration & Secrets
 * This configuration allows the standalone application to run anywhere on ANY website,
 * static web hosting (GitHub Pages, Vercel, Netlify, S3, Cloudflare Pages), or iframe
 * without requiring any specific port or backend Node.js server.
 */
window.LIFEGUIDE_CONFIG = {
  // GEMINI_API_KEY: Insert your Google Gemini API Key here for direct client-side AI intelligence,
  // or leave blank to automatically utilize the built-in autonomous client-side intelligence solver.
  GEMINI_API_KEY: "",

  // AI Model preference
  GEMINI_MODEL: "gemini-2.5-flash",

  // Public Geocoding API endpoint (OpenStreetMap Nominatim)
  NOMINATIM_GEOCODE_URL: "https://nominatim.openstreetmap.org/search",

  // Public Routing API endpoint (OSRM Project)
  OSRM_ROUTING_URL: "https://router.project-osrm.org/route/v1",

  // Public Real-Time Meteorological API endpoint (Open-Meteo)
  OPEN_METEO_WEATHER_URL: "https://api.open-meteo.com/v1/forecast",

  // Application Defaults
  APP_NAME: "LifeguideAssist",
  VERSION: "1.0.0",
  DEFAULT_LOCATION: "London, United Kingdom",
  DEFAULT_LAT: 51.5074,
  DEFAULT_LON: -0.1278,

  // Local Persistence Keys (no database port required)
  STORAGE_CALENDAR_KEY: "lifeguide_calendar_events",
  STORAGE_CHAT_KEY: "lifeguide_chat_history",
  STORAGE_SETTINGS_KEY: "lifeguide_app_settings"
};
