const { DataTypes } = require('sequelize');
const sequelize = require('@/config/database');

const ReviewUsers = sequelize.define('review_users', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
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
    reviewer_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        onDelete: 'CASCADE',
    },
    review_date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    note: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    rating: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    reason: {
        type: DataTypes.STRING,
        allowNull: true,
    },
});

module.exports = ReviewUsers;
