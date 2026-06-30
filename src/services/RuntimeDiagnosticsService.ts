import { logger } from "../utils/logger";

let started = false;

function bytesToMb(value: number) {
  return Math.round((value / 1024 / 1024) * 10) / 10;
}

export function startRuntimeDiagnostics() {
  if (started) return;

  started = true;

  let lastCheck = Date.now();

  const interval = setInterval(() => {
    const now = Date.now();
    const driftMs = now - lastCheck - 30_000;
    lastCheck = now;

    const memory = process.memoryUsage();
    const rssMb = bytesToMb(memory.rss);
    const heapUsedMb = bytesToMb(memory.heapUsed);
    const heapTotalMb = bytesToMb(memory.heapTotal);
    const externalMb = bytesToMb(memory.external);

    const payload = {
      rssMb,
      heapUsedMb,
      heapTotalMb,
      externalMb,
      driftMs: Math.max(0, Math.round(driftMs)),
      uptimeSeconds: Math.round(process.uptime()),
    };

    if (payload.driftMs > 1200 || heapUsedMb > 450 || rssMb > 900) {
      logger.warn(payload, "Runtime possivelmente pesado");
      return;
    }

    logger.debug(payload, "Runtime saudável");
  }, 30_000);

  if (typeof interval.unref === "function") {
    interval.unref();
  }

  logger.info("Diagnóstico de runtime iniciado");
}
