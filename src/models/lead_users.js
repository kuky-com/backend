const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('@/config/database');

const LeadUsers = sequelize.define('lead_users', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    full_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    platform: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    gender: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    location: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    purpose: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    purpose_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'purposes',
          key: 'id',
        },
        onDelete: 'NO ACTION',
      }
});

module.exports = LeadUsers
