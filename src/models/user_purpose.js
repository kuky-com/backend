const { DataTypes } = require('sequelize');
const sequelize = require('@/config/database');
const Users = require('./users')
const Purposes = require('./purposes')

const UserPurpose = sequelize.define('user_purpose', {
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
  purpose_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'purposes',
      key: 'id',
    },
    onDelete: 'DO NOTHING',
  }
});

Users.belongsToMany(Purposes, { through: UserPurpose, foreignKey: 'user_id' });
Purposes.belongsToMany(Users, { through: UserPurpose, foreignKey: 'purpose_id' });

// UserPurpose.hasMany(Purposes, { foreignKey: 'purpose_id' });
// UserPurpose.hasMany(Users, { foreignKey: 'user_id' });

module.exports = UserPurpose;
