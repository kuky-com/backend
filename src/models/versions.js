const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('@/config/database');

const AppVersions = sequelize.define('app_versions', {
  version_ios: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  version_android: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  is_required: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  version_title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  release_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
});

module.exports = AppVersions