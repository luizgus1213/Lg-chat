import { Router } from "express";

import { getIceServersController } from "../controllers/CallControllers";
import { authMiddleware } from "../middlewares/authMiddleware";
import { asyncHandler } from "../utils/asyncHandler";

export const callsRoutes = Router();

callsRoutes.use(authMiddleware);
callsRoutes.get("/ice-servers", asyncHandler(getIceServersController));
