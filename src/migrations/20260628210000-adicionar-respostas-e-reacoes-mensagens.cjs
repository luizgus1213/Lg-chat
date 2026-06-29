"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("messages", "reply_to_message_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "messages",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addIndex("messages", ["reply_to_message_id"], {
      name: "idx_messages_reply_to_message_id",
    });

    await queryInterface.createTable("message_reactions", {
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

      emoji: {
        type: Sequelize.STRING(20),
        allowNull: false,
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

    await queryInterface.addConstraint("message_reactions", {
      fields: ["message_id", "user_id"],
      type: "unique",
      name: "uq_message_reactions_message_user",
    });

    await queryInterface.addIndex("message_reactions", ["message_id"], {
      name: "idx_message_reactions_message_id",
    });

    await queryInterface.addIndex("message_reactions", ["user_id"], {
      name: "idx_message_reactions_user_id",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("message_reactions");
    await queryInterface.removeIndex("messages", "idx_messages_reply_to_message_id");
    await queryInterface.removeColumn("messages", "reply_to_message_id");
  },
};
