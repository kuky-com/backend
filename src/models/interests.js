const { DataTypes } = require('sequelize');
const sequelize = require('@/config/database');

const Interests = sequelize.define('interests', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING
  },
  icon: {
    type: DataTypes.STRING,
    allowNull: true
  },
  image: {
    type: DataTypes.STRING,
    allowNull: true
  },
  normalized_interest_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
});

module.exports = Interests;
