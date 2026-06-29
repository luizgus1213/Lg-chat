import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { statusUpload } from "../middlewares/statusUpload";
import { asyncHandler } from "../utils/asyncHandler";
import {
  createMediaStatusController,
  createTextStatusController,
  deleteStatusController,
  listMyStatusesController,
  listStatusesController,
  listStatusViewsController,
  markStatusViewedController,
} from "../controllers/StatusControllers";

export const statusRoutes = Router();

statusRoutes.use(authMiddleware);

statusRoutes.get("/", asyncHandler(listStatusesController));
statusRoutes.get("/me", asyncHandler(listMyStatusesController));

statusRoutes.post("/text", asyncHandler(createTextStatusController));
statusRoutes.post(
  "/media",
  statusUpload,
  asyncHandler(createMediaStatusController),
);

statusRoutes.post("/:statusId/view", asyncHandler(markStatusViewedController));
statusRoutes.get("/:statusId/views", asyncHandler(listStatusViewsController));
statusRoutes.delete("/:statusId", asyncHandler(deleteStatusController));
