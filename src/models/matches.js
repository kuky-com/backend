const { DataTypes } = require('sequelize');
const sequelize = require('@/config/database');
const Users = require('./users');

const Matches = sequelize.define('matches', {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true,
	},
	sender_id: {
		type: DataTypes.INTEGER,
		allowNull: false,
		references: {
			model: 'users',
			key: 'id',
		},
		onDelete: 'CASCADE',
	},
	receiver_id: {
		type: DataTypes.INTEGER,
		allowNull: false,
		references: {
			model: 'users',
			key: 'id',
		},
		onDelete: 'CASCADE',
	},
	sent_date: {
		type: DataTypes.DATE,
		allowNull: false,
		defaultValue: DataTypes.NOW,
	},
	response_date: {
		type: DataTypes.DATE,
		allowNull: true,
	},
	status: {
		type: DataTypes.ENUM('sent', 'accepted', 'rejected', 'deleted'),
	},
	conversation_id: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	last_message_sender: {
		type: DataTypes.INTEGER,
		allowNull: true,
		references: {
			model: 'users',
			key: 'id',
		},
		onDelete: 'NO ACTION',
	},
	last_message: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	last_message_date: {
		type: DataTypes.DATE,
		allowNull: true,
	},
	messagesCount: {
		type: DataTypes.INTEGER,
		defaultValue: 0,
	},
	bot_messages_count: {
		type: DataTypes.INTEGER,
		defaultValue: 0,
	},
});

Matches.belongsTo(Users, { foreignKey: 'sender_id', as: 'sender' });
Matches.belongsTo(Users, { foreignKey: 'receiver_id', as: 'receiver' });

module.exports = Matches;
