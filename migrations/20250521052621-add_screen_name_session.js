'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn('session_logs', 'screen_name', {
			type: Sequelize.STRING,
			defaultValue: 'index'
		});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.removeColumn('session_logs', 'screen_name'); 
	},
};
