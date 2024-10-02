const { DataTypes } = require('sequelize');
const sequelize = require('@/config/database');
const Users = require('./users')
const Intestests = require('./interests')

const UserInterest = sequelize.define('user_interest', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
    onDelete: 'DO NOTHING',
  },
  interest_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'interests',
      key: 'id',
    },
    onDelete: 'DO NOTHING',
  },
  interest_type: {
    type: DataTypes.ENUM('like', 'dislike')
  }
});

Users.belongsToMany(Intestests, { through: UserInterest, foreignKey: 'user_id' });
Intestests.belongsToMany(Users, { through: UserInterest, foreignKey: 'interest_id' });

// UserInterest.hasMany(Intestests, { foreignKey: 'interest_id' });
// UserInterest.hasMany(Users, { foreignKey: 'user_id' });

module.exports = UserInterest;
