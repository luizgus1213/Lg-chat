"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("chat_members", "is_pinned", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("chat_members", "is_archived", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("chat_members", "is_muted", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("chat_members", "pinned_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("chat_members", "archived_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("chat_members", "muted_until", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("chat_members", "muted_until");
    await queryInterface.removeColumn("chat_members", "archived_at");
    await queryInterface.removeColumn("chat_members", "pinned_at");
    await queryInterface.removeColumn("chat_members", "is_muted");
    await queryInterface.removeColumn("chat_members", "is_archived");
    await queryInterface.removeColumn("chat_members", "is_pinned");
  },
};
