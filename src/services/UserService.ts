import { Op } from "sequelize";
import { User } from "../models/User";

export async function listUsers(currentUserId: number) {
  const users = await User.findAll({
    where: {
      id: {
        [Op.ne]: currentUserId,
      },
    },
    attributes: ["id", "nome", "email"],
    order: [["nome", "ASC"]],
  });

  return users.map((user) => ({
    id: user.id,
    nome: user.nome,
    email: user.email,
  }));
}
