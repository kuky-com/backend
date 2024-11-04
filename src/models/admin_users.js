const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('@/config/database');
const Tags = require('./tags');

const AdminUsers = sequelize.define('admin_users', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    full_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
    },
    username: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
    },
    password: {
        type: DataTypes.STRING,
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
});

module.exports = AdminUsers
