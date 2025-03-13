'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.addColumn(
        'users',
        'audio_purpose',
        {
          type: DataTypes.STRING,
          allowNull: true
        },
      ),
      queryInterface.addColumn(
        'users',
        'subtitle_purpose',
        {
          type: DataTypes.STRING,
          allowNull: true
        },
      ),
      queryInterface.addColumn(
        'users',
        'video_challenge',
        {
          type: DataTypes.STRING,
          allowNull: true
        },
      ),
      queryInterface.addColumn(
        'users',
        'audio_challenge',
        {
          type: DataTypes.STRING,
          allowNull: true
        },
      ),
      queryInterface.addColumn(
        'users',
        'subtitle_challenge',
        {
          type: DataTypes.STRING,
          allowNull: true
        },
      ),
      queryInterface.addColumn(
        'users',
        'video_why',
        {
          type: DataTypes.STRING,
          allowNull: true
        },
      ),
      queryInterface.addColumn(
        'users',
        'audio_why',
        {
          type: DataTypes.STRING,
          allowNull: true
        },
      ),
      queryInterface.addColumn(
        'users',
        'subtitle_why',
        {
          type: DataTypes.STRING,
          allowNull: true
        },
      ),
      queryInterface.addColumn(
        'users',
        'video_interests',
        {
          type: DataTypes.STRING,
          allowNull: true
        },
      ),
      queryInterface.addColumn(
        'users',
        'audio_interests',
        {
          type: DataTypes.STRING,
          allowNull: true
        },
      ),queryInterface.addColumn(
        'users',
        'subtitle_interests',
        {
          type: DataTypes.STRING,
          allowNull: true
        },
      )
    ])
  },

  async down(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.removeColumn('users', 'audio_purpose'),
      queryInterface.removeColumn('users', 'subtitle_purpose'),
      queryInterface.removeColumn('users', 'video_challenge'),
      queryInterface.removeColumn('users', 'audio_challenge'),
      queryInterface.removeColumn('users', 'subtitle_challenge'),
      queryInterface.removeColumn('users', 'video_why'),
      queryInterface.removeColumn('users', 'audio_why'),
      queryInterface.removeColumn('users', 'subtitle_why'),
      queryInterface.removeColumn('users', 'video_interests'),
      queryInterface.removeColumn('users', 'audio_interests'),
      queryInterface.removeColumn('users', 'subtitle_interests')
    ]);
  }
};
