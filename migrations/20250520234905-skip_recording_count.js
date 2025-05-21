'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn('users', 'skip_recording_count', {
			type: Sequelize.INTEGER,
			defaultValue: 0
		});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.removeColumn('users', 'skip_recording_count'); // Remove the column on rollback
	},
};
