'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn('users', 'is_support', {
			type: Sequelize.BOOLEAN,
			defaultValue: false
		});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.removeColumn('users', 'is_support'); // Remove the column on rollback
	},
};
