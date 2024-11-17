const { DataTypes } = require('sequelize');
const sequelize = require('@/config/database');
const User = require('./users');

const ReviewUsers = sequelize.define('review_users', {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true,
	},
	user_id: {
		type: DataTypes.INTEGER,
		allowNull: false,
		references: {
			model: 'users',
			key: 'id',
		},
		onDelete: 'CASCADE',
	},
	reviewer_id: {
		type: DataTypes.INTEGER,
		allowNull: false,
		references: {
			model: 'users',
			key: 'id',
		},
		onDelete: 'CASCADE',
	},
	review_date: {
		type: DataTypes.DATE,
		allowNull: false,
		defaultValue: DataTypes.NOW,
	},
	note: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	rating: {
		type: DataTypes.INTEGER,
		allowNull: false,
	},
	reason: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	status: {
		type: DataTypes.ENUM('pending', 'rejected', 'approved'),
		allowNull: false,
		defaultValue: 'pending',
	},
});

ReviewUsers.belongsTo(User, {
	as: 'reviewer', // Alias to use for the relationship
	foreignKey: 'reviewer_id',
});

module.exports = ReviewUsers;
