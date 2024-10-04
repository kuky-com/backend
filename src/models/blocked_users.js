const { DataTypes } = require('sequelize');
const sequelize = require('@/config/database');
const Users = require('./users');

const BlockedUsers = sequelize.define('blocked_users', {
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
  blocked_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  blocked_date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
});

BlockedUsers.belongsTo(Users, { foreignKey: 'user_id', as: 'user' });
BlockedUsers.belongsTo(Users, { foreignKey: 'blocked_id', as: 'blockedUser' });

module.exports = BlockedUsers;
