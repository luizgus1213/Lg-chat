const state = window.LGChat.state;

const DEFAULT_TIMEOUT_MS = 18_000;

const DEFAULT_GET_TIMEOUT_MS = 12_000;

const MAX_GET_RETRIES = 1;

const inflightGetRequests = new Map();

function getErrorMessage(data, fallback = "Erro na requisição.") {
    if (data && data.error && Array.isArray(data.error.fields)) {
      return data.error.fields
        .map((field) => `${field.path}: ${field.message}`)
        .join(" | ");
    }

    if (data && data.error && data.error.message) {
      return data.error.message;
    }

    if (data && data.message) {
      return data.message;
    }

    return fallback;
  }

function isAbortError(error) {
    return error && (error.name === "AbortError" || error.code === "ABORT_ERR");
  }

function canRetry(method, attempt, options) {
    const normalizedMethod = String(method || "GET").toUpperCase();

    if (options.retry === false) return false;
    if (normalizedMethod !== "GET") return false;

    return attempt < Number(options.retries ?? MAX_GET_RETRIES);
  }

function createTimeoutController(timeoutMs, externalSignal) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener("abort", () => controller.abort(), {
          once: true,
        });
      }
    }

    return {
      controller,
      clear: () => window.clearTimeout(timer),
    };
  }

async function parseResponse(response) {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      return response.json().catch(() => null);
    }

    const text = await response.text().catch(() => "");

    return text ? { message: text } : null;
  }

function makeDedupeKey(path, options) {
    const method = String(options.method || "GET").toUpperCase();

    if (method !== "GET") return null;
    if (options.dedupe === false) return null;
    if (options.body) return null;

    return `${method}:${path}`;
  }
