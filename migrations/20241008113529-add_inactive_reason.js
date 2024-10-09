'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.addColumn(
        'inactive_users',
        'reason',
        {
          type: DataTypes.STRING,
          allowNull: true,
        },
      )
    ])
  },

  async down(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.removeColumn('inactive_users', 'reason')
    ]);
  }
};
