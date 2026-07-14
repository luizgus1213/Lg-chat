type DiagnosticInput = {
  type: string;
  message: string;
  stack?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  level?: "error" | "warn";
};

const SENSITIVE_PATTERN =
  /(authorization|bearer|token|password|senha|codigo|código|secret|sdp|candidate|message\s*content)/gi;
const recentReports = new Map<string, number>();
const reportTimes: number[] = [];
const DEDUPE_WINDOW_MS = 60_000;
const MAX_REPORTS_PER_MINUTE = 6;

function redactText(value: string, maxLength: number): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(
      /([?&](?:token|code|codigo|password|senha)=)[^&\s]+/gi,
      "$1[REDACTED]",
    )
    .replace(SENSITIVE_PATTERN, "[REDACTED]")
    .slice(0, maxLength);
}

export function sanitizeDiagnosticMetadata(
  metadata?: Record<string, unknown>,
): Record<string, string | number | boolean | null> {
  if (!metadata) return {};

  const safe: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_PATTERN.test(key)) {
      SENSITIVE_PATTERN.lastIndex = 0;
      continue;
    }
    SENSITIVE_PATTERN.lastIndex = 0;

    if (typeof value === "string") safe[key] = redactText(value, 300);
    else if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      safe[key] = value;
    }
  }

  return safe;
}

function canReport(key: string): boolean {
  const now = Date.now();
  const previous = recentReports.get(key) ?? 0;
  if (now - previous < DEDUPE_WINDOW_MS) return false;

  while (reportTimes[0] && now - reportTimes[0] > DEDUPE_WINDOW_MS) {
    reportTimes.shift();
  }
  if (reportTimes.length >= MAX_REPORTS_PER_MINUTE) return false;

  recentReports.set(key, now);
  reportTimes.push(now);
  return true;
}

export function reportClientError(input: DiagnosticInput): void {
  const message = redactText(input.message || "Erro no cliente.", 1_200);
  const type = redactText(input.type || "client_error", 80);
  const key = `${type}:${message}`;
  if (!canReport(key)) return;

  const body = JSON.stringify({
    level: input.level ?? "error",
    type,
    message,
    stack: input.stack ? redactText(input.stack, 3_500) : undefined,
    source: input.source ? redactText(input.source, 500) : undefined,
    path: `${window.location.pathname}${window.location.hash}`.slice(0, 500),
    userAgent: navigator.userAgent.slice(0, 500),
    connection: navigator.onLine ? "online" : "offline",
    metadata: sanitizeDiagnosticMetadata(input.metadata),
  });

  void fetch("/api/diagnostics/client-error", {
    method: "POST",
    credentials: "include",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body,
  }).catch(() => undefined);
}

export function installGlobalErrorHandlers(): () => void {
  const handleError = (event: ErrorEvent) => {
    reportClientError({
      type: "window_error",
      message: event.message || "Erro inesperado na página.",
      stack: event.error instanceof Error ? event.error.stack : undefined,
      source: event.filename,
      metadata: { line: event.lineno, column: event.colno },
    });
  };

  const handleRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    reportClientError({
      type: "unhandled_rejection",
      message:
        reason instanceof Error
          ? reason.message
          : "Uma operação assíncrona falhou sem tratamento.",
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  };

  window.addEventListener("error", handleError);
  window.addEventListener("unhandledrejection", handleRejection);

  return () => {
    window.removeEventListener("error", handleError);
    window.removeEventListener("unhandledrejection", handleRejection);
  };
}
