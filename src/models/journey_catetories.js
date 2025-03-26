const { DataTypes } = require('sequelize');
const sequelize = require('@/config/database');

const JourneyCategories = sequelize.define('journey_catetories', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING
  },
  question: {
    type: DataTypes.STRING
  },
  icon: {
    type: DataTypes.STRING,
    allowNull: true
  },
  image: {
    type: DataTypes.STRING,
    allowNull: true
  }
});

module.exports = JourneyCategories;
