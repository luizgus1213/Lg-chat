import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../errors/AppError";

export interface TokenPayload {
  id: number;
  nome: string;
  email: string;
}

export function gerarToken(user: { id: number; nome: string; email: string }) {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  };

  return jwt.sign(
    {
      id: user.id,
      nome: user.nome,
      email: user.email,
    },
    env.JWT_SECRET,
    options,
  );
}

export function verificarToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);

    if (
      typeof decoded !== "object" ||
      decoded === null ||
      typeof decoded.id !== "number" ||
      typeof decoded.nome !== "string" ||
      typeof decoded.email !== "string"
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
