const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('@/config/database');

const VerificationCode = sequelize.define('verification_code', {
  code: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  sent_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
});

module.exports = VerificationCode