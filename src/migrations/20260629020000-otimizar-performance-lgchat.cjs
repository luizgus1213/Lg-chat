"use strict";

async function createIndex(queryInterface, sql) {
  await queryInterface.sequelize.query(sql);
}

async function dropIndex(queryInterface, indexName) {
  await queryInterface.sequelize.query(`DROP INDEX IF EXISTS ${indexName};`);
}

module.exports = {
  async up(queryInterface) {
    await createIndex(
      queryInterface,
      "CREATE INDEX IF NOT EXISTS messages_chat_id_id_idx ON messages (chat_id, id DESC);",
    );

    await createIndex(
      queryInterface,
      "CREATE INDEX IF NOT EXISTS messages_chat_id_created_at_idx ON messages (chat_id, created_at);",
    );

    await createIndex(
      queryInterface,
      "CREATE INDEX IF NOT EXISTS messages_chat_id_deleted_type_idx ON messages (chat_id, deleted_at, type);",
    );

    await createIndex(
      queryInterface,
      "CREATE INDEX IF NOT EXISTS messages_reply_to_message_id_idx ON messages (reply_to_message_id);",
    );

    await createIndex(
      queryInterface,
      "CREATE INDEX IF NOT EXISTS messages_forwarded_from_message_id_idx ON messages (forwarded_from_message_id);",
    );

    await createIndex(
      queryInterface,
      "CREATE INDEX IF NOT EXISTS message_reactions_message_id_user_id_idx ON message_reactions (message_id, user_id);",
    );

    await createIndex(
      queryInterface,
      "CREATE INDEX IF NOT EXISTS message_stars_user_id_message_id_idx ON message_stars (user_id, message_id);",
    );

    await createIndex(
      queryInterface,
      "CREATE INDEX IF NOT EXISTS message_stars_message_id_user_id_idx ON message_stars (message_id, user_id);",
    );

    await createIndex(
      queryInterface,
      "CREATE INDEX IF NOT EXISTS chat_members_user_active_idx ON chat_members (user_id, left_at, chat_deleted_at, is_archived);",
    );

    await createIndex(
      queryInterface,
      "CREATE INDEX IF NOT EXISTS chat_members_chat_user_idx ON chat_members (chat_id, user_id);",
    );

    await createIndex(
      queryInterface,
      "CREATE INDEX IF NOT EXISTS user_blocks_blocker_blocked_idx ON user_blocks (blocker_id, blocked_id);",
    );

    await createIndex(
      queryInterface,
      "CREATE INDEX IF NOT EXISTS user_blocks_blocked_blocker_idx ON user_blocks (blocked_id, blocker_id);",
    );
  },

  async down(queryInterface) {
    await dropIndex(queryInterface, "user_blocks_blocked_blocker_idx");
    await dropIndex(queryInterface, "user_blocks_blocker_blocked_idx");
    await dropIndex(queryInterface, "chat_members_chat_user_idx");
    await dropIndex(queryInterface, "chat_members_user_active_idx");
    await dropIndex(queryInterface, "message_stars_message_id_user_id_idx");
    await dropIndex(queryInterface, "message_stars_user_id_message_id_idx");
    await dropIndex(queryInterface, "message_reactions_message_id_user_id_idx");
    await dropIndex(queryInterface, "messages_forwarded_from_message_id_idx");
    await dropIndex(queryInterface, "messages_reply_to_message_id_idx");
    await dropIndex(queryInterface, "messages_chat_id_deleted_type_idx");
    await dropIndex(queryInterface, "messages_chat_id_created_at_idx");
    await dropIndex(queryInterface, "messages_chat_id_id_idx");
  },
};
