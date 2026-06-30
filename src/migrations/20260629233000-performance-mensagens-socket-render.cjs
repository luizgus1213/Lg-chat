"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_chat_id_id_desc
      ON messages (chat_id, id DESC)
      WHERE chat_id IS NOT NULL;
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_chat_id_created_at_desc
      ON messages (chat_id, created_at DESC)
      WHERE chat_id IS NOT NULL;
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_members_user_left_archived
      ON chat_members (user_id, left_at, is_archived);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_members_chat_user_active
      ON chat_members (chat_id, user_id, left_at);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_chats_updated_at_desc
      ON chats (updated_at DESC);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_chats_updated_at_desc;`);
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_chat_members_chat_user_active;`);
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_chat_members_user_left_archived;`);
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_messages_chat_id_created_at_desc;`);
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_messages_chat_id_id_desc;`);
  },
};
