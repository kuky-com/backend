const { DataTypes } = require('sequelize');
const sequelize = require('@/config/database');

const Suggestions = sequelize.define('suggestions', {
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
  suggest_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  suggestion_date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  valid_invitation: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
});

module.exports = Suggestions;
