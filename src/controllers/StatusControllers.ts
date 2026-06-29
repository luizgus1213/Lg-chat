import type { Request, Response } from "express";
import fs from "fs/promises";
import {
  createMediaStatusSchema,
  createTextStatusSchema,
  statusIdParamsSchema,
} from "../validators/statusValidator";
import {
  createMediaStatus,
  createTextStatus,
  deleteStatus,
  listMyStatuses,
  listStatusViews,
  listVisibleStatuses,
  markStatusAsViewed,
} from "../services/StatusService";
import { created, ok } from "../utils/httpResponse";

export async function listStatusesController(req: Request, res: Response) {
  const statuses = await listVisibleStatuses(req.user!.id);

  return ok(res, statuses);
}

export async function listMyStatusesController(req: Request, res: Response) {
  const statuses = await listMyStatuses(req.user!.id);

  return ok(res, statuses);
}

export async function createTextStatusController(req: Request, res: Response) {
  const data = createTextStatusSchema.parse(req.body);

  const status = await createTextStatus({
    currentUserId: req.user!.id,
    text: data.text,
    backgroundColor: data.backgroundColor,
  });

  return created(res, status, "Status publicado com sucesso.");
}

export async function createMediaStatusController(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: {
        code: "STATUS_MEDIA_REQUIRED",
        message: "Envie uma foto ou vídeo para publicar no status.",
        statusCode: 400,
      },
    });
  }

  try {
    const data = createMediaStatusSchema.parse(req.body);

    const status = await createMediaStatus({
      currentUserId: req.user!.id,
      text: data.text,
      file: req.file,
    });

    return created(res, status, "Status publicado com sucesso.");
  } catch (error) {
    await fs.unlink(req.file.path).catch(() => undefined);

    throw error;
  }
}

export async function markStatusViewedController(req: Request, res: Response) {
  const { statusId } = statusIdParamsSchema.parse(req.params);

  const result = await markStatusAsViewed({
    currentUserId: req.user!.id,
    statusId,
  });

  return ok(res, result);
}

export async function listStatusViewsController(req: Request, res: Response) {
  const { statusId } = statusIdParamsSchema.parse(req.params);

  const views = await listStatusViews({
    currentUserId: req.user!.id,
    statusId,
  });

  return ok(res, views);
}

export async function deleteStatusController(req: Request, res: Response) {
  const { statusId } = statusIdParamsSchema.parse(req.params);

  const result = await deleteStatus({
    currentUserId: req.user!.id,
    statusId,
  });

  return ok(res, result, "Status apagado com sucesso.");
}
