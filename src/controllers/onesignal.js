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

	// TODO: uncommnet when we get more likes/purposes
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

function getUpdatedOnesignalTags(tags, type, normalizedId, operation) {
	console.log(tags, type, normalizedId);
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

async function updateOnesignalUserTags(userId, type, normalizedId, operation) {
	if (!normalizedId) {
		return;
	}

	const user = await getOnesignalUser(userId);

	user.properties.tags = getUpdatedOnesignalTags(
		user.properties.tags,
		type,
		normalizedId,
		operation
	);
	console.log('user tags', user.properties.tags, type, normalizedId);

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

	return updateResponse.json();
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

module.exports = {
	createOnesignalUser,
	updateOnesignalUserTags,
	getOnesignalUser,
	getUpdatedOnesignalTags,
	updateOnesignalUser,
	deleteOnesignalUser,
	addOnesignalNotification,
};
