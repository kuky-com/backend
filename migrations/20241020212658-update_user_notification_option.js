'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.addColumn(
        'inactive_users',
        'emailNotificationEnable', {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
      }
      ),
      queryInterface.addColumn(
        'inactive_users',
        'notificationEnable', {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
      }
      ),
      queryInterface.addColumn(
        'inactive_users',
        'subscribeEmail', {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
      }
      ),
      queryInterface.addColumn(
        'users',
        'emailNotificationEnable', {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
      }
      ),
      queryInterface.addColumn(
        'users',
        'notificationEnable', {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
      }
      ),
      queryInterface.addColumn(
        'users',
        'subscribeEmail', {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
      }
      ),
    ])
  },

  async down(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.removeColumn('inactive_users', 'emailNotificationEnable'),
      queryInterface.removeColumn('inactive_users', 'notificationEnable'),
      queryInterface.removeColumn('inactive_users', 'subscribeEmail'),
      queryInterface.removeColumn('users', 'emailNotificationEnable'),
      queryInterface.removeColumn('users', 'notificationEnable'),
      queryInterface.removeColumn('users', 'subscribeEmail'),
    ]);
  }
};
