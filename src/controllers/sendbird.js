const usersController = require('./users');

const BASE_URL = `https://api-${process.env.SENDBIRD_APP_ID}.sendbird.com/v3`;
const BASE_URL_V1 = `https://api-${process.env.SENDBIRD_APP_ID}.calls.sendbird.com/v1`;
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
	const response = await fetch(`${BASE_URL}/users/${getUserId(userId)}/token`, {
		method: 'POST',
		headers,
		body: JSON.stringify({}),
	});

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

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
async function getDirectCalls(next = '', unixTimestamp, limit = 100) {
	let searchParams;
	if (next) {
		searchParams = new URLSearchParams({
			limit,
			next,
			start_ts: unixTimestamp,
		});
	} else {
		searchParams = new URLSearchParams({
			limit,
			start_ts: unixTimestamp,
		});
	}
	const response = await fetch(`${BASE_URL_V1}/direct_calls?` + searchParams, {
		method: 'GET',
		headers,
	});

	if (!response.ok) {
		const errorData = await response.json();
		console.log(errorData);

		if (errorData.code === 429100) {
			await sleep(6000);
			return getDirectCalls(next, limit);
		}
		throw new Error(errorData);
	}

	const data = await response.json();
	return data;
}

async function getCallHistory(userId, startTs, endTs) {
	const response = await fetch(`${BASE_URL_V1}/users/${getUserId(userId)}/calls?start_ts=${startTs}&end_ts=${endTs}&limit=100`, {
		method: 'GET',
		headers,
	});

	if (!response.ok) {
		return []
	}

	const data = await response.json();
	return data.calls || [];
}

module.exports = {
	generateSendbirdToken,
	createSendbirdUser,
	updateSendbirdUser,
	getDirectCalls,
	getCallHistory
};
