const { DataTypes } = require('sequelize');
const sequelize = require('@/config/database');

const Subscriptions = sequelize.define('subscriptions', {
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
    orderId: {
        type: DataTypes.STRING(100),
    },
    packageName: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    productId: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    purchaseState: {
        type: DataTypes.INTEGER,
    },

    purchaseTime: {
        type: DataTypes.DATE,
    },

    purchaseToken: {
        type: DataTypes.STRING(250),
    },

    autoRenewing: {
        type: DataTypes.BOOLEAN,
        allowNull: true
    },

    transactionReceipt: {
        type: DataTypes.TEXT,
        allowNull: true
    },

    lastRenewed: {
        type: DataTypes.DATE,
        allowNull: true
    },
});

module.exports = Subscriptions;
