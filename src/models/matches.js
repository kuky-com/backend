const { DataTypes } = require('sequelize');
const sequelize = require('@/config/database');

const Matches = sequelize.define('matches', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  sender_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  receiver_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  sent_date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  response_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('sent', 'accepted', 'rejected')
  },
  conversation_id: {
    type: DataTypes.STRING,
    allowNull: true
  },
  last_message: {
    type: DataTypes.STRING,
    allowNull: true
  },
  last_message_date: {
    type: DataTypes.DATE,
    allowNull: true
  }
});

module.exports = Matches;
