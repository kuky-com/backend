const { DataTypes } = require('sequelize');
const sequelize = require('@/config/database');

const UserInterest = sequelize.define('user_interest', {
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
  interest_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'interests',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  interest_type: {
    type: DataTypes.ENUM('like', 'dislike')
  }
});

module.exports = UserInterest;
