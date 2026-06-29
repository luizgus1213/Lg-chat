"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("chat_members", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },

      chat_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "chats",
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

      role: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "member",
      },

      joined_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },

      left_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      last_read_message_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
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

    await queryInterface.addConstraint("chat_members", {
      fields: ["chat_id", "user_id"],
      type: "unique",
      name: "chat_members_chat_id_user_id_unique",
    });

    await queryInterface.addIndex("chat_members", ["chat_id"]);
    await queryInterface.addIndex("chat_members", ["user_id"]);
    await queryInterface.addIndex("chat_members", ["role"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("chat_members");
  },
};
