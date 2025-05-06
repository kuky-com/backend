'use strict';
const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

const ModeratorPayments = sequelize.define('moderator_payments', {
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
  transaction_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  paid_amount: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  paid_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
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

module.exports = ModeratorPayments;
