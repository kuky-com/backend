const { DataTypes } = require('sequelize');
const sequelize = require('@/config/database');
const User = require('./users');

const SessionLog = sequelize.define('session_logs', {
    session_id: {
        type: DataTypes.UUID,
        primaryKey: true
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
    device_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    platform: {
        type: DataTypes.STRING,
        allowNull: false
    },
    start_time: {
        type: DataTypes.DATE,
        allowNull: false
    },
    end_time: {
        type: DataTypes.DATE,
        allowNull: true
    },
    createdAt: {
        allowNull: false,
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    updatedAt: {
        allowNull: false,
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
});

SessionLog.belongsTo(User, {
    as: 'user',
    foreignKey: 'user_id',
});

module.exports = SessionLog;
