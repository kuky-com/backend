'use strict';
const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		return Promise.all([
			queryInterface.addColumn('users', 'online_status', {
				type: DataTypes.ENUM(
					'active',
					'away',
					'offline'
				),
				allowNull: false,
				defaultValue: 'active',
			}),
		]);
	},

	async down(queryInterface, Sequelize) {
		return Promise.all([
			queryInterface.removeColumn('users', 'online_status'),
		]);
	},
};
