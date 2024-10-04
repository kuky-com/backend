const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('@/config/database');

const InactiveUsers = sequelize.define('inactive_users', {
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    full_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    username: {
        type: DataTypes.STRING(100),
        allowNull: true,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    inactive_type: {
        type: DataTypes.ENUM('banned', 'self-deleted', 'deactived', 'system-deleted')
    },
    gender: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    membership_expired_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    pronouns: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    avatar: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    birthday: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    publicGender: {
        type: DataTypes.BOOLEAN,
        default: true
    },
    publicPronouns: {
        type: DataTypes.BOOLEAN,
        default: true
    },
    location: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    last_longitude: {
        type: DataTypes.DOUBLE,
        allowNull: true,
    },
    last_latitude: {
        type: DataTypes.DOUBLE,
        allowNull: true,
    },
    reason: {
        type: DataTypes.STRING,
        allowNull: true,
    },
});

module.exports = InactiveUsers
