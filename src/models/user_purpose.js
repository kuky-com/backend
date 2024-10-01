const { DataTypes } = require('sequelize');
const sequelize = require('@/config/database');

const UserPurpose = sequelize.define('user_purpose', {
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
  purpose_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'purposes',
      key: 'id',
    },
    onDelete: 'CASCADE',
  }
});

module.exports = UserPurpose;
