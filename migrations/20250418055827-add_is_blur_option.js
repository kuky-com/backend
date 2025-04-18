'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'users',
        'is_video_intro_blur',
        {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
    )

    await queryInterface.addColumn(
      'users',
        'is_video_purpose_blur',
        {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
    )
  },

  async down(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.removeColumn('users', 'is_video_intro_blur'),
      queryInterface.removeColumn('users', 'is_video_purpose_blur'),
    ]);
  }
};
