import type { Request, Response, NextFunction } from "express";
import { verificarToken } from "../utils/jwt";
import { AppError } from "../errors/AppError";
import { User } from "../models/User";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        nome: string;
        email: string;
        avatarUrl: string | null;
        about: string | null;
        isOnline: boolean;
        lastSeenAt: Date | null;
      };
    }
  }
}

export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError(401, "Você precisa estar logado.", "AUTH_REQUIRED");
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const payload = verificarToken(token);

    const user = await User.findByPk(payload.id, {
      attributes: [
        "id",
        "nome",
        "email",
        "avatarUrl",
        "about",
        "isOnline",
        "lastSeenAt",
      ],
    });

    if (!user) {
      throw new AppError(401, "Usuário não encontrado.", "USER_NOT_FOUND");
    }

    req.user = {
      id: user.id,
      nome: user.nome,
      email: user.email,
      avatarUrl: user.avatarUrl ?? null,
      about: user.about ?? "Disponível",
      isOnline: Boolean(user.isOnline),
      lastSeenAt: user.lastSeenAt ?? null,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}
