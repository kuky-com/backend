require('module-alias/register')
const models = require('./src/models')
const express = require('express');
const sequelize = require('./src/config/database')
const router = require('./src/routes')
const bodyParser = require('body-parser');
const errorHandler = require('errorhandler');

const app = express();

app.use(bodyParser.json({ limit: '100mb' }));
app.use(express.json());

app.use(
    bodyParser.urlencoded({
        extended: true,
        limit: '100mb',
        parameterLimit: 50000,
    }),
);

app.use(errorHandler());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Expose-Headers', 'Authorization');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    next();
});

app.use('/api', router);

async function syncDatabase() {
    try {
        await sequelize.sync({ force: false }); 
        console.log('Database & tables have been created successfully.');
    } catch (error) {
        console.error('Error syncing the database:', error);
    }
}

syncDatabase();

app.listen(8000, () => {
    console.log('Server is running on port 8000');
});
