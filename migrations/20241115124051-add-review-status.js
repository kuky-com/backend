'use strict';
const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		return Promise.all([
			queryInterface.addColumn('review_users', 'status', {
				type: DataTypes.ENUM(
					'pending',
					'rejected',
					'approved'
				),
				allowNull: false,
				defaultValue: 'pending',
			}),
		]);
	},

	async down(queryInterface, Sequelize) {
		return Promise.all([
			queryInterface.removeColumn('review_users', 'status'),
		]);
	},
};
