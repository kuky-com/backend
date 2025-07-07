'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.addColumn(
        'users',
        'lead',
        {
          type: DataTypes.STRING,
          allowNull: true,
        },
      ),
      queryInterface.addColumn(
        'users',
        'campaign',
        {
          type: DataTypes.STRING,
          allowNull: true,
        },
      ),
    ])
  },

  async down(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.removeColumn('users', 'lead'),
      queryInterface.removeColumn('users', 'campaign'),
    ]);
  }
};
