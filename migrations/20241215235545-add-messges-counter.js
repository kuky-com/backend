'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn('matches', 'messagesCount', {
			type: Sequelize.INTEGER,
			defaultValue: 0,
		});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.removeColumn('users', 'messagesCount'); // Remove the column on rollback
	},
};
