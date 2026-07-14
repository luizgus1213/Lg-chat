import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import {
  getUsers,
  getUserDirectory,
  updateMyAvatarController,
  updateMyProfileController,
} from "../controllers/UserControllers";
import { asyncHandler } from "../utils/asyncHandler";
import { userAvatarUpload } from "../middlewares/userAvatarUpload";
import { profileUploadRateLimit } from "../middlewares/securityRateLimits";
import { csrfProtection } from "../middlewares/csrfProtection";

export const usersRoutes = Router();

usersRoutes.use(authMiddleware);
usersRoutes.use(csrfProtection);

usersRoutes.get("/", asyncHandler(getUsers));
usersRoutes.get("/directory", asyncHandler(getUserDirectory));
usersRoutes.patch("/me", asyncHandler(updateMyProfileController));
usersRoutes.post(
  "/me/avatar",
  profileUploadRateLimit,
  userAvatarUpload,
  asyncHandler(updateMyAvatarController),
);
