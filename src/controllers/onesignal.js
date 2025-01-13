const Tags = require('../models/tags');

const ONESIGNAL_URL = 'https://onesignal.com/api/v1/notifications';
const ONESISGNAL_APP_ID = 'c3fb597e-e318-4eab-9d90-cd43b9491bc1';

const headers = {
	accept: 'application/json',
	Authorization: `Basic ${process.env.ONESIGNAL_API_KEY}`,
	'content-type': 'application/json',
};

async function getOnesignalUser(userId) {
	const onesignalId = process.env.NODE_ENV + '_' + userId;
	const response = await fetch(
		`https://api.onesignal.com/apps/${ONESISGNAL_APP_ID}/users/by/external_id/${onesignalId}`,
		{
			method: 'GET',
			headers: {
				accept: 'application/json',
				Authorization: `Key ${process.env.ONESIGNAL_API_KEY}`,
			},
		}
	);

	return response.json();
}

async function createOnesignalUser(user) {
	const tags = {};

	/**
	 * TODO: uncommnet when we get more tags for likes/purposes.
	 *  At the moment, we are limited to 2 tags/use by the onesignal plan
	 *  */
	// for (let i of user.interests) {
	// 	// console.log(i);
	// 	if (i.user_interests.interest_type === 'like' && i.normalized_interest_id) {
	// 		const id = `${process.env.NODE_ENV}_like_${i.normalized_interest_id}`;

	// 		if (tags[id]) {
	// 			tags[id] = tags[id] + 1;
	// 		} else {
	// 			tags[id] = 1;
	// 		}
	// 	}
	// }

	// for (let p of user.purposes) {
	// 	if (p.normalized_purpose_id) {
	// 		const id = `${process.env.NODE_ENV}_purpose_${p.normalized_purpose_id}`;

	// 		if (tags[id]) {
	// 			tags[id] = tags[id] + 1;
	// 		} else {
	// 			tags[id] = 1;
	// 		}
	// 	}
	// }

	if (user.profile_tag) {
		const tag_id = `${process.env.NODE_ENV}_profile_tag`;
		tags[tag_id] = user.profile_tag;
	}

	const onesignalId = process.env.NODE_ENV + '_' + user.id;

	await fetch(`https://api.onesignal.com/apps/${ONESISGNAL_APP_ID}/users`, {
		method: 'POST',
		headers: { accept: 'application/json', 'content-type': 'application/json' },
		body: JSON.stringify({
			identity: { external_id: onesignalId },
			properties: {
				tags,
			},
		}),
	});
}

async function deleteOnesignalUser(userId) {
	const onesignalId = process.env.NODE_ENV + '_' + userId;
	const response = await fetch(
		`https://api.onesignal.com/apps/${ONESISGNAL_APP_ID}/users/by/external_id/${onesignalId}`,
		{
			method: 'DELETE',
			headers: {
				accept: 'application/json',
				Authorization: `Key ${process.env.ONESIGNAL_API_KEY}`,
			},
		}
	);

	return response.json();
}

/**
 * Function that gets the current tags object (can be empty) and updates it
 * with the new tag
 * ! This function doesn't perform any update in onesignal.
 * @param {*} tags current onesignal user user tags. Can be empty.
 * @param {*} type tag type - like/purpose/tag. These are the types of ta
 * @param {*} normalizedId // normalized id of the like/purpose/tag
 * @param {*} operation // add or delete. Keep the count for each tag id
 * @returns  formatted tags
 */
function formatOnesignalTags(tags, type, normalizedId, operation) {
	if (type === 'tag') {
		let tagId = process.env.NODE_ENV + '_profile_tag';
		tags[tagId] = normalizedId;
	}
	return tags;
	// TODO: uncomment when we are allowed to have more tags (so that we can tag puproses and interests)

	// const tagId = process.env.NODE_ENV + '_' + type + '_' + normalizedId;
	// if (operation === 'add') {
	// 	if (tags[tagId]) {
	// 		tags[tagId] = parseInt(tags[tagId]) + 1;
	// 	} else {
	// 		tags[tagId] = 1;
	// 	}
	// } else {
	// 	tags[tagId] = parseInt(tags[tagId]) - 1;
	// 	if (tags[tagId] <= 0) {
	// 		tags[tagId] = '';
	// 	}
	// }

	// return tags;
}
/**
 * Updates the tag in onesingal.
 * @param {*} userId database user id
 * @param {*} type tag type - like/purpose/tag. These are the types of ta
 * @param {*} normalizedId // normalized id of the like/purpose/tag
 * @param {*} operation // add or delete. Keep the count for each tag id
 * @returns
 */
async function updateOnesignalUserTags(userId, type, normalizedId, operation) {
	if (!normalizedId) {
		return;
	}

	const user = await getOnesignalUser(userId);

	user.properties.tags = formatOnesignalTags(
		user.properties.tags,
		type,
		normalizedId,
		operation
	);

	return updateOnesignalUser(user, userId);
}

