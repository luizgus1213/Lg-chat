import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { getMessages } from "../controllers/MessagesControllers";
import { asyncHandler } from "../utils/asyncHandler";

export const messagesRoutes = Router();

messagesRoutes.get("/:userId", authMiddleware, asyncHandler(getMessages));
