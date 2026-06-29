"use strict";

/** @type {import("sequelize-cli").Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("status_posts", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
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

      type: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },

      text: {
        type: Sequelize.STRING(700),
        allowNull: true,
      },

      media_url: {
        type: Sequelize.STRING(700),
        allowNull: true,
      },

      media_mime_type: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },

      media_size: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      media_original_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },

      background_color: {
        type: Sequelize.STRING(40),
        allowNull: true,
      },

      expires_at: {
        type: Sequelize.DATE,
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

    await queryInterface.createTable("status_views", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },

      status_post_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "status_posts",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      viewer_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      viewed_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
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

    await queryInterface.addIndex("status_posts", ["user_id", "expires_at"], {
      name: "status_posts_user_expires_idx",
    });

    await queryInterface.addIndex("status_posts", ["expires_at"], {
      name: "status_posts_expires_idx",
    });

    await queryInterface.addIndex("status_views", ["status_post_id", "viewer_id"], {
      name: "status_views_status_viewer_unique_idx",
      unique: true,
    });

    await queryInterface.addIndex("status_views", ["viewer_id"], {
      name: "status_views_viewer_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("status_views");
    await queryInterface.dropTable("status_posts");
  },
};
