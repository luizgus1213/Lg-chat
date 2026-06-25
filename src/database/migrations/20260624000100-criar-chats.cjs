"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("chats", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },

      type: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "private",
      },

      name: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },

      description: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },

      avatar_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },

      created_by_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
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

    await queryInterface.addIndex("chats", ["type"]);
    await queryInterface.addIndex("chats", ["created_by_id"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("chats");
  },
};
