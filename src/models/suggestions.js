const { DataTypes } = require('sequelize');
const sequelize = require('@/config/database');

const Suggestions = sequelize.define('suggestions', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false
  },
  friend_id: {
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
  suggestion_seen: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  suggestion_accept: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
});

module.exports = Suggestions;
