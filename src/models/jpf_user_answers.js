const { DataTypes } = require('sequelize');
const sequelize = require('@/config/database');

const JPFUserAnswer = sequelize.define('jpf_answers', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  question: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'jpf_questions',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  answer: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'jpf_answers',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
});

module.exports = JPFUserAnswer