'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'users',
      'video_intro_transcript',
      {
        type: DataTypes.STRING,
        allowNull: true
      },
    )

    await queryInterface.addColumn(
      'users',
      'video_purpose_transcript',
      {
        type: DataTypes.STRING,
        allowNull: true
      },
    )

    await queryInterface.addColumn(
      'users',
      'video_interests_transcript',
      {
        type: DataTypes.STRING,
        allowNull: true
      },
    )
  },

  async down(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.removeColumn('users', 'video_intro_transcript'),
      queryInterface.removeColumn('users', 'video_purpose_transcript'),
      queryInterface.removeColumn('users', 'video_interests_transcript')
    ]);
  }
};
