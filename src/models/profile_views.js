'use strict';
const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

const ProfileViews = sequelize.define('profile_views', {
	id: {
		allowNull: false,
		primaryKey: true,
		type: DataTypes.UUID,
		defaultValue: DataTypes.UUIDV4,
	},
	viewerId: {
		type: DataTypes.INTEGER,
		allowNull: false,
		references: {
			model: 'users',
			key: 'id',
		},
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
	},
	userId: {
		type: DataTypes.INTEGER,
		allowNull: false,
		references: {
			model: 'users',
			key: 'id',
		},
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
	},
	createdAt: {
		allowNull: false,
		type: DataTypes.DATE,
		defaultValue: DataTypes.NOW,
	},
	updatedAt: {
		allowNull: false,
		type: DataTypes.DATE,
		defaultValue: DataTypes.NOW,
	},
});

module.exports = ProfileViews;
