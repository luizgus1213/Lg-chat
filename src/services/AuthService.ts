import bcrypt from "bcryptjs";
import { UniqueConstraintError } from "sequelize";
import { AppError } from "../errors/AppError";
import { User } from "../models/User";
import { env } from "../config/env";
import { gerarToken } from "../utils/jwt";
import type { z } from "zod";
import type { registerSchema, loginSchema } from "../validators/AuthValidator";

type RegisterInput = z.infer<typeof registerSchema>;
type LoginInput = z.infer<typeof loginSchema>;

function publicUser(user: User) {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
  };
}

export async function registerUser(data: RegisterInput) {
  const emailJaExiste = await User.findOne({
    where: {
      email: data.email,
    },
  });

  if (emailJaExiste) {
    throw new AppError(409, "Esse email já está cadastrado.", "EMAIL_EXISTS");
  }

  const senhaCriptografada = await bcrypt.hash(data.senha, env.BCRYPT_ROUNDS);

  try {
    const user = await User.create({
      nome: data.nome,
      email: data.email,
      senha: senhaCriptografada,
    });

    const token = gerarToken({
      id: user.id,
      nome: user.nome,
      email: user.email,
    });

    return {
      token,
      user: publicUser(user),
    };
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      throw new AppError(409, "Esse email já está cadastrado.", "EMAIL_EXISTS");
    }

    throw error;
  }
}

export async function loginUser(data: LoginInput) {
  const user = await User.findOne({
    where: {
      email: data.email,
    },
  });

  if (!user) {
    throw new AppError(401, "Email ou senha incorretos.", "INVALID_LOGIN");
  }

  const senhaCorreta = await bcrypt.compare(data.senha, user.senha);

  if (!senhaCorreta) {
    throw new AppError(401, "Email ou senha incorretos.", "INVALID_LOGIN");
  }

  const token = gerarToken({
    id: user.id,
    nome: user.nome,
    email: user.email,
  });

  return {
    token,
    user: publicUser(user),
  };
}
