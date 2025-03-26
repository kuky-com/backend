'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.addColumn(
        'users',
        'journey_id',
        {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'journeys',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
      ),
      queryInterface.addColumn(
        'users',
        'journey_category_id',
        {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'journey_categories',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
      ),
    ])
  },

  async down(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.removeColumn('users', 'journey_id'),
      queryInterface.removeColumn('users', 'journey_category_id'),
    ]);
  }
};
