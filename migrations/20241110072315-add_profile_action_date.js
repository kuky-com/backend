'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.addColumn(
        'users',
        'profile_action_date',
        {
          type: DataTypes.DATE,
          allowNull: true,
        },
      )
    ])
  },

  async down(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.removeColumn('users', 'profile_action_date')
    ]);
  }
};
