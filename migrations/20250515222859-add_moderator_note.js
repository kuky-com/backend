'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn('users', 'moderator_note', {
			type: Sequelize.TEXT,
			allowNull: true,
		});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.removeColumn('users', 'moderator_note'); // Remove the column on rollback
	},
};
