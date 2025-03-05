'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.addColumn(
        'users',
        'audio_intro',
        {
          type: DataTypes.STRING,
          allowNull: true
        },
      ),
      queryInterface.addColumn(
        'users',
        'subtitle_intro',
        {
          type: DataTypes.STRING,
          allowNull: true
        },
      )
    ])
  },

  async down(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.removeColumn('users', 'audio_intro'),
      queryInterface.removeColumn('users', 'subtitle_intro')
    ]);
  }
};
