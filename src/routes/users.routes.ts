import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { getUsers } from "../controllers/UserControllers";
import { asyncHandler } from "../utils/asyncHandler";

export const usersRoutes = Router();

usersRoutes.get("/", authMiddleware, asyncHandler(getUsers));
