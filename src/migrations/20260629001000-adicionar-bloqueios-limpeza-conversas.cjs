"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("chat_members", "chat_cleared_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("chat_members", "chat_deleted_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.createTable("user_blocks", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },

      blocker_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      blocked_id: {
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
        defaultValue: Sequelize.fn("NOW"),
      },

      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
    });

    await queryInterface.addConstraint("user_blocks", {
      fields: ["blocker_id", "blocked_id"],
      type: "unique",
      name: "user_blocks_blocker_id_blocked_id_unique",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("user_blocks");

    await queryInterface.removeColumn("chat_members", "chat_deleted_at");
    await queryInterface.removeColumn("chat_members", "chat_cleared_at");
  },
};
