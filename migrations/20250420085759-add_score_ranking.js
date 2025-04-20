'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'users',
        'score_ranking',
        {
          type: DataTypes.INTEGER,
          defaultValue: 0
        },
    )
  },

  async down(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.removeColumn('users', 'score_ranking')
    ]);
  }
};
