const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'referral_id', {
      type: Sequelize.STRING, 
      allowNull: true, 
    });

    const users = await queryInterface.sequelize.query(
      'SELECT id FROM "users";',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    for (const user of users) {
      const fullUUID = uuidv4().replace(/-/g, '').toUpperCase(); 
      await queryInterface.sequelize.query(
        `UPDATE "users" SET referral_id = :referral_id WHERE id = :id;`,
        {
          replacements: { referral_id: fullUUID, id: user.id },
        }
      );
    }

    await queryInterface.changeColumn('users', 'referral_id', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: Sequelize.literal(
        "UPPER(replace(gen_random_uuid()::text, '-', ''))"
      ),
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'referral_id');
  },
};
