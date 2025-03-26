const { DataTypes } = require('sequelize');
const sequelize = require('@/config/database');

const Journeys = sequelize.define('journeys', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING
  },
  description: {
    type: DataTypes.STRING
  },
  example: {
    type: DataTypes.STRING,
    allowNull: true
  },
  jpf_question1: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'jpf_questions',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  jpf_question2: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'jpf_questions',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  jpf_video_question: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'jpf_questions',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  icon: {
    type: DataTypes.STRING,
    allowNull: true
  },
  image: {
    type: DataTypes.STRING,
    allowNull: true
  },
  category: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'journey_categories',
      key: 'id',
    },
    onDelete: 'CASCADE',
  }
});

module.exports = Journeys;
