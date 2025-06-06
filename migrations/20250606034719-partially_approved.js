'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_users_profile_approved" ADD VALUE 'partially_approved';
    `);
  },

  async down (queryInterface, Sequelize) {
    // Note: PostgreSQL doesn't support removing enum values directly
    // You would need to recreate the enum type if rollback is needed
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_users_profile_approved_new" AS ENUM('pending', 'rejected', 'approved', 'resubmitted');
      ALTER TABLE users ALTER COLUMN approved_profile TYPE "enum_users_profile_approved_new" USING profile_approved::text::"enum_users_profile_approved_new";
      DROP TYPE "enum_users_profile_approved";
      ALTER TYPE "enum_users_profile_approved_new" RENAME TO "enum_users_profile_approved";
    `);
  }
};
