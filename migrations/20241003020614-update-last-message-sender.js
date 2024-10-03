'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.addColumn(
        'matches',
        'last_message_sender',
        {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id',
          },
          onDelete: 'NO ACTION',
        }
      )
    ])
  },

  async down(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.removeColumn('matches', 'last_message_sender')
    ]);
  }
};
