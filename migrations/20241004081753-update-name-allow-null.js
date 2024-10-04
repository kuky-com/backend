'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('users', 'full_name', {
      type: Sequelize.STRING,
      allowNull: true,    
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('users', 'full_name', {
      type: Sequelize.STRING, 
      allowNull: false,      
    });
  },
};