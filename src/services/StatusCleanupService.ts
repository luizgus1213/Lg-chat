import { cleanupExpiredStatuses } from "./StatusService";
import { logger } from "../utils/logger";

const CLEANUP_INTERVAL_MS = 30 * 60 * 1000;

let cleanupTimer: NodeJS.Timeout | null = null;

async function runStatusCleanup() {
  try {
    const result = await cleanupExpiredStatuses();

    if (result.deleted > 0) {
      logger.info(result, "Limpeza automática de status concluída");
    }
  } catch (error) {
    logger.error({ err: error }, "Erro ao limpar status expirados");
  }
}

export function startStatusCleanupJob() {
  if (cleanupTimer) {
    return;
  }

  runStatusCleanup().catch(() => undefined);

  cleanupTimer = setInterval(() => {
    runStatusCleanup().catch(() => undefined);
  }, CLEANUP_INTERVAL_MS);

  cleanupTimer.unref?.();

  logger.info("Limpeza automática de status iniciada");
}
