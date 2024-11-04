const { DataTypes } = require('sequelize');
const sequelize = require('@/config/database');

const AdminSessions = sequelize.define('admin_sessions', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  admin_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'admin_users',
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
    allowNull: true,
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

module.exports = AdminSessions;
