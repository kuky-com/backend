const { DataTypes } = require('sequelize');
const sequelize = require('@/config/database');
const Users = require('./users')
const Purposes = require('./purposes')

const UserPurposes = sequelize.define('user_purposes', {
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
  purpose_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'purposes',
      key: 'id',
    },
    onDelete: 'NO ACTION',
  }
});

Users.belongsToMany(Purposes, { through: UserPurposes, foreignKey: 'user_id' });
Purposes.belongsToMany(Users, { through: UserPurposes, foreignKey: 'purpose_id' });

UserPurposes.belongsTo(Users, { foreignKey: 'user_id' });
UserPurposes.belongsTo(Purposes, { foreignKey: 'purpose_id' });

Purposes.hasMany(UserPurposes, { foreignKey: 'purpose_id' });

module.exports = UserPurposes;
