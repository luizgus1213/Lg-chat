import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../errors/AppError";

export interface TokenPayload {
  id: number;
  nome: string;
  email: string;
}

export function gerarToken(user: { id: number; nome: string; email: string }) {
  return jwt.sign(
    {
      id: user.id,
      nome: user.nome,
      email: user.email,
    },
    env.JWT_SECRET,
    {
      expiresIn: "7d",
    },
  );
}

export function verificarToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);

    if (
      typeof decoded !== "object" ||
      decoded === null ||
      typeof decoded.id !== "number"
    ) {
      throw new AppError(401, "Token inválido.", "INVALID_TOKEN");
    }

    return decoded as TokenPayload;
  } catch {
    throw new AppError(
      401,
      "Sessão inválida. Faça login novamente.",
      "INVALID_TOKEN",
    );
  }
}
