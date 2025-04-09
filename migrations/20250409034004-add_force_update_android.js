'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn('app_versions', 'is_required_android', {
			type: Sequelize.BOOLEAN,
			defaultValue: false
		});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.removeColumn('app_versions', 'is_required_android'); // Remove the column on rollback
	},
};
 