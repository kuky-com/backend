'use strict';
const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');
const Matches = require('./matches');

const Messages = sequelize.define('messages', {
	id: {
		allowNull: false,
		autoIncrement: true,
		primaryKey: true,
		type: DataTypes.INTEGER,
	},
	matchId: {
		type: DataTypes.INTEGER,
		allowNull: false,
		references: {
			model: 'matches',
			key: 'id',
		},
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
	},
	text: {
		type: DataTypes.TEXT,
		allowNull: true,
	},
	senderId: {
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
Messages.belongsTo(Matches, { foreignKey: 'matchId' });
module.exports = Messages;
