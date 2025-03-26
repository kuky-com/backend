const { DataTypes } = require('sequelize');
const sequelize = require('@/config/database');

const JPFQuestions = sequelize.define('jpf_questions', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  question: {
    type: DataTypes.STRING
  },
  question_type: {
    type: DataTypes.STRING, //multiple_choice, single_choice, text, one_to_ten
  },
  level_type: {
    type: DataTypes.STRING, //general, normal, video
  },
  icon: {
    type: DataTypes.STRING,
    allowNull: true
  },
  image: {
    type: DataTypes.STRING,
    allowNull: true
  }
});

module.exports = JPFQuestions;
