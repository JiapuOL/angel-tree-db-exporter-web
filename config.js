// Runtime configuration for the frontend.
// Point this at the deployed Worker (angel-tree-db-exporter-server).
// For local development with `wrangler dev`, the default below usually works.
window.APP_CONFIG = {
  // Base URL of the decryption API. No trailing slash.
  // Production Worker domain. For local dev, change to "http://localhost:8787".
  API_BASE_URL: "https://db-server.jiapu.au",
  // How often to poll the status endpoint, in milliseconds.
  POLL_INTERVAL_MS: 10000,
};
