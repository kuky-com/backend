'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn('users', 'matching_tags', {
			type: Sequelize.ARRAY(Sequelize.STRING),
			defaultValue: []
		});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.removeColumn('users', 'matching_tags');
	},
};
