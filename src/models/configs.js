const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Configs = sequelize.define('configs', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.TEXT
      },
      key: {
        type: DataTypes.STRING,
        unique: true
      },
      value: {
        type: DataTypes.STRING
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
}, {
  tableName: 'configs',
  timestamps: true,
  underscored: true
});

module.exports = Configs;
