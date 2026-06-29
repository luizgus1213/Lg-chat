import type { Request, Response } from "express";
import fs from "fs/promises";
import { updateMyProfileSchema } from "../validators/userValidator";
import {
  listUsers,
  updateMyAvatar,
  updateMyProfile,
} from "../services/UserService";
import { ok } from "../utils/httpResponse";

export async function getUsers(req: Request, res: Response) {
  const users = await listUsers(req.user!.id);

  return ok(res, users);
}

export async function updateMyProfileController(req: Request, res: Response) {
  const data = updateMyProfileSchema.parse(req.body);

  const user = await updateMyProfile({
    currentUserId: req.user!.id,
    nome: data.nome,
    about: data.about,
  });

  return ok(res, user, "Perfil atualizado com sucesso.");
}

export async function updateMyAvatarController(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: {
        code: "AVATAR_REQUIRED",
        message: "Envie uma imagem para salvar como foto de perfil.",
        statusCode: 400,
      },
    });
  }

  try {
    const avatarUrl = `/uploads/users/${req.file.filename}`;

    const user = await updateMyAvatar({
      currentUserId: req.user!.id,
      avatarUrl,
    });

    return ok(res, user, "Foto de perfil atualizada com sucesso.");
  } catch (error) {
    await fs.unlink(req.file!.path).catch(() => undefined);

    throw error;
  }
}
