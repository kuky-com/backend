const { DataTypes } = require('sequelize');
const sequelize = require('@/config/database');

const JPFAnswers = sequelize.define('jpf_answers', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
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
  content: {
    type: DataTypes.STRING
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

module.exports = JPFAnswers