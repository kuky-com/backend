const { DataTypes } = require('sequelize');
const sequelize = require('@/config/database');

const Sessions = sequelize.define('Session', {
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
  platform: {
    type: DataTypes.ENUM('android', 'ios', 'web'),
    allowNull: false,
  },
  device_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  login_date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  logout_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  ip_address: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  session_token: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  last_active: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  user_agent: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
});

module.exports = Sessions;
