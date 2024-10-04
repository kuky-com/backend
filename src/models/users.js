const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('@/config/database');
const Tags = require('./tags');

const Users = sequelize.define('users', {
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
        allowNull: true,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    password: {
        type: DataTypes.STRING,
    },
    login_type: {
        type: DataTypes.ENUM('phone', 'email', 'apple', 'google')
    },
    gender: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    email_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
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
    profile_tag: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'tags',
          key: 'id',
        },
        onDelete: 'NO ACTION',
      },
});

Users.belongsTo(Tags, { foreignKey: 'profile_tag' });

module.exports = Users
