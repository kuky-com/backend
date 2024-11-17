const usersController = require('./users');

const BASE_URL = `https://api-${process.env.SENDBIRD_APP_ID}.sendbird.com/v3`;
const headers = {
	'Content-Type': 'application/json',
	'Api-Token': process.env.SENDBIRD_TOKEN,
};

const getUserId = (userId) => {
	return `${process.env.NODE_ENV}_${userId}`;
};

async function createSendbirdUser(userId) {
	const user = await usersController.getUser(userId);

	const response = await fetch(`${BASE_URL}/users`, {
		method: 'POST',
		headers,
		body: JSON.stringify({
			user_id: getUserId(userId),
			nickname: user.full_name,
			profile_url: user.avatar,
		}),
	});

	if (!response.ok) {
		const errorData = await response.json();

		throw new Error(errorData);
	}

	return generateSendbirdToken(userId);
}

async function generateSendbirdToken(userId) {
	const response = await fetch(
		`${BASE_URL}/users/${getUserId(userId)}/token`,
		{
			method: 'POST',
			headers,
			body: JSON.stringify({}),
		}
	);

	if (!response.ok) {
		const errorData = await response.json();
		console.log(errorData);

		if (errorData.code === 400201) {
			return createSendbirdUser(userId);
		}
		console.log(`Failed to generate token: ${errorData.message}`);
		throw new Error(errorData);
	}

	const data = await response.json();
	console.log(`Access token generated for user ${userId}: ${data.token}`);
	return data.token;
}

/**
 * payload = {
 * 	nickname?:full_name
 * profile_url?: avatar
 * }
 */
async function updateSendbirdUser(userId, payload) {
	const response = await fetch(`${BASE_URL}/users/${getUserId(userId)}`, {
		method: 'PUT',
		headers,
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		const errorData = await response.json();
		console.log(errorData);

		if (errorData.code === 400201) {
			await createSendbirdUser(userId);
			return updateSendbirdUser(userId, payload);
		}
		console.log(`Failed to generate token: ${errorData.message}`);
		throw new Error(errorData);
	}

	const data = await response.json();
	console.log(`Access token generated for user ${userId}: ${data.token}`);
	return data.token;
}

module.exports = {
	generateSendbirdToken,
	createSendbirdUser,
	updateSendbirdUser,
};
