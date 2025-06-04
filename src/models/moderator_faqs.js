'use strict';
const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

const ModeratorFaqs = sequelize.define('moderator_faqs', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    question: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    answer: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    ranking: {
        type: DataTypes.INTEGER,
        defaultValue: 100,
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
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

module.exports = ModeratorFaqs;
