import type { Request, Response } from "express";
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendEmailCodeSchema,
} from "../validators/AuthValidator";
import {
  registerUser,
  loginUser,
  verifyEmail,
  resendVerificationEmail,
} from "../services/AuthService";
import { created, ok } from "../utils/httpResponse";

export async function registerUserController(req: Request, res: Response) {
  const data = registerSchema.parse(req.body);
  const result = await registerUser(data);

  return created(
    res,
    result,
    "Conta criada. Enviamos um código de verificação para seu email.",
  );
}

export async function loginUserController(req: Request, res: Response) {
  const data = loginSchema.parse(req.body);
  const result = await loginUser(data);

  return ok(res, result, "Login realizado com sucesso.");
}

export async function verifyEmailController(req: Request, res: Response) {
  const data = verifyEmailSchema.parse(req.body);
  const result = await verifyEmail(data);

  return ok(res, result, "Email verificado com sucesso.");
}

export async function resendEmailCodeController(req: Request, res: Response) {
  const data = resendEmailCodeSchema.parse(req.body);
  const result = await resendVerificationEmail(data);

  return ok(
    res,
    result,
    "Se o email estiver cadastrado e ainda não verificado, enviaremos um novo código.",
  );
}

export async function meController(req: Request, res: Response) {
  return ok(res, {
    user: req.user,
  });
}
