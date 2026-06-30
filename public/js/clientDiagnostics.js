(() => {
  window.LGChat = window.LGChat || {};

  const MAX_REPORTS_PER_SESSION = 18;
  const REPORT_COOLDOWN_MS = 1800;
  const endpoint = "/api/diagnostics/client-error";

  let sentCount = 0;
  let lastReportAt = 0;
  const fingerprints = new Map();

  function getConnectionLabel() {
    const connection =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;

    if (!connection) return "unknown";

    return [
      connection.effectiveType || "unknown",
      connection.saveData ? "saveData" : "normal",
      connection.downlink ? `${connection.downlink}mbps` : "",
    ]
      .filter(Boolean)
      .join(" | ");
  }

  function sanitizeString(value, maxLength) {
    if (value === null || value === undefined) return "";

    return String(value).slice(0, maxLength);
  }

  function canReport(payload) {
    if (sentCount >= MAX_REPORTS_PER_SESSION) return false;

    const now = Date.now();

    if (now - lastReportAt < REPORT_COOLDOWN_MS) return false;

    const fingerprint = `${payload.type}:${payload.message}:${payload.source}`;

    const lastFingerprintAt = fingerprints.get(fingerprint) || 0;

    if (now - lastFingerprintAt < 12_000) return false;

    fingerprints.set(fingerprint, now);
    lastReportAt = now;
    sentCount += 1;

    return true;
  }

  function sendPayload(payload) {
    if (!canReport(payload)) return;

    const body = JSON.stringify({
      level: payload.level || "error",
      type: sanitizeString(payload.type || "client_error", 80),
      message: sanitizeString(payload.message || "Erro no navegador.", 1200),
      stack: sanitizeString(payload.stack || "", 3500),
      source: sanitizeString(payload.source || "", 500),
      path: sanitizeString(location.pathname + location.search, 500),
      userAgent: sanitizeString(navigator.userAgent, 500),
      connection: sanitizeString(getConnectionLabel(), 80),
      metadata: payload.metadata || {},
    });

    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], {
          type: "application/json",
        });

        navigator.sendBeacon(endpoint, blob);
        return;
      }

      fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
        keepalive: true,
      }).catch(() => undefined);
    } catch (_error) {
      // Nunca deixe diagnóstico quebrar o app.
    }
  }

  function reportError(error, metadata = {}) {
    sendPayload({
      level: "error",
      type: metadata.type || "client_error",
      message: error && error.message ? error.message : String(error || "Erro desconhecido."),
      stack: error && error.stack ? error.stack : "",
      source: metadata.source || "",
      metadata,
    });
  }

  window.addEventListener("error", (event) => {
    reportError(event.error || event.message, {
      type: "window_error",
      source: `${event.filename || ""}:${event.lineno || 0}:${event.colno || 0}`,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason, {
      type: "unhandled_rejection",
      source: "promise",
    });
  });

  if ("PerformanceObserver" in window) {
    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration < 250) continue;

          sendPayload({
            level: "warn",
            type: "long_task",
            message: `Tarefa longa no navegador: ${Math.round(entry.duration)}ms`,
            source: "PerformanceObserver",
            metadata: {
              durationMs: Math.round(entry.duration),
              startTime: Math.round(entry.startTime),
            },
          });
        }
      });

      longTaskObserver.observe({
        entryTypes: ["longtask"],
      });
    } catch (_error) {
      // Nem todo navegador suporta longtask.
    }

    try {
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const isStatic =
            entry.name.includes("/js/") ||
            entry.name.includes("/css/") ||
            entry.name.includes("/features/");

          if (!isStatic || entry.duration < 1600) continue;

          sendPayload({
            level: "warn",
            type: "slow_resource",
            message: `Recurso lento: ${Math.round(entry.duration)}ms`,
            source: entry.name,
            metadata: {
              durationMs: Math.round(entry.duration),
              transferSize: entry.transferSize || 0,
              encodedBodySize: entry.encodedBodySize || 0,
            },
          });
        }
      });

      resourceObserver.observe({
        entryTypes: ["resource"],
      });
    } catch (_error) {
      // Observador opcional.
    }
  }

  window.LGChat.diagnostics = {
    reportError,
    sendPayload,
  };
})();
