'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.addColumn(
        'users',
        'video_intro',
        {
          type: DataTypes.STRING,
          allowNull: true,
        },
      ),
      queryInterface.addColumn(
        'users',
        'video_intro_public',
        {
          type: DataTypes.BOOLEAN,
          defaultValue: true
        },
      ),
      queryInterface.addColumn(
        'users',
        'video_purpose',
        {
          type: DataTypes.STRING,
          allowNull: true
        },
      ),
      queryInterface.addColumn(
        'users',
        'video_purpose_audio',
        {
          type: DataTypes.STRING,
          allowNull: true
        },
      )
    ])
  },

  async down(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.removeColumn('users', 'video_intro'),
      queryInterface.removeColumn('users', 'video_purpose'),
      queryInterface.removeColumn('users', 'video_purpose_audio'),
      queryInterface.removeColumn('users', 'video_intro_public'),
    ]);
  }
};
