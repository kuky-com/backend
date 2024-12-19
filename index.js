require('module-alias/register');
const models = require('./src/models');
const express = require('express');
const sequelize = require('./src/config/database');
const router = require('./src/routes');
const bodyParser = require('body-parser');
const errorHandler = require('errorhandler');
const { createDefaultTags } = require('./src/seeds/tags');
const path = require('path');
const Users = require('./src/models/users');
const Purposes = require('./src/models/purposes');
const Interests = require('./src/models/interests');
const Tags = require('./src/models/tags');
const {
	createOnesignalUser,
	getOnesignalUser,
	deleteOnesignalUser,
} = require('./src/controllers/onesignal');

const app = express();

app.use('/.well-known', express.static(path.join(__dirname, '.well-known')));
app.use(bodyParser.json({ limit: '100mb' }));
app.use(express.json());

app.use(
	bodyParser.urlencoded({
		extended: true,
		limit: '100mb',
		parameterLimit: 50000,
	})
);

// Health check endpoint
app.get('/health', (req, res) => {
	res.status(200).json({
		status: 'UP',
		message: 'The server is running normally!',
		timestamp: new Date().toISOString(),
	});
});

app.use(errorHandler());
app.use((req, res, next) => {
	res.header('Access-Control-Allow-Origin', '*');
	res.header(
		'Access-Control-Allow-Headers',
		'Origin, X-Requested-With, Content-Type, Accept, Authorization, Device-Id'
	);
	res.header('Access-Control-Expose-Headers', 'Authorization, Device-Id');
	res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
	next();
});

app.use('/api', router);

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function syncOnesignal(page = 0, limit = 100) {
	console.log('Syncing users page', page);

	const users = await Users.findAll({
		limit,
		offset: page * limit,
		include: [{ model: Purposes }, { model: Interests }, { model: Tags }],
	});

	const promies = users.map(async (u) => {
		const onesignalUser = await getOnesignalUser(u.id);
		if (!onesignalUser.errors?.length) {
			// 'Do not create if already exists'
			// (await deleteOnesignalUser(u.id));
			return;
		}
		return createOnesignalUser(u);
	});
	await Promise.all(promies);

	await sleep(1000);

	if (users.length === limit) {
		return syncOnesignal(page + 1, limit);
	} else {
		console.log('Done sync with onesignal');
	}
}

async function syncDatabase() {
	try {
		await sequelize.sync({ force: false });
		createDefaultTags();
		console.log('Database & tables have been created successfully.');
	} catch (error) {
		console.log('Error syncing the database:', error);
	}
}

syncDatabase();
// TODO: Remove this after it first runs on both staging and production (but is not urgent)
syncOnesignal();

app.listen(8000, () => {
	console.log('Server is running on port 8000');
});
