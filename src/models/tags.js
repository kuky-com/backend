const { DataTypes } = require('sequelize');
const sequelize = require('@/config/database');

const Tags = sequelize.define('tags', {
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
  normalized_tag_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
});

module.exports = Tags;
