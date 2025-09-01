'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn('session_logs', 'receiver_id', {
			type: Sequelize.INTEGER,
			allowNull: true,
			references: {
				model: 'users',
				key: 'id',
			},
			onDelete: 'SET NULL',
		});
	},

	down: async (queryInterface) => {
		await queryInterface.removeColumn('session_logs', 'receiver_id'); 
	},
};
