const { DataTypes } = require('sequelize');
const sequelize = require('@/config/database');
const Users = require('./users');

const ReferralUsers = sequelize.define('referral_users', {
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
  referral_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  referral_code: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  referral_date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
});

ReferralUsers.belongsTo(Users, { foreignKey: 'user_id', as: 'user' });
ReferralUsers.belongsTo(Users, { foreignKey: 'referral_id', as: 'referral_user' });

module.exports = ReferralUsers;
