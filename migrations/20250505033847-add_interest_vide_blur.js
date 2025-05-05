'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'users',
        'video_interests_blur',
        {
          type: DataTypes.STRING,
          allowNull: true
        },
    )

    await queryInterface.addColumn(
      'users',
        'is_video_interests_blur',
        {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
    )
  },

  async down(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.removeColumn('users', 'video_interests_blur'),
      queryInterface.removeColumn('users', 'is_video_interests_blur'),
    ]);
  }
};
