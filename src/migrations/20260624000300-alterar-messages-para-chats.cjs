"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("messages", "chat_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "chats",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    await queryInterface.addColumn("messages", "type", {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: "text",
    });

    await queryInterface.addColumn("messages", "edited_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("messages", "deleted_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addIndex("messages", ["chat_id"]);
    await queryInterface.addIndex("messages", ["sender_id"]);
    await queryInterface.addIndex("messages", ["created_at"]);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("messages", "deleted_at");
    await queryInterface.removeColumn("messages", "edited_at");
    await queryInterface.removeColumn("messages", "type");
    await queryInterface.removeColumn("messages", "chat_id");
  },
};
