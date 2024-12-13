'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.removeColumn('users', 'profile_approved'),
      queryInterface.addColumn(
        'users',
        'profile_approved',
        {
          type: DataTypes.ENUM('pending', 'rejected', 'approved'),
          allowNull: false,
          defaultValue: 'pending',
        },
      )
    ])
  },

  async down(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.removeColumn('users', 'profile_approved')
    ]);
  }
};
