"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("messages", "text", {
      type: Sequelize.STRING(1000),
      allowNull: true,
    });

    await queryInterface.addColumn("messages", "media_url", {
      type: Sequelize.STRING(700),
      allowNull: true,
    });

    await queryInterface.addColumn("messages", "media_mime_type", {
      type: Sequelize.STRING(120),
      allowNull: true,
    });

    await queryInterface.addColumn("messages", "media_size", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.addColumn("messages", "media_original_name", {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("messages", "media_original_name");
    await queryInterface.removeColumn("messages", "media_size");
    await queryInterface.removeColumn("messages", "media_mime_type");
    await queryInterface.removeColumn("messages", "media_url");

    await queryInterface.changeColumn("messages", "text", {
      type: Sequelize.STRING(1000),
      allowNull: false,
    });
  },
};
