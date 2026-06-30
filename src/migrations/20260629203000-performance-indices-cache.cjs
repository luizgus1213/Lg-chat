"use strict";

/** @type {import("sequelize-cli").Migration} */
module.exports = {
  async up(queryInterface) {
    async function tableExists(tableName) {
      const tables = await queryInterface.showAllTables();
      return tables.includes(tableName);
    }

    async function addIndexIfMissing(tableName, fields, name) {
      if (!(await tableExists(tableName))) return;

      const indexes = await queryInterface.showIndex(tableName);
      const alreadyExists = indexes.some((index) => index.name === name);

      if (alreadyExists) return;

      await queryInterface.addIndex(tableName, fields, { name });
    }

    await addIndexIfMissing("messages", ["chat_id", "created_at"], "messages_chat_created_perf_idx");
    await addIndexIfMissing("messages", ["chat_id", "id"], "messages_chat_id_perf_idx");
    await addIndexIfMissing("messages", ["sender_id", "created_at"], "messages_sender_created_perf_idx");

    await addIndexIfMissing("chats", ["updated_at"], "chats_updated_perf_idx");

    await addIndexIfMissing("chat_members", ["user_id", "left_at"], "chat_members_user_left_perf_idx");
    await addIndexIfMissing("chat_members", ["chat_id", "left_at"], "chat_members_chat_left_perf_idx");
    await addIndexIfMissing("chat_members", ["user_id", "is_archived", "is_pinned"], "chat_members_user_flags_perf_idx");

    await addIndexIfMissing("message_reactions", ["message_id"], "message_reactions_message_perf_idx");
    await addIndexIfMissing("message_stars", ["user_id", "message_id"], "message_stars_user_message_perf_idx");

    await addIndexIfMissing("status_posts", ["user_id", "expires_at", "created_at"], "status_posts_user_exp_created_perf_idx");
    await addIndexIfMissing("status_views", ["status_post_id", "viewer_id"], "status_views_post_viewer_perf_idx");
  },

  async down(queryInterface) {
    async function tableExists(tableName) {
      const tables = await queryInterface.showAllTables();
      return tables.includes(tableName);
    }

    async function removeIndexIfExists(tableName, name) {
      if (!(await tableExists(tableName))) return;

      const indexes = await queryInterface.showIndex(tableName);
      const exists = indexes.some((index) => index.name === name);

      if (!exists) return;

      await queryInterface.removeIndex(tableName, name);
    }

    await removeIndexIfExists("messages", "messages_chat_created_perf_idx");
    await removeIndexIfExists("messages", "messages_chat_id_perf_idx");
    await removeIndexIfExists("messages", "messages_sender_created_perf_idx");
    await removeIndexIfExists("chats", "chats_updated_perf_idx");
    await removeIndexIfExists("chat_members", "chat_members_user_left_perf_idx");
    await removeIndexIfExists("chat_members", "chat_members_chat_left_perf_idx");
    await removeIndexIfExists("chat_members", "chat_members_user_flags_perf_idx");
    await removeIndexIfExists("message_reactions", "message_reactions_message_perf_idx");
    await removeIndexIfExists("message_stars", "message_stars_user_message_perf_idx");
    await removeIndexIfExists("status_posts", "status_posts_user_exp_created_perf_idx");
    await removeIndexIfExists("status_views", "status_views_post_viewer_perf_idx");
  },
};
