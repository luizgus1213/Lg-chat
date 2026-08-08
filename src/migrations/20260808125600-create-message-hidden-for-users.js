"use strict";

/** @type {import("sequelize-cli").Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("message_hidden_for_users", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },

      message_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "messages",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },

      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addConstraint("message_hidden_for_users", {
      fields: ["message_id", "user_id"],
      type: "unique",
      name: "message_hidden_for_users_message_id_user_id_unique",
    });

    await queryInterface.addIndex("message_hidden_for_users", ["user_id"], {
      name: "message_hidden_for_users_user_id_idx",
    });

    await queryInterface.addIndex("message_hidden_for_users", ["message_id"], {
      name: "message_hidden_for_users_message_id_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("message_hidden_for_users");
  },
};
