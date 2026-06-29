"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS about VARCHAR(140);
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT false;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE;
    `);

    await queryInterface.sequelize.query(`
      UPDATE users
      SET about = 'Disponível'
      WHERE about IS NULL;
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("users", "last_seen_at");
    await queryInterface.removeColumn("users", "is_online");
    await queryInterface.removeColumn("users", "about");
    await queryInterface.removeColumn("users", "avatar_url");
  },
};
