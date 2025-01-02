'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn('matches', 'bot_messages_count', {
			type: Sequelize.INTEGER,
			defaultValue: 0,
		});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.removeColumn('users', 'bot_messages_count'); // Remove the column on rollback
	},
};
