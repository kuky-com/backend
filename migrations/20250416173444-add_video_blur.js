'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'users',
        'video_intro_blur',
        {
          type: DataTypes.STRING,
          allowNull: true
        },
    )

    await queryInterface.addColumn(
      'users',
        'video_purpose_blur',
        {
          type: DataTypes.STRING,
          allowNull: true
        },
    )
  },

  async down(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.removeColumn('users', 'video_intro_blur'),
      queryInterface.removeColumn('users', 'video_purpose_blur'),
    ]);
  }
};
