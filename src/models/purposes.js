const { DataTypes } = require('sequelize');
const sequelize = require('@/config/database');

const Purposes = sequelize.define('purposes', {
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
  normalized_purpose_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
});

module.exports = Purposes;
