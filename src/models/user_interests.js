const { DataTypes } = require('sequelize');
const sequelize = require('@/config/database');
const Users = require('./users')
const Intestests = require('./interests')

const UserInterests = sequelize.define('user_interests', {
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
    onDelete: 'NO ACTION',
  },
  interest_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'interests',
      key: 'id',
    },
    onDelete: 'NO ACTION',
  },
  interest_type: {
    type: DataTypes.ENUM('like', 'dislike')
  }
});

Users.belongsToMany(Intestests, { through: UserInterests, foreignKey: 'user_id' });
Intestests.belongsToMany(Users, { through: UserInterests, foreignKey: 'interest_id' });

UserInterests.belongsTo(Users, { foreignKey: 'user_id' });
UserInterests.belongsTo(Intestests, { foreignKey: 'interest_id' });

module.exports = UserInterests;
