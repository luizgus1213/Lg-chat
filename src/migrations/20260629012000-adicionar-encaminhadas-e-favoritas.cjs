"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("messages", "forwarded_from_message_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "messages",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.createTable("message_stars", {
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
        defaultValue: Sequelize.fn("NOW"),
      },

      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
    });

    await queryInterface.addConstraint("message_stars", {
      fields: ["message_id", "user_id"],
      type: "unique",
      name: "message_stars_message_id_user_id_unique",
    });

    await queryInterface.addIndex("message_stars", ["user_id"]);
    await queryInterface.addIndex("message_stars", ["message_id"]);
    await queryInterface.addIndex("messages", ["forwarded_from_message_id"]);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("messages", ["forwarded_from_message_id"]).catch(() => undefined);
    await queryInterface.removeIndex("message_stars", ["message_id"]).catch(() => undefined);
    await queryInterface.removeIndex("message_stars", ["user_id"]).catch(() => undefined);
    await queryInterface.removeConstraint(
      "message_stars",
      "message_stars_message_id_user_id_unique",
    ).catch(() => undefined);
    await queryInterface.dropTable("message_stars");
    await queryInterface.removeColumn("messages", "forwarded_from_message_id");
  },
};
