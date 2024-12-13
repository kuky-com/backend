'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.sequelize.query(`
      ALTER TYPE "enum_users_profile_approved" ADD VALUE 'resubmitted'
    `);
	},

	async down(queryInterface, Sequelize) {
		// 1. Create a new enum type without the 'resubmitted' value
		await queryInterface.sequelize.query(`
      CREATE TYPE "enum_users_profile_approved_new" AS ENUM ('pending', 'rejected', 'approved')
    `);

		// 2. Alter the column to use the new enum type
		await queryInterface.sequelize.query(`
      ALTER TABLE "users" 
      ALTER COLUMN "profile_approved" TYPE "enum_users_profile_approved_new" 
      USING "profile_approved"::text::"enum_users_profile_approved_new"
    `);

		// 3. Drop the old enum type
		await queryInterface.sequelize.query(`
      DROP TYPE "enum_users_profile_approved"
    `);

		// 4. Rename the new enum type to the old one
		await queryInterface.sequelize.query(`
      ALTER TYPE "enum_users_profile_approved_new" RENAME TO "enum_users_profile_approved"
    `);
	},
};
