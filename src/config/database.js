require('dotenv').config();  // Add this line at the top

const { Sequelize } = require('sequelize');

// Create a Sequelize instance with environment variables
const sequelize = new Sequelize({
  database: process.env.POSTGRES_DB,
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  host: process.env.DB_HOST,
  dialect: 'postgres',
  port: process.env.DB_PORT,
  logging: false,
});

async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
}

testConnection();

module.exports = sequelize;
