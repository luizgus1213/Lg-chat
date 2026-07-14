import type { Request, Response } from "express";

import { createIceServerConfiguration } from "../services/IceServerService";
import { ok } from "../utils/httpResponse";

export async function getIceServersController(req: Request, res: Response) {
  return ok(res, createIceServerConfiguration(req.user!.id));
}
