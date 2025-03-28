const { DataTypes } = require('sequelize');
const sequelize = require('@/config/database');
const Users = require('./users');
const JPFQuestions = require('./jpf_questions');
const JPFAnswers = require('./jpf_answers');

const JPFUserAnswer = sequelize.define('jpf_user_answers', {
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
  question_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'jpf_questions',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  answer_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'jpf_answers',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  answer_text: {
    type: DataTypes.STRING,
    allowNull: true,
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

JPFUserAnswer.belongsTo(Users, { foreignKey: 'user_id', as: 'answer_user' });
JPFUserAnswer.belongsTo(JPFQuestions, { foreignKey: 'question_id', as: 'answer_question' });
JPFUserAnswer.belongsTo(JPFAnswers, { foreignKey: 'answer_id', as: 'answer_answer' });

module.exports = JPFUserAnswer