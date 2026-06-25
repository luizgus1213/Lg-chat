import type { Request, Response } from "express";
import { registerSchema, loginSchema } from "../validators/AuthValidator";
import { registerUser, loginUser } from "../services/AuthService";
import { created, ok } from "../utils/httpResponse";

export async function registerUserController(req: Request, res: Response) {
  const data = registerSchema.parse(req.body);
  const result = await registerUser(data);

  return created(res, result, "Conta criada com sucesso.");
}

export async function loginUserController(req: Request, res: Response) {
  const data = loginSchema.parse(req.body);
  const result = await loginUser(data);

  return ok(res, result, "Login realizado com sucesso.");
}

export async function meController(req: Request, res: Response) {
  return ok(res, {
    user: req.user,
  });
}
