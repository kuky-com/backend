const { DataTypes } = require('sequelize');
const sequelize = require('@/config/database');
const Users = require('./users')
const Matches = require('./matches')

const Notifications = sequelize.define('notifications', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    sender_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
        onDelete: 'NO ACTION',
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        onDelete: 'NO ACTION',
    },
    match_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'matches',
            key: 'id',
        },
        onDelete: 'NO ACTION',
    },
    title: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    notification_type: {
        type: DataTypes.ENUM('message', 'new_match', 'new_suggestions'),
        allowNull: false,
    },
    notification_date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    seen: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    seen_date: {
        type: DataTypes.DATE,
        allowNull: true,
    },
});

Notifications.belongsTo(Users, { foreignKey: 'user_id' });
Notifications.belongsTo(Matches, { foreignKey: 'match_id' });

module.exports = Notifications;
