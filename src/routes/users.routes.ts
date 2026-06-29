import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import {
  getUsers,
  updateMyAvatarController,
  updateMyProfileController,
} from "../controllers/UserControllers";
import { asyncHandler } from "../utils/asyncHandler";
import { userAvatarUpload } from "../middlewares/userAvatarUpload";

export const usersRoutes = Router();

usersRoutes.use(authMiddleware);

usersRoutes.get("/", asyncHandler(getUsers));
usersRoutes.patch("/me", asyncHandler(updateMyProfileController));
usersRoutes.post(
  "/me/avatar",
  userAvatarUpload,
  asyncHandler(updateMyAvatarController),
);
