'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn('users', 'is_moderators', {
			type: Sequelize.BOOLEAN,
			defaultValue: false
		});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.removeColumn('users', 'is_moderators'); // Remove the column on rollback
	},
};
