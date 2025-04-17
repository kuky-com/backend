'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'users',
        'payment_type',
        {
          type: DataTypes.STRING,
          allowNull: true
        },
    )

    await queryInterface.addColumn(
      'users',
        'payment_id',
        {
          type: DataTypes.STRING,
          allowNull: true
        },
    )
  },

  async down(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.removeColumn('users', 'payment_type'),
      queryInterface.removeColumn('users', 'payment_id'),
    ]);
  }
};
