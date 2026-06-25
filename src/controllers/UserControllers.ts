import { Request, Response } from "express";
import { User } from "../models/User";
import { Op } from "sequelize";
export const getUsers = async (req: Request, res: Response) => {
  const users = await User.findAll({
    where: {
      id: {
        [Op.ne]: req.user!.id,
      },
    },
    attributes: ["id", "nome", "email"],
    order: [["nome", "ASC"]],
  });

  return res.json({
    success: true,
    data: users,
  });
};