async function updateOnesignalUser(newOnesignalUser, userId) {
	const onesignalId = process.env.NODE_ENV + '_' + userId;

	const updateResponse = await fetch(
		`https://api.onesignal.com/apps/${ONESISGNAL_APP_ID}/users/by/external_id/${onesignalId}`,
		{
			method: 'PATCH',
			body: JSON.stringify(newOnesignalUser),
			headers: {
				accept: 'application/json',
				Authorization: `${process.env.ONESIGNAL_API_KEY}`,
				'content-type': 'application/json',
			},
		}
	);

	const r = await updateResponse.json();

	return r;
}

async function addOnesignalNotification(title, content, data, userId) {
	const body = {
		include_external_user_ids: [`${process.env.NODE_ENV}_${userId}`],
		channel_for_external_user_ids: 'push',
		app_id: ONESISGNAL_APP_ID,

		// additional_data:
		data,
		headings: {
			en: title,
		},
		contents: {
			en: content,
		},
	};

	const res = await fetch(ONESIGNAL_URL, {
		method: 'POST',
		headers,
		body: JSON.stringify(body),
	});
	const r = await res.json();
	if (r.errors?.length) {
		console.log('Notification errors: ', r.errors);
	}
	return r;
}

/**
 * Creates a segment
 * @param {*} segmentName
 * @param {*} filters
 * @returns
 */
async function createSegment(segmentName, filters) {
	const url = `https://api.onesignal.com/apps/${ONESISGNAL_APP_ID}/segments`;
	const body = {
		name: segmentName,
		filters,
	};
	const options = {
		method: 'POST',
		headers: {
			accept: 'application/json',
			Authorization: `Key ${process.env.ONESIGNAL_API_KEY}`,
			'Content-Type': 'application/json; charset=utf-8',
		},
		body: JSON.stringify(body),
	};

	const result = await (await fetch(url, options)).json();
	if (result.errors) {
		console.log('Segment creation errors ', result.errors);
		return result.errors;
	}
}

/**
 *  Format an onesignal filter that will include only users with a specific tagId.
 * @param {*} profileTagId Id from database
 */
function getProfileTagFilter(profileTagId) {
	return {
		field: 'tag',
		key: `${process.env.NODE_ENV}_profile_tag`,
		relation: '=',
		value: profileTagId,
	};
}

/**
 * Send batch notification to users that match a specific filter
 */
async function addBatchNotifications(title, content, filters) {
	const url = 'https://api.onesignal.com/notifications?c=push';
	const options = {
		method: 'POST',
		headers: {
			accept: 'application/json',
			Authorization: `Key ${process.env.ONESIGNAL_API_KEY}`,
			'content-type': 'application/json',
		},
		body: JSON.stringify({
			app_id: ONESISGNAL_APP_ID,
			headings: {
				en: title,
			},
			contents: {
				en: content,
			},

			filters,
		}),
	};

	const result = await (await fetch(url, options)).json();
	if (result.errors?.length) {
		console.log('Onesignal errors while sending push notifications: ', result.errors);
		return result.errors;
	}
	return result;
}

function dateToUnixTimestamp(dateString) {
	if (dateString) {
		const date = new Date(dateString);

		if (isNaN(date.getTime())) {
			throw new Error('Invalid date string');
		}

		return Math.floor(date.getTime() / 1000);
	} else {
		const date = new Date();

		if (isNaN(date.getTime())) {
			throw new Error('Invalid date string');
		}

		return Math.floor(date.getTime() / 1000);
	}

}

const ONE_DAY_SECONDS = 86400;

async function addMatchTagOnesignal(userId, match) {
	const user = await getOnesignalUser(userId);
	const matchTagKey = `${process.env.NODE_ENV}_match_request_date`;

	if (!user.properties.tags?.[matchTagKey]) {
		user.properties.tags[matchTagKey] = match?.sent_date
			? dateToUnixTimestamp(match.sent_date)
			: '';
	} else {
		const now = dateToUnixTimestamp(new Date());
		if (now - parseInt(user.properties.tags[matchTagKey]) >= 2.5 * ONE_DAY_SECONDS) {
			user.properties.tags[matchTagKey] = match?.sent_date
				? dateToUnixTimestamp(match.sent_date)
				: '';
		}

		if (!match?.sent_date) {
			user.properties.tags[matchTagKey] = '';
		}
	}

	return updateOnesignalUser(user, userId);
}

async function updateMatchDateTag(userId, last_date) {
	const user = await getOnesignalUser(userId);
	const tagKey = `${process.env.NODE_ENV}_last_match_request_date`;

	user.properties.tags[tagKey] = last_date ? dateToUnixTimestamp(last_date) : ''

	return updateOnesignalUser(user, userId);
}


async function updateRejectedDateTag(userId, status) {
	const user = await getOnesignalUser(userId);
	const tagKey = `${process.env.NODE_ENV}_last_rejected_date`;

	if (status === 'rejected') {
		user.properties.tags[tagKey] = dateToUnixTimestamp()
	} else {
		user.properties.tags[tagKey] = '';
	}

	return updateOnesignalUser(user, userId);
}

module.exports = {
	createOnesignalUser,
	updateOnesignalUserTags,
	getOnesignalUser,
	formatOnesignalTags,
	updateOnesignalUser,
	deleteOnesignalUser,
	addOnesignalNotification,
	createSegment,
	addBatchNotifications,
	getProfileTagFilter,
	addMatchTagOnesignal,
	updateRejectedDateTag,
	updateMatchDateTag
};
